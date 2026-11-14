"""Pregătirea comună pentru teste (pytest încarcă singur acest fișier).

Testele rulează pe baza separată navigare_test, niciodată pe cea de dezvoltare: variabila
DATABASE_URL e schimbată aici, înainte ca `app` să fie importat.
"""

import os
import re

TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL", "postgresql+psycopg://navigare:navigare@localhost:5432/navigare_test"
)
if not TEST_DATABASE_URL.endswith("_test"):
    raise RuntimeError("Testele șterg datele: TEST_DATABASE_URL trebuie să fie o bază *_test.")
os.environ["DATABASE_URL"] = TEST_DATABASE_URL
os.environ.setdefault("JWT_SECRET", "secret-doar-pentru-teste-" + "x" * 40)

import pytest  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from alembic import command  # noqa: E402
from app.database import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.services import email  # noqa: E402

BACKEND_DIR = os.path.dirname(os.path.dirname(__file__))


@pytest.fixture(scope="session", autouse=True)
def schema():
    """O dată pe sesiune: aplică migrațiile Alembic, deci testăm și migrația."""
    command.upgrade(Config(os.path.join(BACKEND_DIR, "alembic.ini")), "head")


@pytest.fixture(autouse=True)
def clean_tables():
    """Fiecare test pornește cu tabelele goale."""
    yield
    names = ", ".join(table.name for table in Base.metadata.sorted_tables)
    with engine.begin() as conn:
        conn.execute(text(f"TRUNCATE {names} RESTART IDENTITY CASCADE"))


@pytest.fixture
def db():
    with SessionLocal() as session:
        yield session


@pytest.fixture
def client():
    # Fără `with TestClient(...)`: nu rulăm lifespan, deci testele nu au nevoie de graful OSM.
    return TestClient(app)


class Outbox(list):
    """Emailurile „trimise” în timpul unui test, cu linkul din fiecare."""

    def token(self, index: int = -1) -> str:
        return re.search(r"token=([\w.-]+)", self[index]["html"]).group(1)


@pytest.fixture
def outbox(monkeypatch) -> Outbox:
    sent = Outbox()

    async def fake_send(to, subject, html):
        sent.append({"to": to, "subject": subject, "html": html})

    monkeypatch.setattr(email, "_send", fake_send)
    return sent


@pytest.fixture
def uploads(tmp_path, monkeypatch):
    """Pozele testelor se salvează într-un folder temporar, nu în backend/uploads."""
    from app import config

    monkeypatch.setattr(config, "UPLOAD_DIR", tmp_path)
    return tmp_path
