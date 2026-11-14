"""Numele afișat și poza de profil (F1/W3): contul, pagina publică a raportului, ștergerea."""

from PIL import Image

from app.models import User
from tests.helpers import auth, make_user, photo_bytes, send_report


def upload(client, headers, image=None):
    image = image or ("eu.jpg", photo_bytes(size=(800, 600)), "image/jpeg")
    return client.post("/users/me/avatar", files={"photo": image}, headers=headers)


def test_name_defaults_to_email_and_can_be_changed(client, db):
    ana = make_user(db, email="ana.pop@exemplu.ro")
    me = client.get("/users/me", headers=auth(ana)).json()
    assert me["display_name"] is None and me["avatar_url"] is None

    res = client.patch("/users/me", json={"display_name": "  Ana   Pop "}, headers=auth(ana))
    assert res.status_code == 200 and res.json()["display_name"] == "Ana Pop"

    res = client.patch("/users/me", json={"display_name": "   "}, headers=auth(ana))
    assert res.json()["display_name"] is None  # gol: revine începutul emailului


def test_name_too_short_or_too_long_is_422(client, db):
    ana = make_user(db)
    for name in ("A", "x" * 61):
        res = client.patch("/users/me", json={"display_name": name}, headers=auth(ana))
        assert res.status_code == 422


def test_avatar_is_square_without_metadata_and_replaces_the_old_one(client, db, uploads):
    ana = make_user(db)
    first = upload(client, auth(ana)).json()["avatar_url"]
    assert first.endswith(".jpg")
    second = upload(client, auth(ana)).json()["avatar_url"]

    saved = list(uploads.iterdir())
    assert [p.name for p in saved] == [second.rsplit("/", 1)[1]]  # cea veche a fost ștearsă
    with Image.open(saved[0]) as image:
        assert image.size == (256, 256)
        assert not image.getexif()


def test_avatar_must_be_a_real_image(client, db, uploads):
    ana = make_user(db)
    res = upload(client, auth(ana), ("eu.jpg", b"MZ nu sunt poza", "image/jpeg"))
    assert res.status_code == 400
    assert list(uploads.iterdir()) == []


def test_avatar_can_be_removed(client, db, uploads):
    ana = make_user(db)
    upload(client, auth(ana))
    res = client.delete("/users/me/avatar", headers=auth(ana))
    assert res.status_code == 200 and res.json()["avatar_url"] is None
    assert list(uploads.iterdir()) == []


def test_report_page_shows_name_and_avatar(client, db, uploads, outbox):
    ana = make_user(db)
    client.patch("/users/me", json={"display_name": "Andreea"}, headers=auth(ana))
    avatar = upload(client, auth(ana)).json()["avatar_url"]
    code = send_report(client, auth(ana)).json()["public_code"]

    reporter = client.get(f"/reports/{code}").json()["properties"]["reporter"]
    assert reporter["name"] == "Andreea" and reporter["avatar_url"] == avatar


def test_deleting_the_account_deletes_the_avatar(client, db, uploads):
    ana = make_user(db)
    upload(client, auth(ana))
    assert client.delete("/users/me", headers=auth(ana)).status_code == 204
    assert list(uploads.iterdir()) == []
    assert db.query(User).count() == 0


def test_export_and_admin_list_include_name(client, db):
    ana = make_user(db)
    client.patch("/users/me", json={"display_name": "Andreea"}, headers=auth(ana))
    assert client.get("/users/me/export", headers=auth(ana)).json()["account"]["display_name"] == (
        "Andreea"
    )

    boss = make_user(db, email="boss@exemplu.ro", role="superadmin")
    items = client.get("/admin/users?q=andre", headers=auth(boss)).json()["items"]
    assert [u["email"] for u in items] == ["ana@exemplu.ro"]
