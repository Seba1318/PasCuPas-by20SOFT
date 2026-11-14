"""Conexiunea SQLAlchemy."""

from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app import config

# pool_pre_ping: dacă PostgreSQL a fost repornit, conexiunea moartă e înlocuită automat.
engine = create_engine(config.DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    """Clasa de bază pentru toate tabelele din app/models."""


def get_db() -> Iterator[Session]:
    """Dependență FastAPI: o sesiune pe request, închisă la final chiar dacă apare o eroare."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
