"""Transportul public (planul 20SOFT · Transportul public).

Prima versiune combină mersul pe jos cu o singură linie, fără schimbări:
1. stațiile accesibile la cel mult 500 m de start și de destinație, cu mersul calculat cu A*;
2. din stop_times, cursele care trec prin ambele stații, în ordinea corectă, în următoarele
   60 de minute;
3. doar cursele cu vehicul care are dotările cerute și funcționale;
4. ordonate după timpul total: mers + așteptare + călătorie + mers până la destinație.

Orele din GTFS sunt secunde de la miezul nopții, în ora României. O cursă care a pornit ieri
poate avea ore peste 24:00, de aceea căutăm și în serviciul de ieri, cu 86400 de secunde în plus.
"""

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta

from sqlalchemy import and_, any_, func, literal, or_, select
from sqlalchemy.orm import Session, aliased

from app import config
from app.models import StopTime, TransitRoute, TransitStop, Trip, Vehicle
from app.routing.astar import Path, astar, haversine_m
from app.routing.cost import edge_cost
from app.routing.graph import Coord, Graph
from app.routing.instructions import route_coords
from app.routing.snap import OutOfArea, snap

WALK_RADIUS_M = 500
WINDOW = timedelta(minutes=60)
MAX_STOPS = 6  # câte stații încercăm la fiecare capăt
DAY = 86_400
KIND = {
    "tram": ("Tramvai", "tramvaiul"),
    "trolleybus": ("Troleibuz", "troleibuzul"),
    "bus": ("Autobuz", "autobuzul"),
}


class NoTransit(Exception):
    """Nicio linie potrivită în următoarele 60 de minute."""


def needs(profile) -> dict[str, bool]:
    """Ce dotări cere profilul: rampă funcțională (mobilitate), anunțuri sonore (vedere)."""
    return {
        "ramp": bool(
            getattr(profile, "avoid_stairs", False)
            or getattr(profile, "max_kerb_cm", None) is not None
        ),
        "audio": bool(
            getattr(profile, "prefer_audio_signals", False)
            or getattr(profile, "prefer_tactile", False)
        ),
    }


def vehicle_ok(vehicle: Vehicle | None, required: dict[str, bool]) -> bool:
    if vehicle is None:
        return not any(required.values())
    if required["ramp"] and not (vehicle.has_ramp and vehicle.ramp_ok):
        return False
    if required["audio"] and not (vehicle.has_audio_announce and vehicle.audio_ok):
        return False
    return True


def vehicle_json(vehicle: Vehicle | None) -> dict | None:
    if vehicle is None:
        return None
    fields = ("has_ramp", "ramp_ok", "low_floor", "has_audio_announce", "audio_ok")
    return {
        "id": vehicle.id,
        "label": vehicle.label,
        "has_visual_display": vehicle.has_visual_display,
        **{f: getattr(vehicle, f) for f in fields},
    }


# --- Orarul --------------------------------------------------------------------------------


def local_now(now: datetime) -> tuple[date, int]:
    """Ziua de azi și secunda de la miezul nopții, în ora României."""
    local = now.astimezone(config.LOCAL_TIME)
    return local.date(), local.hour * 3600 + local.minute * 60 + local.second


def when(day: date, seconds: int) -> datetime:
    """Ziua de serviciu + secundele din GTFS → moment exact (merge și pentru 25:10)."""
    midnight = datetime.combine(day, time(), tzinfo=config.LOCAL_TIME)
    return midnight + timedelta(seconds=seconds)


def running(stop_time, now: datetime, window: timedelta = WINDOW):
    """Condiția SQL: cursa circulă și oprește în fereastra [acum, acum + window]."""
    today, secs = local_now(now)
    yesterday, span = today - timedelta(days=1), int(window.total_seconds())
    is_today = and_(
        literal(today) == any_(Trip.service_days), stop_time.arrival_time.between(secs, secs + span)
    )
    is_yesterday = and_(
        literal(yesterday) == any_(Trip.service_days),
        stop_time.arrival_time.between(secs + DAY, secs + DAY + span),
    )
    return or_(is_today, is_yesterday)


