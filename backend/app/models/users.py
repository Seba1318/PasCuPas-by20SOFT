"""Utilizatori și instituții: institutions, users, accessibility_profiles, trust_events."""

from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    SmallInteger,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

ROLES = ("user", "admin", "superadmin")
INSTITUTION_TYPES = ("primarie", "transport", "universitate", "alta")
TRUST_LEVELS = (100, 50, 0)


class Institution(Base):
    __tablename__ = "institutions"
    __table_args__ = (CheckConstraint(f"type IN {INSTITUTION_TYPES}", name="institution_type"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    type: Mapped[str] = mapped_column(String(20))
    # Ce poate gestiona instituția (afișat în X11), de exemplu „Lucrări”, „Vehicule”.
    scopes: Mapped[list[str]] = mapped_column(ARRAY(Text), default=list, server_default="{}")

    users: Mapped[list["User"]] = relationship(back_populates="institution")


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint(f"role IN {ROLES}", name="user_role"),
        CheckConstraint(f"trust_level IN {TRUST_LEVELS}", name="user_trust_level"),
        # Un admin aparține mereu unei instituții; utilizatorii și superadminul, nu.
        CheckConstraint(
            "(role = 'admin') = (institution_id IS NOT NULL)", name="admin_has_institution"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    # Emailul se salvează mereu cu litere mici (vezi routers/auth.py), deci unique e suficient.
    email: Mapped[str] = mapped_column(String(254), unique=True)
    # Numele afișat pe pagina publică a raportului; până îl alege, se folosește începutul
    # adresei de email. Poza de profil e opțională (regulă din design).
    display_name: Mapped[str | None] = mapped_column(String(60))
    avatar_path: Mapped[str | None] = mapped_column(String(200))
    password_hash: Mapped[str] = mapped_column(String(200))
    role: Mapped[str] = mapped_column(String(20), default="user", server_default="user")
    institution_id: Mapped[int | None] = mapped_column(
        ForeignKey("institutions.id", ondelete="RESTRICT")
    )
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    trust_level: Mapped[int] = mapped_column(SmallInteger, default=100, server_default="100")
    suspended_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Intră în token-ul de resetare: după schimbarea parolei, linkurile vechi nu mai merg.
    password_changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    confirmed_reports_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    institution: Mapped[Institution | None] = relationship(back_populates="users")
    profile: Mapped["AccessibilityProfile | None"] = relationship(
        back_populates="user", cascade="all, delete-orphan", passive_deletes=True
    )


class AccessibilityProfile(Base):
    """Profilul de nevoi: un rând per utilizator, citit de algoritmul de rutare."""

    __tablename__ = "accessibility_profiles"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    # Reguli obligatorii (cost infinit când sunt încălcate)
    avoid_stairs: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    max_kerb_cm: Mapped[float | None]
    max_incline_pct: Mapped[float | None]
    # Preferințe (cost mai mare)
    avoid_rough_surface: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false"
    )
    prefer_tactile: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    prefer_audio_signals: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false"
    )
    simplified_mode: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    prefer_lit: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    # Avertisment (traseul nu se schimbă, apare doar un mesaj)
    needs_rest_every_m: Mapped[int | None]

    user: Mapped[User] = relationship(back_populates="profile")


class TrustEvent(Base):
    """Istoricul încrederii: de ce a scăzut sau a crescut."""

    __tablename__ = "trust_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    change: Mapped[int] = mapped_column(SmallInteger)
    reason: Mapped[str] = mapped_column(Text)
    report_id: Mapped[int | None] = mapped_column(ForeignKey("reports.id", ondelete="SET NULL"))
    # Nivelul de după schimbare și cine a făcut-o (None = automat, după regulile de încredere).
    new_level: Mapped[int | None] = mapped_column(SmallInteger)
    actor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    actor: Mapped["User | None"] = relationship(foreign_keys=[actor_id])
