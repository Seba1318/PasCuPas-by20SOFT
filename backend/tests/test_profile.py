"""Profilul de nevoi: GET întoarce null până la prima salvare, PUT creează și actualizează."""

from app.models import User
from app.security import create_token, hash_password, password_stamp

WHEELCHAIR = {
    "avoid_stairs": True,
    "max_kerb_cm": 3,
    "max_incline_pct": 6,
    "avoid_rough_surface": True,
}


def auth_headers(db, email="ana@exemplu.ro") -> dict:
    from datetime import timedelta

    user = User(email=email, password_hash=hash_password("parola-buna1"), is_verified=True)
    db.add(user)
    db.commit()
    token = create_token(
        user.id, "access", timedelta(hours=1), pca=password_stamp(user.password_changed_at)
    )
    return {"Authorization": f"Bearer {token}"}


def test_profile_is_null_until_saved(client, db):
    headers = auth_headers(db)
    res = client.get("/users/me/profile", headers=headers)
    assert res.status_code == 200
    assert res.json() is None


def test_save_and_update_profile(client, db):
    headers = auth_headers(db)
    saved = client.put("/users/me/profile", json=WHEELCHAIR, headers=headers)
    assert saved.status_code == 200
    assert saved.json()["max_kerb_cm"] == 3
    assert saved.json()["prefer_tactile"] is False  # câmpurile lipsă primesc valoarea implicită

    client.put("/users/me/profile", json={**WHEELCHAIR, "max_kerb_cm": 6}, headers=headers)
    body = client.get("/users/me/profile", headers=headers).json()
    assert body["max_kerb_cm"] == 6
    assert body["avoid_stairs"] is True


def test_profile_rejects_impossible_values(client, db):
    headers = auth_headers(db)
    res = client.put("/users/me/profile", json={"max_kerb_cm": -2}, headers=headers)
    assert res.status_code == 422


def test_profile_requires_login(client):
    assert client.get("/users/me/profile").status_code == 401
