"""Creează primul superadmin. Parola se cere în terminal, nu apare în istoric.

Din folderul backend/:
    uv run python -m scripts.create_superadmin --email adresa@exemplu.ro
"""

import argparse
import sys
from getpass import getpass

from pydantic import ValidationError
from sqlalchemy import select

from app.database import SessionLocal
from app.models import User
from app.schemas.auth import RegisterIn
from app.security import hash_password


def main() -> None:
    parser = argparse.ArgumentParser(description="Creează primul superadmin.")
    parser.add_argument("--email", required=True)
    args = parser.parse_args()

    password = getpass("Parola: ")
    confirm = getpass("Parola, încă o dată: ")
    try:
        # Aceleași reguli ca la înregistrarea din aplicație.
        data = RegisterIn(email=args.email, password=password, password_confirm=confirm)
    except ValidationError as exc:
        sys.exit("\n".join(err["msg"] for err in exc.errors()))

    with SessionLocal() as db:
        if db.scalar(select(User).where(User.email == data.email)):
            sys.exit(f"Există deja un cont cu adresa {data.email}.")
        db.add(
            User(
                email=data.email,
                password_hash=hash_password(data.password),
                role="superadmin",
                is_verified=True,
            )
        )
        db.commit()
    print(f"Superadminul {data.email} a fost creat.")


if __name__ == "__main__":
    main()
