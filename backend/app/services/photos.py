"""Pozele rapoartelor (planul 20SOFT · Raportare și Riscuri: „Upload de fișiere periculoase”).

1. Verificăm cu Pillow că fișierul e cu adevărat JPEG sau PNG, nu după extensie: un .exe
   redenumit în .jpg e refuzat.
2. Citim metadatele (EXIF): data pozei și, dacă există, poziția GPS. Le folosim la scor.
3. Salvăm o poză nouă: rotită corect, micșorată la maxim 1600 px, ca JPEG fără metadate.
   Numele îl generează serverul (uuid4), nu utilizatorul.
"""

import uuid
from dataclasses import dataclass
from datetime import datetime
from io import BytesIO
from pathlib import Path
from zoneinfo import ZoneInfo

from PIL import Image, ImageOps, UnidentifiedImageError

MAX_BYTES = 8 * 1024 * 1024
MAX_SIDE_PX = 1600
ALLOWED_FORMATS = {"JPEG", "PNG"}
LOCAL_TIME = ZoneInfo("Europe/Bucharest")  # EXIF are ora locală, fără fus orar

EXIF_IFD, GPS_IFD = 0x8769, 0x8825
DATETIME_ORIGINAL, DATETIME = 36867, 306


class PhotoError(ValueError):
    """Poză refuzată; mesajul e pentru utilizator."""


@dataclass
class Photo:
    image: Image.Image
    taken_at: datetime | None  # din EXIF
    gps: tuple[float, float] | None  # (lon, lat) din EXIF


def _exif_datetime(exif) -> datetime | None:
    raw = exif.get_ifd(EXIF_IFD).get(DATETIME_ORIGINAL) or exif.get(DATETIME)
    try:
        return datetime.strptime(str(raw).strip("\x00 "), "%Y:%m:%d %H:%M:%S").replace(
            tzinfo=LOCAL_TIME
        )
    except ValueError:
        return None


def _exif_gps(exif) -> tuple[float, float] | None:
    gps = exif.get_ifd(GPS_IFD)
    try:
        lat = sum(float(v) / 60**i for i, v in enumerate(gps[2]))  # grade, minute, secunde
        lon = sum(float(v) / 60**i for i, v in enumerate(gps[4]))
    except (KeyError, TypeError, ValueError, ZeroDivisionError):
        return None
    if gps.get(1) == "S":
        lat = -lat
    if gps.get(3) == "W":
        lon = -lon
    return lon, lat


def read_photo(data: bytes) -> Photo:
    if len(data) > MAX_BYTES:
        raise PhotoError("Poza e prea mare. Maximul e 8 MB.")
    try:
        with Image.open(BytesIO(data)) as probe:
            probe.verify()  # verifică structura fișierului fără să decodeze toată poza
        image = Image.open(BytesIO(data))
        image.load()
    except (UnidentifiedImageError, OSError, SyntaxError, Image.DecompressionBombError):
        raise PhotoError("Fișierul nu e o poză. Alege o poză JPEG sau PNG.") from None
    if image.format not in ALLOWED_FORMATS:
        raise PhotoError("Poza trebuie să fie JPEG sau PNG.")
    exif = image.getexif()
    return Photo(image=image, taken_at=_exif_datetime(exif), gps=_exif_gps(exif))


def save_photo(photo: Photo, upload_dir: Path) -> str:
    """Salvează poza curățată și întoarce numele fișierului (uuid4().jpg)."""
    image = ImageOps.exif_transpose(photo.image)  # rotim după EXIF înainte să-l ștergem
    image = image.convert("RGB")  # JPEG nu are transparență
    image.thumbnail((MAX_SIDE_PX, MAX_SIDE_PX))  # păstrează proporțiile, doar micșorează
    name = f"{uuid.uuid4()}.jpg"
    upload_dir.mkdir(parents=True, exist_ok=True)
    # Fără argumentul exif=..., Pillow scrie un JPEG nou fără metadate (fără GPS, fără telefon).
    image.save(upload_dir / name, "JPEG", quality=85, optimize=True)
    return name


AVATAR_PX = 256


def save_avatar(photo: Photo, upload_dir: Path) -> str:
    """Poza de profil: rotită după EXIF, decupată pătrat din centru, 256×256, JPEG fără
    metadate. Numele începe cu „avatar-”, ca să nu fie confundată cu pozele rapoartelor."""
    image = ImageOps.exif_transpose(photo.image).convert("RGB")
    image = ImageOps.fit(image, (AVATAR_PX, AVATAR_PX))
    name = f"avatar-{uuid.uuid4()}.jpg"
    upload_dir.mkdir(parents=True, exist_ok=True)
    image.save(upload_dir / name, "JPEG", quality=85, optimize=True)
    return name
