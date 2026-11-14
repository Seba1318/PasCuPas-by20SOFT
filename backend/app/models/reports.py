"""Rapoarte și proiecte: reports, report_confirmations, projects."""

from datetime import date, datetime
from decimal import Decimal

from geoalchemy2 import Geometry
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Numeric,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

REPORT_STATUSES = ("in_lucru", "rezolvat", "respins")
# Categoriile din frontend (src/reports/categories.js).
REPORT_CATEGORIES = (
    "rampa_blocata",
    "masina_trotuar",
    "lift_defect",
    "lucrari",
    "ghidaj_tactil",
    "bordura_inalta",
    "semafor_sonor",
    "dotare_vehicul",
    "altceva",
)
VEHICLE_CATEGORY = "dotare_vehicul"
EQUIPMENT = ("ramp", "audio")
PROJECT_STATUSES = ("planificat", "in_curs", "finalizat")
CONFIRMATION_KINDS = ("confirm", "inca_exista", "rezolvat")


class Report(Base):
    __tablename__ = "reports"
    __table_args__ = (
        CheckConstraint(f"status IN {REPORT_STATUSES}", name="report_status"),
        CheckConstraint("ai_score BETWEEN 0 AND 100", name="report_ai_score"),
        CheckConstraint(f"category IN {REPORT_CATEGORIES}", name="report_category"),
        CheckConstraint(f"equipment IN {EQUIPMENT}", name="report_equipment"),
        # Doar rapoartele despre vehicule pot fi fără loc pe hartă.
        CheckConstraint(
            f"geom IS NOT NULL OR category = '{VEHICLE_CATEGORY}'", name="report_has_location"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    # TM-2026-000123: generat din an și id, după INSERT (id-ul îl dă baza).
    public_code: Mapped[str | None] = mapped_column(String(20), unique=True)
    # Ștergerea contului șterge și rapoartele lui (regulă din design).
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    category: Mapped[str] = mapped_column(String(30))
    description: Mapped[str | None] = mapped_column(String(500))
    location_text: Mapped[str | None] = mapped_column(String(200))
    geom = mapped_column(Geometry("POINT", srid=4326))
    photo_path: Mapped[str | None] = mapped_column(String(200))
    # Poziția browserului în momentul trimiterii și precizia ei, pentru scorul de locație.
    reporter_geom = mapped_column(Geometry("POINT", srid=4326))
    reporter_accuracy_m: Mapped[float | None] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String(10), default="in_lucru", server_default="in_lucru")
    possibly_resolved: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    is_false: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    edge_id: Mapped[int | None] = mapped_column(ForeignKey("graph_edges.id", ondelete="SET NULL"))
    place_id: Mapped[int | None] = mapped_column(ForeignKey("places.id", ondelete="SET NULL"))
    vehicle_id: Mapped[int | None] = mapped_column(ForeignKey("vehicles.id", ondelete="SET NULL"))
    # Ce dotare s-a stricat, pentru categoria dotare_vehicul: rampa sau anunțurile sonore.
    equipment: Mapped[str | None] = mapped_column(String(10))
    # Scorul verificării automate (0–100), pe componente: AI 0–60, data 0–20, locația 0–20.
    ai_score: Mapped[int | None] = mapped_column(SmallInteger)
    ai_notes: Mapped[str | None] = mapped_column(Text)
    score_date: Mapped[int | None] = mapped_column(SmallInteger)
    score_location: Mapped[int | None] = mapped_column(SmallInteger)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    resolved_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    # După 3 zile de la rezolvare raportul dispare de pe hartă, dar rămâne pentru statistici.
    hidden_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user: Mapped["User"] = relationship(foreign_keys=[user_id])  # noqa: F821


class ReportConfirmation(Base):
    """Rapoartele duplicate și răspunsurile „Încă e stricat?” devin confirmări."""

    __tablename__ = "report_confirmations"
    __table_args__ = (
        UniqueConstraint("report_id", "user_id", "kind", name="one_confirmation_per_kind"),
        CheckConstraint(f"kind IN {CONFIRMATION_KINDS}", name="confirmation_kind"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    report_id: Mapped[int] = mapped_column(ForeignKey("reports.id", ondelete="CASCADE"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    kind: Mapped[str] = mapped_column(String(12))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Project(Base):
    """Proiectele primăriei: sursa de date pentru chatbot."""

    __tablename__ = "projects"
    __table_args__ = (CheckConstraint(f"status IN {PROJECT_STATUSES}", name="project_status"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    institution_id: Mapped[int] = mapped_column(ForeignKey("institutions.id"))
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    start_date: Mapped[date | None] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)
    zone: Mapped[str | None] = mapped_column(String(200))  # „Piața Victoriei – Complex”
    status: Mapped[str] = mapped_column(String(30), default="planificat")
    budget: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
