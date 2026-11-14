"""Transport public: transit_stops, transit_routes, vehicles, trips, stop_times.

Stațiile, liniile și orarul vin din GTFS (scripts/import_gtfs.py); dotările sunt fictive.
"""

from datetime import date

from geoalchemy2 import Geometry
from sqlalchemy import Boolean, CheckConstraint, Date, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base

ROUTE_TYPES = ("tram", "trolleybus", "bus")


class TransitStop(Base):
    __tablename__ = "transit_stops"

    id: Mapped[int] = mapped_column(primary_key=True)
    gtfs_stop_id: Mapped[str] = mapped_column(String(64), unique=True)
    name: Mapped[str] = mapped_column(String(200))
    geom = mapped_column(Geometry("POINT", srid=4326), nullable=False)
    wheelchair_boarding: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false"
    )
    has_tactile: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    has_display: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")


class TransitRoute(Base):
    """O linie (tramvai, troleibuz, autobuz)."""

    __tablename__ = "transit_routes"
    __table_args__ = (CheckConstraint(f"type IN {ROUTE_TYPES}", name="route_type"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    gtfs_route_id: Mapped[str] = mapped_column(String(64), unique=True)
    short_name: Mapped[str] = mapped_column(String(20))
    type: Mapped[str] = mapped_column(String(12))


class Vehicle(Base):
    """Dotările unui vehicul și starea lor. ramp_ok / audio_ok devin false la o
    defecțiune raportată."""

    __tablename__ = "vehicles"

    id: Mapped[int] = mapped_column(primary_key=True)
    route_id: Mapped[int] = mapped_column(
        ForeignKey("transit_routes.id", ondelete="CASCADE"), index=True
    )
    label: Mapped[str] = mapped_column(String(40))
    has_ramp: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    low_floor: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    has_audio_announce: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    has_visual_display: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    ramp_ok: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    audio_ok: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")


class Trip(Base):
    """O cursă. service_days = zilele în care circulă (din calendar.txt și
    calendar_dates.txt)."""

    __tablename__ = "trips"

    id: Mapped[int] = mapped_column(primary_key=True)
    gtfs_trip_id: Mapped[str] = mapped_column(String(64), unique=True)
    route_id: Mapped[int] = mapped_column(
        ForeignKey("transit_routes.id", ondelete="CASCADE"), index=True
    )
    vehicle_id: Mapped[int | None] = mapped_column(ForeignKey("vehicles.id", ondelete="SET NULL"))
    service_days: Mapped[list[date]] = mapped_column(ARRAY(Date), default=list)
    headsign: Mapped[str | None] = mapped_column(String(200))


class StopTime(Base):
    """Orarul. arrival_time e în secunde de la miezul nopții, pentru că GTFS permite ore
    peste 24:00 (de exemplu 25:10 pentru o cursă de după miezul nopții)."""

    __tablename__ = "stop_times"

    trip_id: Mapped[int] = mapped_column(
        ForeignKey("trips.id", ondelete="CASCADE"), primary_key=True
    )
    sequence: Mapped[int] = mapped_column(Integer, primary_key=True)
    stop_id: Mapped[int] = mapped_column(
        ForeignKey("transit_stops.id", ondelete="CASCADE"), index=True
    )
    arrival_time: Mapped[int] = mapped_column(Integer)
