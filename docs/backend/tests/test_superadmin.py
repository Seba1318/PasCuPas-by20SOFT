"""Superadmin: încrederea utilizatorilor și instituțiile cu conturile lor."""

from sqlalchemy import select

from app.models import Institution, User
from tests.helpers import auth, make_user


def superadmin(db):
    return make_user(db, email="super@exemplu.ro", role="superadmin")


def test_only_superadmin_sees_users(client, db):
    city = Institution(name="Primăria", type="primarie")
    db.add(city)
    db.commit()
    admin = make_user(db, email="primarie@exemplu.ro", role="admin", institution_id=city.id)
    assert client.get("/admin/users", headers=auth(admin)).status_code == 403


def test_list_and_change_trust_with_history(client, db):
    boss, ana = superadmin(db), make_user(db)
    headers = auth(boss)
    res = client.patch(
        f"/admin/users/{ana.id}",
        json={"trust_level": 0, "reason": "Rapoarte false repetate"},
        headers=headers,
    )
    assert res.status_code == 200
    body = res.json()
    assert body["trust_level"] == 0 and body["suspended_until"] is not None
    assert body["history"][0]["change"] == "100 → 0: Rapoarte false repetate"
    assert body["history"][0]["by"] == "super@exemplu.ro"

    listed = client.get("/admin/users", params={"trust": 0}, headers=headers).json()
    assert [u["email"] for u in listed["items"]] == ["ana@exemplu.ro"]
    found = client.get("/admin/users", params={"q": "ANA"}, headers=headers).json()
    assert found["total"] == 1


def test_trust_change_needs_a_reason(client, db):
    boss, ana = superadmin(db), make_user(db)
    res = client.patch(
        f"/admin/users/{ana.id}", json={"trust_level": 50, "reason": "  "}, headers=auth(boss)
    )
    assert res.status_code == 422
    assert res.json()["detail"] == "Scrie motivul schimbării."


def test_create_institution_invites_its_accounts(client, db, outbox):
    boss = superadmin(db)
    body = {
        "name": "Universitatea de Vest",
        "type": "universitate",
        "scopes": ["Dotări și locații"],
        "accounts": [
            {"email": "Admin@UVT.Exemplu.ro", "role": "admin"},
            {"email": "op@uvt.exemplu.ro", "role": "operator"},
        ],
    }
    res = client.post("/admin/institutions", json=body, headers=auth(boss))
    assert res.status_code == 201
    assert res.json() == {
        "id": res.json()["id"],
        "name": "Universitatea de Vest",
        "type": "universitate",
        "scopes": ["Dotări și locații"],
        "accounts": 2,
    }
    assert sorted(m["to"] for m in outbox) == ["admin@uvt.exemplu.ro", "op@uvt.exemplu.ro"]

    # Invitația e un link de alegere a parolei; după el, contul intră în panou.
    mail = next(m for m in outbox if m["to"] == "admin@uvt.exemplu.ro")
    assert "/parola-noua?token=" in mail["html"]
    client.post(
        "/auth/reset-password",
        json={"token": outbox.token(outbox.index(mail)), "password": "parola-uvt-1"},
    )
    login = client.post(
        "/auth/login", json={"email": "admin@uvt.exemplu.ro", "password": "parola-uvt-1"}
    )
    assert login.status_code == 200
    account = db.scalar(select(User).where(User.email == "admin@uvt.exemplu.ro"))
    assert account.role == "admin" and account.institution.name == "Universitatea de Vest"

    listed = client.get("/admin/institutions", headers=auth(boss)).json()
    assert [i["name"] for i in listed] == ["Universitatea de Vest"]


def test_institution_with_existing_email_is_409(client, db):
    boss = superadmin(db)
    make_user(db, email="ocupat@uvt.exemplu.ro")
    body = {"name": "UVT", "type": "universitate", "accounts": [{"email": "ocupat@uvt.exemplu.ro"}]}
    res = client.post("/admin/institutions", json=body, headers=auth(boss))
    assert res.status_code == 409
    assert db.scalar(select(Institution)) is None  # nimic creat pe jumătate
