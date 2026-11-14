"""Scriptul de resetare a datelor demo: doar verificările de siguranță și curățarea pozelor.
Resetarea propriu-zisă (migrații, importuri, seed) o încercăm pe baza de dezvoltare, nu aici."""

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import engine
from app.models import User
from scripts.demo_reset import check_local, saved_superadmins, wipe_uploads


def test_superadmins_are_kept(db):
    db.add(User(email="sef@exemplu.ro", password_hash="h", role="superadmin", is_verified=True))
    db.add(User(email="ana@exemplu.ro", password_hash="h", role="user", is_verified=True))
    db.commit()
    assert saved_superadmins(db) == [("sef@exemplu.ro", "h")]


def test_a_brand_new_database_has_no_superadmins_to_keep():
    # Prima rulare pe un laptop nou: tabelele nu există încă (o schemă goală, fără „users”).
    # Totul într-o tranzacție anulată la final, ca schema și search_path să nu rămână în pool.
    with engine.connect() as conn:
        conn.execute(text("CREATE SCHEMA gol"))
        conn.execute(text("SET LOCAL search_path TO gol"))
        try:
            assert saved_superadmins(Session(bind=conn)) == []
        finally:
            conn.rollback()


def test_refuses_a_remote_database():
    with pytest.raises(SystemExit):
        check_local("postgresql+psycopg://u:p@db.exemplu.ro:5432/navigare")
    check_local("postgresql+psycopg://u:p@localhost:5432/navigare")  # locală: merge


def test_wipe_uploads_keeps_gitkeep(tmp_path):
    for name in (".gitkeep", "raport.jpg", "avatar-1.jpg"):
        (tmp_path / name).write_bytes(b"x")
    assert wipe_uploads(tmp_path) == 2
    assert [p.name for p in tmp_path.iterdir()] == [".gitkeep"]
