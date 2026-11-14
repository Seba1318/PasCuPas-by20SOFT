"""Readuce baza locală la datele demo, cu date proaspete (în seara dinaintea prezentării).

Șterge tot ce s-a adunat la teste: conturi noi, rapoarte, confirmări, poze, lucrări sau dotări
adăugate din admin. Apoi refă tabelele din migrații, importă străzile și orarul (din
backend/cache/, câteva secunde) și rulează seed_fake. Superadminii rămân, cu parolele lor.

Din folderul backend/, cu backendul oprit:
    uv run --group data python -m scripts.demo_reset --da

Refuză să ruleze fără --da sau dacă DATABASE_URL nu e o bază locală.
"""

import argparse
import subprocess
import sys
from pathlib import Path

from alembic.config import Config
from sqlalchemy import inspect, select
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

from alembic import command
from app import config
from app.database import SessionLocal, engine
from app.models import User

BACKEND = Path(__file__).resolve().parent.parent
LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1", "db"}
STEPS = ["scripts.import_osm", "scripts.import_gtfs", "scripts.seed_fake"]


def check_local(url: str) -> None:
    host = make_url(url).host
    if host not in LOCAL_HOSTS:
        sys.exit(f"DATABASE_URL arată spre {host}. demo_reset.py rulează doar pe o bază locală.")


def wipe_uploads(folder: Path) -> int:
    """Șterge pozele încărcate; .gitkeep rămâne, ca folderul să existe în Git."""
    removed = 0
    for path in folder.glob("*"):
        if path.is_file() and path.name != ".gitkeep":
            path.unlink()
            removed += 1
    return removed


def saved_superadmins(db: Session) -> list[tuple[str, str]]:
    """Superadminii de păstrat (email, hash-ul parolei). Pe o bază nouă, fără tabele, niciunul."""
    if not inspect(db.connection()).has_table("users"):
        return []
    return [
        (u.email, u.password_hash)
        for u in db.scalars(select(User).where(User.role == "superadmin"))
    ]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--da", action="store_true", help="confirm: șterge datele de test")
    args = parser.parse_args()
    check_local(config.DATABASE_URL)
    if not args.da:
        sys.exit("Comanda șterge toate datele de test. Rulați din nou cu --da ca să confirmați.")

    with SessionLocal() as db:
        admins = saved_superadmins(db)

    alembic = Config(str(BACKEND / "alembic.ini"))
    alembic.set_main_option("script_location", str(BACKEND / "alembic"))
    command.downgrade(alembic, "base")
    command.upgrade(alembic, "head")
    engine.dispose()  # tabelele sunt noi; conexiunile vechi nu le mai cunosc tipurile

    for module in STEPS:
        args_ = ["--replace"] if module != "scripts.seed_fake" else []
        subprocess.run([sys.executable, "-m", module, *args_], cwd=BACKEND, check=True)

    with SessionLocal() as db:
        for email, password_hash in admins:
            db.add(
                User(email=email, password_hash=password_hash, role="superadmin", is_verified=True)
            )
        db.commit()

    removed = wipe_uploads(config.UPLOAD_DIR)
    print(
        f"Gata: date demo proaspete, {len(admins)} superadmin(i) păstrați, {removed} poze "
        "șterse. Porniți din nou backendul, ca să încarce graful nou."
    )


if __name__ == "__main__":
    main()