def service_day(stop_time_seconds: int, now: datetime) -> date:
    """Ziua de serviciu a unei opriri găsite cu `running`: ieri, dacă ora e peste 24:00."""
    today, secs = local_now(now)
    return today - timedelta(days=1) if stop_time_seconds >= secs + DAY else today


def arrivals(db: Session, stop_id: int, now: datetime, limit: int = 10) -> list[dict]:
    condition = running(StopTime, now)
    rows = db.execute(
        select(StopTime.arrival_time, Trip, TransitRoute, Vehicle)
        .join(Trip, Trip.id == StopTime.trip_id)
        .join(TransitRoute, TransitRoute.id == Trip.route_id)
        .outerjoin(Vehicle, Vehicle.id == Trip.vehicle_id)
        .where(StopTime.stop_id == stop_id, condition)
        .order_by(StopTime.arrival_time)
        .limit(limit * 2)
    ).all()
    result = []
    for seconds, trip, route, vehicle in rows:
        at = when(service_day(seconds, now), seconds)
        result.append(
            {
                "trip_id": trip.id,
                "route": route.short_name,
                "type": KIND[route.type][0],
                "headsign": trip.headsign or "",
                "arrival_time": at.isoformat(),
                "vehicle": vehicle_json(vehicle),
            }
        )
    return sorted(result, key=lambda r: r["arrival_time"])[:limit]


# --- Traseul cu transport -----------------------------------------------------------------


@dataclass
class Walk:
    coords: list[Coord]
    length_m: float
    path: Path


def walk(db: Session, graph: Graph, a: Coord, b: Coord, profile, now: datetime) -> Walk | None:
    try:
        start, goal = snap(db, *a).node_id, snap(db, *b).node_id
    except OutOfArea:
        return None
    path = astar(graph, start, goal, lambda e, d: edge_cost(e, d, profile, now))
    if path is None:
        return None
    coords = [a, *route_coords(graph, path), b]
    length = sum(haversine_m(p, q) for p, q in zip(coords, coords[1:], strict=False))
    return Walk(coords=coords, length_m=length, path=path)


def nearby_stops(db: Session, coord: Coord, accessible_only: bool):
    point = func.ST_SetSRID(func.ST_MakePoint(*coord), 4326)
    distance = func.ST_Distance(func.geography(TransitStop.geom), func.geography(point))
    query = (
        select(TransitStop, func.ST_X(TransitStop.geom), func.ST_Y(TransitStop.geom))
        .where(
            func.ST_DWithin(func.geography(TransitStop.geom), func.geography(point), WALK_RADIUS_M)
        )
        .order_by(distance)
        .limit(MAX_STOPS)
    )
    if accessible_only:
        query = query.where(TransitStop.wheelchair_boarding.is_(True))
    return db.execute(query).all()


