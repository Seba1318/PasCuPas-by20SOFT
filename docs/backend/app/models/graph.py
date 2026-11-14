"""Graful de străzi: graph_nodes, graph_edges, route_blocks.

Coloanele geom sunt geometry în SRID 4326 (longitudine, latitudine). GeoAlchemy2 creează
automat câte un index GIST pentru fiecare. Distanțele în metri se calculează cu cast la
geography, de exemplu ST_DWithin(a.geom::geography, b.geom::geography, 25).
"""

from datetime import datetime

from geoalchemy2 import Geometry
from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base

SURFACES = ("asphalt", "paving", "gravel")  # penalizare s: 0, 0,5, 1
BLOCK_SOURCES = ("report", "work", "admin")


class GraphNode(Base):
    """Intersecții și capete de segment."""

    __tablename__ = "graph_nodes"

    id: Mapped[int] = mapped_column(primary_key=True)
    osm_id: Mapped[int | None] = mapped_column(BigInteger, index=True)
    geom = mapped_column(Geometry("POINT", srid=4326), nullable=False)


class GraphEdge(Base):
    """Un segment de trotuar sau o trecere. Atributele de accesibilitate sunt fictive.

    incline_pct are semn, în sensul from_node → to_node; în sens invers se folosește
    −incline_pct.
    """

    __tablename__ = "graph_edges"
    __table_args__ = (CheckConstraint(f"surface IN {SURFACES}", name="edge_surface"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    from_node: Mapped[int] = mapped_column(
        ForeignKey("graph_nodes.id", ondelete="CASCADE"), index=True
    )
    to_node: Mapped[int] = mapped_column(
        ForeignKey("graph_nodes.id", ondelete="CASCADE"), index=True
    )
    geom = mapped_column(Geometry("LINESTRING", srid=4326), nullable=False)
    name: Mapped[str | None] = mapped_column(String(200))  # numele străzii din OSM
    length_m: Mapped[float] = mapped_column(Float)
    has_stairs: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    kerb_height_cm: Mapped[float] = mapped_column(Float, default=0, server_default="0")
    incline_pct: Mapped[float] = mapped_column(Float, default=0, server_default="0")
    surface: Mapped[str] = mapped_column(String(10), default="asphalt", server_default="asphalt")
    width_cm: Mapped[int | None] = mapped_column(Integer)
    has_tactile: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    has_audio_signal: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    is_crossing: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    is_lit: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    has_bench: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")


class RouteBlock(Base):
    """Ce segmente sunt blocate acum și de ce. Un blocaj încheiat primește active_until;
    rândul rămâne pentru istoric."""

    __tablename__ = "route_blocks"
    __table_args__ = (CheckConstraint(f"source_type IN {BLOCK_SOURCES}", name="block_source"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    edge_id: Mapped[int] = mapped_column(
        ForeignKey("graph_edges.id", ondelete="CASCADE"), index=True
    )
    source_type: Mapped[str] = mapped_column(String(10))
    source_id: Mapped[int | None] = mapped_column(Integer)
    active_from: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    active_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
