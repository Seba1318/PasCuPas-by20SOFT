"""Datele primite și trimise de routerul routes."""

from typing import Any, Literal

from pydantic import BaseModel, Field

LonLat = tuple[float, float]  # [lon, lat], ca în GeoJSON


class PlanIn(BaseModel):
    start: LonLat = Field(examples=[[21.2389, 45.7469]])
    end: LonLat = Field(examples=[[21.2263, 45.7535]])
    mode: Literal["walk", "transit"] = "walk"


class LineString(BaseModel):
    type: Literal["LineString"] = "LineString"
    coordinates: list[LonLat]


class Step(BaseModel):
    instruction: str
    distance_m: float
    coord: LonLat


class RouteWarning(BaseModel):
    type: Literal["incline", "kerb", "rest"]
    text: str
    coord: LonLat


class Avoided(BaseModel):
    """Traseul cel mai scurt, pe care profilul nu îl permite; frontendul îl desenează gri."""

    geometry: LineString
    reason: str
    stairs_at: LonLat | None = None


class PlanOut(BaseModel):
    route: LineString
    length_m: float
    duration_min: int
    steps: list[Step]
    warnings: list[RouteWarning]
    explanation: str | None = None
    extra_m: float = 0
    avoided: Avoided | None = None
    # Doar la transport: mers pe jos → linie → mers pe jos.
    legs: list[dict[str, Any]] | None = None


class CheckIn(BaseModel):
    route: dict[str, Any] = Field(description="Traseul curent, LineString GeoJSON")


class CheckOut(BaseModel):
    blocked: bool
