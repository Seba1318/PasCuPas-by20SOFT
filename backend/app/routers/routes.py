"""Router: routes. Traseul de la A la B după profilul de nevoi și verificarea lui în mers."""

import json
import math
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import GraphEdge, User
from app.routing import cost as costs
from app.routing import transit
from app.routing.astar import Path, astar
from app.routing.graph import Coord, Graph, get_graph
from app.routing.instructions import build_steps, build_warnings, route_coords
from app.routing.snap import OutOfArea, snap
from app.schemas.routes import CheckIn, CheckOut, PlanIn, PlanOut

router = APIRouter(prefix="/routes", tags=["routes"])

# Viteze pentru durata estimată: mers obișnuit și mers cu un profil de mobilitate.
WALK_SPEED_M_S = 1.25
SLOW_SPEED_M_S = 0.9

REASONS = {"stairs": "scările", "kerb": "bordurile prea înalte", "incline": "pantele prea mari"}
AVOIDED_REASONS = {"stairs": "Trepte", "kerb": "Bordură prea înaltă", "incline": "Pantă prea mare"}


def _snap(db: Session, coord: Coord) -> int:
    try:
        return snap(db, *coord).node_id
    except OutOfArea:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "Punctul e în afara zonei acoperite"
        ) from None


def _explain(graph: Graph, chosen: Path, shortest: Path, profile) -> dict:
    """Comparația cu traseul cel mai scurt: cu cât e mai lung și ce evită."""
    extra = round(chosen.length_m(graph) - shortest.length_m(graph))
    if extra < 1 or chosen.steps == shortest.steps:
        return {}
    problems = []  # (motiv, segment) pentru fiecare regulă încălcată de traseul scurt
    for edge_id, direction in shortest.steps:
        reason = costs.violates_rules(graph.edges[edge_id], profile)
        if reason:
            problems.append((reason, graph.edges[edge_id].coords_in(direction)))
    if not problems:
        return {
            "extra_m": extra,
            "explanation": f"Traseu cu {extra} m mai lung, după preferințele tale.",
        }
    names = list(dict.fromkeys(REASONS[r] for r, _ in problems))
    first_reason, first_coords = problems[0]
    return {
        "extra_m": extra,
        "explanation": f"Traseu cu {extra} m mai lung, evită {' și '.join(names)}.",
        "avoided": {
            "geometry": {"type": "LineString", "coordinates": route_coords(graph, shortest)},
            "reason": AVOIDED_REASONS[first_reason],
            "stairs_at": first_coords[len(first_coords) // 2] if first_reason == "stairs" else None,
        },
    }


@router.post("/plan", response_model=PlanOut, response_model_exclude_none=True)
def plan(data: PlanIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Traseul ca GeoJSON, cu pașii, avertismentele și de ce a fost ales. Cu mode=transit:
    mers pe jos + o linie de transport fără schimbări + mers pe jos."""
    graph = get_graph()
    start_node, end_node = _snap(db, data.start), _snap(db, data.end)
    profile, now = user.profile, datetime.now(UTC)
    speed = SLOW_SPEED_M_S if costs.has_mobility_rules(profile) else WALK_SPEED_M_S
    if data.mode == "transit":
        try:
            return transit.plan_transit(
                db, graph, tuple(data.start), tuple(data.end), profile, now, speed
            )
        except transit.NoTransit:
            raise HTTPException(
                status.HTTP_404_NOT_FOUND,
                "Nu am găsit o linie potrivită în următoarele 60 de minute. "
                "Încearcă traseul pe jos.",
            ) from None

    path = astar(graph, start_node, end_node, lambda e, d: costs.edge_cost(e, d, profile, now))
    if path is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, "Nu există traseu care să respecte profilul tău"
        )

    coords = [tuple(data.start), *route_coords(graph, path), tuple(data.end)]
    steps = build_steps(graph, path, tuple(data.start), tuple(data.end))
    length = sum(step["distance_m"] for step in steps)
    result = {
        "route": {"type": "LineString", "coordinates": coords},
        "length_m": length,
        "duration_min": max(1, math.ceil(length / speed / 60)),
        "steps": steps,
        "warnings": build_warnings(graph, path, profile),
    }
    if profile is not None:
        shortest = astar(graph, start_node, end_node, lambda e, d: e.length_m)
        if shortest is not None:
            result |= _explain(graph, path, shortest, profile)
    return result


@router.post("/check", response_model=CheckOut)
def check(data: CheckIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Spune dacă pe traseul curent a apărut un blocaj (clientul întreabă la 30 de secunde)."""
    blocked = get_graph().blocked
    if not blocked:
        return {"blocked": False}
    route = func.ST_SetSRID(func.ST_GeomFromGeoJSON(json.dumps(data.route)), 4326)
    # Mijlocul segmentului blocat la cel mult 2 m de traseu: segmentul e chiar pe traseu, nu
    # doar atinge un capăt al lui.
    middle = func.ST_LineInterpolatePoint(GraphEdge.geom, 0.5)
    hit = db.scalar(
        select(GraphEdge.id)
        .where(GraphEdge.id.in_(blocked))
        .where(func.ST_DWithin(func.geography(middle), func.geography(route), 2))
        .limit(1)
    )
    return {"blocked": hit is not None}
