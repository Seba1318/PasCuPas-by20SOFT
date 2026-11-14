"""Dotări și locații: places, works."""

from datetime import date

from geoalchemy2 import Geometry
from sqlalchemy import Boolean, Date, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base

# Aceleași categorii ca straturile din frontend (src/api/mock/fixtures/places.js).
PLACE_CATEGORIES = (
    "building",
    "ramp",
    "lift",
    "entrance",
    "toilet",
    "parking",
    "tactile",
    "audio_signal",
    "bench",
)


class Place(Base):
    """Rampe, lifturi, toalete, parcări, bănci, clădiri.

    attributes (JSONB) ține detaliile care diferă de la o categorie la alta, de exemplu
    pentru o clădire: {"step_free_entrance": true, "lift": true, "door_width_cm": 90}.
    """

    __tablename__ = "places"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    category: Mapped[str] = mapped_column(String(30), index=True)
    geom = mapped_column(Geometry("POINT", srid=4326), nullable=False)
    attributes: Mapped[dict] = mapped_column(JSONB, default=dict, server_default="{}")
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))


class Work(Base):
    """Lucrări planificate publicate de admin. geom e o linie sau un poligon."""

    __tablename__ = "works"

    id: Mapped[int] = mapped_column(primary_key=True)
    institution_id: Mapped[int] = mapped_column(ForeignKey("institutions.id"))
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    geom = mapped_column(Geometry("GEOMETRY", srid=4326), nullable=False)
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date)
    blocks_route: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
