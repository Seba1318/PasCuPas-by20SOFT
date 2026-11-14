"""Cum arată un cont în afară: numele afișat și poza de profil.

Designul cere ca pagina publică a raportului să arate numele celui care a raportat și poza
lui de profil (opțională). Până își alege un nume, folosim primul cuvânt din adresa de email
(ana.pop@exemplu.ro → Ana), niciodată adresa întreagă.
"""

import re

from fastapi import Request

from app.models import User
from app.schemas.users import UserOut

NAME_MIN, NAME_MAX = 2, 60


def public_name(user: User) -> str:
    if user.display_name:
        return user.display_name
    local = user.email.split("@")[0]
    first = re.split(r"[._\-+\d]", local)[0] or local
    return first.capitalize()


def avatar_url(request: Request, user: User) -> str | None:
    if not user.avatar_path:
        return None
    return str(request.url_for("media", path=user.avatar_path))


def user_json(request: Request, user: User) -> dict:
    """Contul, ca în GET /users/me: datele din UserOut plus adresa pozei de profil."""
    return UserOut.model_validate(user).model_dump() | {"avatar_url": avatar_url(request, user)}
