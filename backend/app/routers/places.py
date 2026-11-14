"""Router: places. Dotările, locațiile și lucrările de pe hartă, cu fișa de accesibilitate,
și căutarea."""

import json
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import bbox_param
from app.models import Place, Work
from app.schemas.places import PlaceCollection, PlaceFeature
from app.services import geocode

router = APIRouter(tags=["places"])

# Citim longitudinea și latitudinea direct din PostGIS, lângă fiecare loc.
_columns = (Place, func.ST_X(Place.geom), func.ST_Y(Place.geom))


def place_feature(place: Place, lon: float, lat: float) -> dict:
    return {
        "type": "Feature",
        "id": place.id,
        "geometry": {"type": "Point", "coordinates": (lon, lat)},
        "properties": {
            "id": place.id,
            "name": place.name,
            "category": place.category,
            "attributes": place.attributes,
        },
    }


@router.get("/places", response_model=PlaceCollection)
def list_places(
    bbox: tuple[float, float, float, float] | None = Depends(bbox_param),
    category: str | None = Query(None, description="De exemplu ramp, lift, toilet, building"),
    limit: int = Query(200, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """Dotări și locații din zona vizibilă pe hartă."""
    query = select(*_columns).order_by(Place.id).limit(limit)
    if bbox:
        # && compară dreptunghiurile și folosește indexul GIST: rapid chiar cu mii de locuri.
        query = query.where(Place.geom.op("&&")(func.ST_MakeEnvelope(*bbox, 4326)))
    if category:
        query = query.where(Place.category == category)
    rows = db.execute(query).all()
    return {"type": "FeatureCollection", "features": [place_feature(*row) for row in rows]}


@router.get("/places/{place_id}", response_model=PlaceFeature)
def get_place(place_id: int, db: Session = Depends(get_db)):
    """Fișa de accesibilitate a unui loc."""
    row = db.execute(select(*_columns).where(Place.id == place_id)).first()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Locul nu există.")
    return place_feature(*row)


@router.get("/search")
def search(q: str = Query("", max_length=100), db: Session = Depends(get_db)):
    """Caută un loc (din baza proprie) sau o adresă (Nominatim), în zona demo.
    `id` e număr pentru locurile proprii și text pentru adrese."""
    return geocode.search(db, q)


def work_feature(work: Work, geojson: str) -> dict:
    return {
        "type": "Feature",
        "id": work.id,
        "geometry": json.loads(geojson),
        "properties": {
            "id": work.id,
            "title": work.title,
            "description": work.description,
            "start_date": work.start_date.isoformat(),
            "end_date": work.end_date.isoformat(),
            "blocks_route": work.blocks_route,
        },
    }


@router.get("/works")
def list_works(
    bbox: tuple[float, float, float, float] | None = Depends(bbox_param),
    db: Session = Depends(get_db),
):
    """Lucrările care nu s-au terminat încă, desenate pe hartă ca linii sau zone hașurate.
    Le publică adminii din /admin/works."""
    query = select(Work, func.ST_AsGeoJSON(Work.geom)).where(Work.end_date >= date.today())
    if bbox:
        query = query.where(Work.geom.op("&&")(func.ST_MakeEnvelope(*bbox, 4326)))
    features = [
        work_feature(work, geojson) for work, geojson in db.execute(query.order_by(Work.start_date))
    ]
    return {"type": "FeatureCollection", "features": features}
