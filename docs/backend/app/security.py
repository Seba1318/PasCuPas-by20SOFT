"""Hash parole (pwdlib/bcrypt), creare și citire JWT.

Toate token-urile sunt JWT semnate cu același JWT_SECRET. Câmpul `purpose` spune la ce
folosește fiecare, ca un token de resetare să nu poată fi folosit drept login:
    access  login-ul, valabil JWT_EXPIRE_MINUTES (24 h)
    verify  linkul de confirmare din email, valabil 24 h
    reset   linkul de resetare a parolei, valabil 30 min

Token-urile access și reset conțin și `pca` (password_changed_at). După o schimbare de
parolă, valoarea din bază nu mai e aceeași, deci token-urile vechi nu mai merg. Așa nu
avem nevoie de un tabel separat cu token-uri folosite.
"""

from datetime import UTC, datetime, timedelta

import jwt
from pwdlib import PasswordHash
from pwdlib.hashers.bcrypt import BcryptHasher

from app import config

ALGORITHM = "HS256"

_hasher = PasswordHash((BcryptHasher(),))
# Hash calculat o singură dată, folosit la login când emailul nu există: verificarea durează
# la fel de mult, deci timpul de răspuns nu dezvăluie dacă există contul.
_DUMMY_HASH = _hasher.hash("parola-care-nu-exista-1")


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str | None) -> bool:
    if password_hash is None:
        _hasher.verify(password, _DUMMY_HASH)
        return False
    return _hasher.verify(password, password_hash)


def create_token(user_id: int, purpose: str, expires_in: timedelta, **claims) -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": str(user_id),  # JWT cere ca `sub` să fie text
        "purpose": purpose,
        "iat": now,
        "exp": now + expires_in,
        **claims,
    }
    return jwt.encode(payload, config.JWT_SECRET, algorithm=ALGORITHM)


def decode_token(token: str, purpose: str) -> dict | None:
    """Întoarce conținutul token-ului sau None dacă e expirat, modificat sau de alt tip."""
    try:
        payload = jwt.decode(token, config.JWT_SECRET, algorithms=[ALGORITHM])
    except jwt.InvalidTokenError:  # include ExpiredSignatureError și semnătura greșită
        return None
    if payload.get("purpose") != purpose:
        return None
    return payload


def password_stamp(changed_at: datetime) -> str:
    """Valoarea `pca` pusă în token-uri: momentul ultimei schimbări de parolă, în UTC."""
    return changed_at.astimezone(UTC).isoformat()
