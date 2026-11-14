"""Deduplicarea rapoartelor (planul 20SOFT · Fluxul unui raport, pasul 3).

Duplicatele se caută după coordonate, nu după text: „Str. Mărășești”, „Mărășești 5” și „lângă
cantină” pot fi același loc. Un raport din aceeași categorie la cel mult 25 m, cu status
in_lucru sau respins în ultimele 30 de zile, înseamnă că noul raport e o confirmare.
"""

from datetime import datetime, timedelta

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from app.models import Report

RADIUS_M = 25
REJECTED_WINDOW = timedelta(days=30)


def find_duplicate(db: Session, category: str, lon: float, lat: float, now: datetime):
    point = func.ST_SetSRID(func.ST_MakePoint(lon, lat), 4326)
    distance = func.ST_Distance(func.geography(Report.geom), func.geography(point))
    return db.scalar(
        select(Report)
        .where(
            Report.category == category,
            Report.geom.is_not(None),
            # ST_DWithin pe geography = „la cel mult 25 de metri”, cu index.
            func.ST_DWithin(func.geography(Report.geom), func.geography(point), RADIUS_M),
            or_(
                Report.status == "in_lucru",
                and_(Report.status == "respins", Report.created_at >= now - REJECTED_WINDOW),
            ),
        )
        .order_by(distance)
        .limit(1)
    )
