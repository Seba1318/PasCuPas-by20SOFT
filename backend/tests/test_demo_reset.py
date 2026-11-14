"""Scriptul de resetare a datelor demo: doar verificările de siguranță și curățarea pozelor.
Resetarea propriu-zisă (migrații, importuri, seed) o încercăm pe baza de dezvoltare, nu aici."""

import pytest

from scripts.demo_reset import check_local, wipe_uploads


def test_refuses_a_remote_database():
    with pytest.raises(SystemExit):
        check_local("postgresql+psycopg://u:p@db.exemplu.ro:5432/navigare")
    check_local("postgresql+psycopg://u:p@localhost:5432/navigare")  # locală: merge


def test_wipe_uploads_keeps_gitkeep(tmp_path):
    for name in (".gitkeep", "raport.jpg", "avatar-1.jpg"):
        (tmp_path / name).write_bytes(b"x")
    assert wipe_uploads(tmp_path) == 2
    assert [p.name for p in tmp_path.iterdir()] == [".gitkeep"]
