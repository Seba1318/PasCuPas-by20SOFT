"""Datele trimise de routerul users."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class InstitutionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    type: Literal["primarie", "transport", "alta"]


class UserOut(BaseModel):
    """Răspunsul de la GET /users/me. Nu conține niciodată password_hash."""

    # from_attributes: Pydantic citește câmpurile direct din obiectul SQLAlchemy User.
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    display_name: str | None
    avatar_url: str | None = None  # completat de services/accounts.user_json
    role: Literal["user", "admin", "superadmin"]
    institution: InstitutionOut | None
    is_verified: bool
    trust_level: Literal[100, 50, 0]
    suspended_until: datetime | None
    confirmed_reports_count: int
    created_at: datetime


class AccountUpdate(BaseModel):
    """PATCH /users/me. Un nume gol (sau doar spații) îl șterge: revine începutul emailului."""

    display_name: str | None = Field(default=None, max_length=60)


class Profile(BaseModel):
    """Profilul de nevoi (planul 20SOFT · Profilul de nevoi). Fiecare câmp devine o regulă
    pentru rutare: obligatorie, preferință sau doar avertisment."""

    model_config = ConfigDict(from_attributes=True)

    # Obligatorii: segmentele care le încalcă au cost infinit.
    avoid_stairs: bool = False
    max_kerb_cm: float | None = Field(None, ge=0, le=30)
    max_incline_pct: float | None = Field(None, gt=0, le=30)
    # Preferințe: segmentele care nu le respectă costă mai mult.
    avoid_rough_surface: bool = False
    prefer_tactile: bool = False
    prefer_audio_signals: bool = False
    simplified_mode: bool = False
    prefer_lit: bool = False
    # Avertisment: traseul nu se schimbă, apare doar un mesaj.
    needs_rest_every_m: int | None = Field(None, ge=50, le=5000)
