"""Tabelele bazei de date (17, în cinci zone).

Importăm aici toate modelele, ca Base.metadata să le cunoască pe toate: Alembic și
testele citesc schema de acolo.
"""

from app.models.graph import GraphEdge, GraphNode, RouteBlock
from app.models.places import Place, Work
from app.models.reports import Project, Report, ReportConfirmation
from app.models.transit import StopTime, TransitRoute, TransitStop, Trip, Vehicle
from app.models.users import AccessibilityProfile, Institution, TrustEvent, User

__all__ = [
    "AccessibilityProfile",
    "GraphEdge",
    "GraphNode",
    "Institution",
    "Place",
    "Project",
    "Report",
    "ReportConfirmation",
    "RouteBlock",
    "StopTime",
    "TransitRoute",
    "TransitStop",
    "Trip",
    "TrustEvent",
    "User",
    "Vehicle",
    "Work",
]
