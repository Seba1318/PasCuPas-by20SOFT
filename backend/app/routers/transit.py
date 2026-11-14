"""Router: transit. Stațiile, liniile și sosirile (orar real din GTFS, dotări fictive).
Tabelele le umple scripts/import_gtfs.py."""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import bbox_param
from app.models import StopTime, TransitRoute, TransitStop, Trip
from app.routing import transit
from app.routing.transit import KIND

router = APIRouter(prefix="/transit", tags=["transit"])


def stop_modes(db: Session, stop_ids: list[int]) -> dict[int, list[str]]:
    """Ce tipuri de linii opresc în fiecare stație, după orar: [„autobuz”, „troleibuz”]."""
    rows = db.execute(
        select(StopTime.stop_id, TransitRoute.type)
        .join(Trip, Trip.id == StopTime.trip_id)
        .join(TransitRoute, TransitRoute.id == Trip.route_id)
        .where(StopTime.stop_id.in_(stop_ids))
        .distinct()
    )
    modes: dict[int, list[str]] = {}
    for stop_id, kind in sorted(rows, key=lambda row: ORDER.index(row[1])):
        modes.setdefault(stop_id, []).append(KIND[kind][0].lower())
    return modes


ORDER = ["tram", "trolleybus", "bus"]


@router.get("/stops")
def list_stops(
    bbox: tuple[float, float, float, float] | None = Depends(bbox_param),
    db: Session = Depends(get_db),
):
    """Stațiile din zona vizibilă pe hartă, cu dotările lor."""
    query = select(TransitStop, func.ST_X(TransitStop.geom), func.ST_Y(TransitStop.geom))
    if bbox:
        query = query.where(TransitStop.geom.op("&&")(func.ST_MakeEnvelope(*bbox, 4326)))
    rows = db.execute(query.order_by(TransitStop.id)).all()
    modes = stop_modes(db, [stop.id for stop, _, _ in rows])
    features = [
        {
            "type": "Feature",
            "id": stop.id,
            "geometry": {"type": "Point", "coordinates": [lon, lat]},
            "properties": {
                "id": stop.id,
                "name": stop.name,
                "wheelchair_boarding": stop.wheelchair_boarding,
                "has_tactile": stop.has_tactile,
                "has_display": stop.has_display,
                "modes": modes.get(stop.id, []),
            },
        }
        for stop, lon, lat in rows
    ]
    return {"type": "FeatureCollection", "features": features}


@router.get("/stops/{stop_id}/arrivals")
def stop_arrivals(stop_id: int, db: Session = Depends(get_db)):
    """Următoarele sosiri din orar (fără poziție în timp real), cu dotările vehiculelor."""
    if db.get(TransitStop, stop_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Stația nu există.")
    return transit.arrivals(db, stop_id, datetime.now(UTC))


@router.get("/routes")
def list_routes(db: Session = Depends(get_db)):
    """Liniile de tramvai, troleibuz și autobuz care trec prin zona demo."""
    routes = db.scalars(select(TransitRoute).order_by(TransitRoute.type, TransitRoute.short_name))
    return [
        {"id": r.id, "short_name": r.short_name, "type": KIND[r.type][0].lower()} for r in routes
    ]
