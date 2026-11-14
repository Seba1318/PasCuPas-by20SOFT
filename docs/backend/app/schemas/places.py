"""Locurile de pe hartă, ca GeoJSON.

În JSON coordonatele sunt mereu [lon, lat] (standardul GeoJSON). Leaflet folosește
[lat, lon]; conversia se face doar în frontend, în src/components/map.
"""

from typing import Any, Literal

from pydantic import BaseModel


class PointGeometry(BaseModel):
    type: Literal["Point"] = "Point"
    coordinates: tuple[float, float]  # [lon, lat]


class PlaceProperties(BaseModel):
    id: int
    name: str
    category: str
    attributes: dict[str, Any]


class PlaceFeature(BaseModel):
    type: Literal["Feature"] = "Feature"
    id: int
    geometry: PointGeometry
    properties: PlaceProperties


class PlaceCollection(BaseModel):
    type: Literal["FeatureCollection"] = "FeatureCollection"
    features: list[PlaceFeature]
