"""Autentificare: cele trei cazuri obligatorii din plan (Teste obligatorii) și fluxurile din jur."""

import pytest

from app.models import User
from app.routers import auth as auth_router
from app.security import hash_password

PASSWORD = "parola-buna1"


def register(client, email="ana@exemplu.ro", password=PASSWORD, confirm=None):
    return client.post(
        "/auth/register",
        json={"email": email, "password": password, "password_confirm": confirm or password},
    )


def login(client, email="ana@exemplu.ro", password=PASSWORD):
    return client.post("/auth/login", json={"email": email, "password": password})


def make_user(db, email="ana@exemplu.ro", password=PASSWORD, **fields) -> User:
    user = User(email=email, password_hash=hash_password(password), is_verified=True, **fields)
    db.add(user)
    db.commit()
    return user


# --- Cazurile obligatorii din plan --------------------------------------------------------


def test_login_before_email_confirmation_is_403(client, outbox):
    assert register(client).status_code == 201
    res = login(client)
    assert res.status_code == 403
    assert "nu e confirmat" in res.json()["detail"]


def test_already_registered_email_is_409(client, outbox):
    assert register(client).status_code == 201
    # Aceeași adresă scrisă cu majuscule e același cont.
    res = register(client, email="Ana@Exemplu.ro")
    assert res.status_code == 409
    assert res.json()["detail"] == "Există deja un cont cu acest email."


def test_simultaneous_registration_is_409_not_500(client, db, outbox, monkeypatch):
    make_user(db)
    # Simulăm a doua cerere dintr-un dublu-clic: verificarea „emailul există?” a trecut deja.
    monkeypatch.setattr(auth_router, "_user_by_email", lambda db, address: None)
    res = register(client)
    assert res.status_code == 409
    assert outbox == []


def test_reset_token_used_after_password_change_is_400(client, db, outbox):
    make_user(db)
    client.post("/auth/forgot-password", json={"email": "ana@exemplu.ro"})
    token = outbox.token()

    first = client.post("/auth/reset-password", json={"token": token, "password": "parola-noua2"})
    assert first.status_code == 200
    second = client.post("/auth/reset-password", json={"token": token, "password": "alta-parola3"})
    assert second.status_code == 400
    assert login(client, password="parola-noua2").status_code == 200


# --- Înregistrare și confirmare -----------------------------------------------------------


def test_register_confirm_login_and_me(client, outbox):
    assert register(client, email=" Ana@Exemplu.ro ").status_code == 201
    assert outbox[0]["to"] == "ana@exemplu.ro"
    assert "/confirmare?token=" in outbox[0]["html"]

    assert client.get("/auth/verify", params={"token": outbox.token()}).status_code == 200
    token = login(client).json()["access_token"]

    me = client.get("/users/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    body = me.json()
    assert body["email"] == "ana@exemplu.ro"
    assert body["role"] == "user"
    assert body["trust_level"] == 100
    assert body["is_verified"] is True
    assert "password_hash" not in body


def test_confirmation_link_works_only_once(client, outbox):
    register(client)
    assert client.get("/auth/verify", params={"token": outbox.token()}).status_code == 200
    again = client.get("/auth/verify", params={"token": outbox.token()})
    assert again.status_code == 400
    assert again.json()["detail"] == "Linkul a expirat sau a fost deja folosit."


@pytest.mark.parametrize(
    ("password", "confirm", "message"),
    [
        ("scurt1", None, "cel puțin 8 caractere"),
        ("fara-cifre", None, "cel puțin o cifră"),
        ("parola-buna1", "parola-alta1", "nu sunt la fel"),
    ],
)
def test_register_rejects_weak_or_mismatched_password(client, outbox, password, confirm, message):
    res = register(client, password=password, confirm=confirm)
    assert res.status_code == 422
    assert message in res.json()["detail"][0]["msg"]
    assert outbox == []


def test_resend_verification_only_for_unconfirmed_accounts(client, db, outbox):
    register(client)
    make_user(db, email="confirmat@exemplu.ro")
    for address in ("ana@exemplu.ro", "confirmat@exemplu.ro", "nimeni@exemplu.ro"):
        res = client.post("/auth/resend-verification", json={"email": address})
        assert res.status_code == 200
    # 1 email la înregistrare + 1 retrimis; pentru celelalte două adrese, nimic.
    assert [mail["to"] for mail in outbox] == ["ana@exemplu.ro", "ana@exemplu.ro"]


# --- Login --------------------------------------------------------------------------------


def test_wrong_password_and_unknown_email_get_the_same_answer(client, db):
    make_user(db)
    wrong = login(client, password="gresita123")
    unknown = login(client, email="nimeni@exemplu.ro")
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json() == unknown.json() == {"detail": "Email sau parolă greșite"}


def test_me_requires_a_valid_token(client):
    assert client.get("/users/me").status_code == 401
    bad = client.get("/users/me", headers={"Authorization": "Bearer nu-e-un-jwt"})
    assert bad.status_code == 401


# --- Resetarea parolei --------------------------------------------------------------------


def test_forgot_password_does_not_reveal_accounts(client, db, outbox):
    make_user(db)
    known = client.post("/auth/forgot-password", json={"email": "ana@exemplu.ro"})
    unknown = client.post("/auth/forgot-password", json={"email": "nimeni@exemplu.ro"})
    assert known.json() == unknown.json()
    assert len(outbox) == 1
    assert "/parola-noua?token=" in outbox[0]["html"]


def test_password_reset_logs_out_old_sessions(client, db, outbox):
    make_user(db)
    old_token = login(client).json()["access_token"]
    client.post("/auth/forgot-password", json={"email": "ana@exemplu.ro"})
    client.post("/auth/reset-password", json={"token": outbox.token(), "password": "parola-noua2"})

    res = client.get("/users/me", headers={"Authorization": f"Bearer {old_token}"})
    assert res.status_code == 401


def test_verification_token_cannot_reset_password(client, outbox):
    register(client)
    verify_token = outbox.token()
    res = client.post(
        "/auth/reset-password", json={"token": verify_token, "password": "parola-noua2"}
    )
    assert res.status_code == 400


# Token-ul de login și cel de resetare conțin amândouă `pca`; doar `purpose` le deosebește.


def test_login_token_cannot_reset_password(client, db):
    make_user(db)
    access_token = login(client).json()["access_token"]
    res = client.post(
        "/auth/reset-password", json={"token": access_token, "password": "parola-noua2"}
    )
    assert res.status_code == 400
    assert login(client).status_code == 200  # parola veche merge în continuare


def test_reset_token_cannot_be_used_to_log_in(client, db, outbox):
    make_user(db)
    client.post("/auth/forgot-password", json={"email": "ana@exemplu.ro"})
    res = client.get("/users/me", headers={"Authorization": f"Bearer {outbox.token()}"})
    assert res.status_code == 401