def plan_transit(
    db: Session, graph: Graph, start: Coord, end: Coord, profile, now: datetime, speed: float
) -> dict:
    required = needs(profile)
    # Mersul pe jos până la fiecare stație apropiată, cu A* și profilul utilizatorului.
    boards, alights = {}, {}
    for stop, lon, lat in nearby_stops(db, start, required["ramp"]):
        w = walk(db, graph, start, (lon, lat), profile, now)
        if w:
            boards[stop.id] = (stop, w)
    for stop, lon, lat in nearby_stops(db, end, required["ramp"]):
        w = walk(db, graph, (lon, lat), end, profile, now)
        if w:
            alights[stop.id] = (stop, w)
    if not boards or not alights:
        raise NoTransit

    board, alight = aliased(StopTime), aliased(StopTime)
    condition = running(board, now)
    rows = db.execute(
        select(board, alight, Trip, TransitRoute, Vehicle)
        .join(alight, and_(alight.trip_id == board.trip_id, alight.sequence > board.sequence))
        .join(Trip, Trip.id == board.trip_id)
        .join(TransitRoute, TransitRoute.id == Trip.route_id)
        .outerjoin(Vehicle, Vehicle.id == Trip.vehicle_id)
        .where(board.stop_id.in_(boards), alight.stop_id.in_(alights), condition)
    ).all()

    best = None
    for b, a, trip, route, vehicle in rows:
        if not vehicle_ok(vehicle, required):
            continue
        day = service_day(b.arrival_time, now)
        departure, arrival = when(day, b.arrival_time), when(day, a.arrival_time)
        walk_to = boards[b.stop_id][1]
        if now + timedelta(seconds=walk_to.length_m / speed) > departure:
            continue  # nu ajungi la timp în stație
        finish = arrival + timedelta(seconds=alights[a.stop_id][1].length_m / speed)
        if best is None or finish < best[0]:
            best = (finish, b, a, trip, route, vehicle, departure, arrival)
    if best is None:
        raise NoTransit

    finish, b, a, trip, route, vehicle, departure, arrival = best
    board_stop, walk_to = boards[b.stop_id]
    alight_stop, walk_from = alights[a.stop_id]
    ride = db.execute(
        select(func.ST_X(TransitStop.geom), func.ST_Y(TransitStop.geom))
        .join(StopTime, StopTime.stop_id == TransitStop.id)
        .where(StopTime.trip_id == trip.id, StopTime.sequence.between(b.sequence, a.sequence))
        .order_by(StopTime.sequence)
    ).all()
    ride_coords = [(lon, lat) for lon, lat in ride]
    label, article = KIND[route.type]
    minutes = lambda seconds: max(1, round(seconds / 60))  # noqa: E731
    legs = [
        {
            "type": "walk",
            "distance_m": round(walk_to.length_m),
            "duration_min": minutes(walk_to.length_m / speed),
            "to_name": f"Stația {board_stop.name}",
            "geometry": {"type": "LineString", "coordinates": walk_to.coords},
        },
        {
            "type": "transit",
            "line": route.short_name,
            "vehicle_type": label,
            "headsign": trip.headsign or "",
            "stops_count": len(ride_coords) - 1,
            "duration_min": minutes((arrival - departure).total_seconds()),
            "board_stop": f"Stația {board_stop.name}",
            "alight_stop": f"Stația {alight_stop.name}",
            "departure": departure.isoformat(),
            "vehicle": vehicle_json(vehicle),
            "geometry": {"type": "LineString", "coordinates": ride_coords},
        },
        {
            "type": "walk",
            "distance_m": round(walk_from.length_m),
            "duration_min": minutes(walk_from.length_m / speed),
            "to_name": "destinație",
            "geometry": {"type": "LineString", "coordinates": walk_from.coords},
        },
    ]
    ride_length = sum(haversine_m(p, q) for p, q in zip(ride_coords, ride_coords[1:], strict=False))
    reasons = []
    if required["ramp"]:
        reasons.append("stații accesibile și vehicule cu rampă funcțională")
    if required["audio"]:
        reasons.append("vehicule cu anunțuri sonore funcționale")
    return {
        "route": {
            "type": "LineString",
            "coordinates": walk_to.coords + ride_coords + walk_from.coords,
        },
        "length_m": round(walk_to.length_m + ride_length + walk_from.length_m),
        "duration_min": minutes((finish - now).total_seconds()),
        "legs": legs,
        "steps": [
            {
                "instruction": f"Mergi pe jos până la stația {board_stop.name}",
                "distance_m": round(walk_to.length_m),
                "coord": list(start),
            },
            {
                "instruction": f"Urcă în {article} {route.short_name} spre {trip.headsign}",
                "distance_m": 0,
                "coord": list(ride_coords[0]),
            },
            {
                "instruction": f"Coboară la stația {alight_stop.name}",
                "distance_m": round(walk_from.length_m),
                "coord": list(ride_coords[-1]),
            },
            {"instruction": "Ai ajuns la destinație", "distance_m": 0, "coord": list(end)},
        ],
        "warnings": [],
        "explanation": f"Am ales doar {' și '.join(reasons)}." if reasons else None,
    }
