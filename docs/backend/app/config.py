"""Setări citite din .env (os.environ).

uvicorn le încarcă singur cu `--env-file ../.env`. Scripturile și testele nu trec prin
uvicorn, așa că la import citim și noi `.env` din rădăcina repo-ului, fără să suprascriem
variabilele deja puse în mediu (de exemplu de GitHub Actions sau de teste).
"""

import os
from pathlib import Path
from zoneinfo import ZoneInfo

REPO_ROOT = Path(__file__).resolve().parents[2]


def _load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


_load_env_file(REPO_ROOT / ".env")


def _bbox(text: str) -> tuple[float, float, float, float]:
    min_lon, min_lat, max_lon, max_lat = (float(x) for x in text.split(","))
    return min_lon, min_lat, max_lon, max_lat


DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql+psycopg://navigare:navigare@localhost:5432/navigare"
)
JWT_SECRET = os.environ.get("JWT_SECRET", "")
JWT_EXPIRE_MINUTES = int(os.environ.get("JWT_EXPIRE_MINUTES", "1440"))
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173").rstrip("/")

SMTP_HOST = os.environ.get("SMTP_HOST", "localhost")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "1025"))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")
MAIL_FROM = os.environ.get("MAIL_FROM", "noreply@example.com")

UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR", "./uploads"))
AI_API_KEY = os.environ.get("AI_API_KEY", "")
AI_MODEL = os.environ.get("AI_MODEL", "")
# Plafon de cost: câte poze verifică modelul pe zi; peste el, rapoartele rămân „neverificat”.
AI_DAILY_LIMIT = int(os.environ.get("AI_DAILY_LIMIT", "50"))
NOMINATIM_USER_AGENT = os.environ.get("NOMINATIM_USER_AGENT", "20soft-navigare/1.0")
DEMO_BBOX = _bbox(os.environ.get("DEMO_BBOX", "21.2150,45.7380,21.2480,45.7560"))

# Totul se salvează în UTC; ora afișată oamenilor și orarul GTFS sunt în ora României.
LOCAL_TIME = ZoneInfo("Europe/Bucharest")

# Durata linkurilor din emailuri (planul 20SOFT · Rulare și securitate).
VERIFY_TOKEN_HOURS = 24
RESET_TOKEN_MINUTES = 30

if len(JWT_SECRET) < 32:
    raise RuntimeError(
        "JWT_SECRET lipsește sau e prea scurt. Generați unul cu: "
        'python -c "import secrets; print(secrets.token_hex(32))" și puneți-l în .env'
    )
