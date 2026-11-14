"""Costul unui segment (planul 20SOFT · Costul unui segment).

    c(e) = L · (1 + w_p · max(0, |p| − p_conf) + w_s · s + w_b · b / b_max) · multiplicatori

L = lungimea în metri, p = panta în %, p_conf = jumătate din panta maximă din profil,
s = penalizarea suprafeței, b = înălțimea bordurii, b_max = bordura maximă din profil.

Reguli obligatorii încălcate → cost infinit (A* nu folosește segmentul). Toți termenii și
multiplicatorii sunt ≥ 0, respectiv ≥ 1, deci costul e mereu cel puțin lungimea: altfel
euristica din astar.py n-ar mai garanta traseul optim.

Funcție pură: nu citește din bază, deci se testează ușor (tests/test_cost.py).
"""

import math
from datetime import datetime
from zoneinfo import ZoneInfo

from app.routing.graph import Edge

INFINITE = math.inf

# Valorile inițiale din plan, de reglat prin teste.
W_P = 0.05  # fiecare procent de pantă peste p_conf adaugă 5%
W_S = 0.4  # suprafața; se dublează cu avoid_rough_surface
W_S_ROUGH = 0.8
W_B = 0.3  # bordura, raportată la b_max
SURFACE_PENALTY = {"asphalt": 0.0, "paving": 0.5, "gravel": 1.0}

TACTILE_FACTOR = 1.25  # prefer_tactile: segment fără ghidaj tactil
AUDIO_FACTOR = 1.25  # prefer_audio_signals: trecere fără semnal sonor
COMPLEX_JUNCTION_FACTOR = 1.2  # simplified_mode: intrare într-o intersecție cu 4+ străzi
COMPLEX_JUNCTION_DEGREE = 4
DARK_FACTOR = 1.2  # prefer_lit: segment neiluminat, între 19:00 și 07:00

LOCAL_TIME = ZoneInfo("Europe/Bucharest")


def _get(profile, name: str, default=None):
    return getattr(profile, name, default) if profile is not None else default


def has_mobility_rules(profile) -> bool:
    """Profil de mobilitate (scaun cu rotile, cărucior, vârstnici): contează panta,
    suprafața și bordurile. Fără astfel de reguli, traseul e cel mai scurt."""
    return bool(
        _get(profile, "avoid_stairs")
        or _get(profile, "avoid_rough_surface")
        or _get(profile, "max_kerb_cm") is not None
        or _get(profile, "max_incline_pct") is not None
    )


def violates_rules(edge: Edge, profile) -> str | None:
    """Ce regulă obligatorie încalcă segmentul: "stairs", "kerb", "incline" sau None."""
    if _get(profile, "avoid_stairs") and edge.has_stairs:
        return "stairs"
    max_kerb = _get(profile, "max_kerb_cm")
    if max_kerb is not None and edge.kerb_height_cm > max_kerb:
        return "kerb"
    max_incline = _get(profile, "max_incline_pct")
    if max_incline is not None and abs(edge.incline_pct) > max_incline:
        return "incline"
    return None


def is_night(now: datetime) -> bool:
    hour = now.astimezone(LOCAL_TIME).hour
    return hour >= 19 or hour < 7


def edge_cost(edge: Edge, direction: int, profile, now: datetime) -> float:
    """Costul parcurgerii segmentului în sensul `direction` (+1 sau −1)."""
    if profile is None:
        return edge.length_m
    if violates_rules(edge, profile):
        return INFINITE

    penalty = 0.0
    if has_mobility_rules(profile):
        max_incline = _get(profile, "max_incline_pct")
        if max_incline is not None:
            # Valoarea absolută: o coborâre abruptă e la fel de grea ca o urcare.
            p_conf = max_incline / 2
            penalty += W_P * max(0.0, abs(edge.incline_pct) - p_conf)
        w_s = W_S_ROUGH if _get(profile, "avoid_rough_surface") else W_S
        penalty += w_s * SURFACE_PENALTY.get(edge.surface, 0.0)
        b_max = _get(profile, "max_kerb_cm")
        if b_max:  # None sau 0: fără termen (o bordură peste 0 cm e deja interzisă)
            penalty += W_B * edge.kerb_height_cm / b_max

    cost = edge.length_m * (1 + penalty)

    # Multiplicatorii se aplică după formulă și sunt toți ≥ 1.
    if _get(profile, "prefer_tactile") and not edge.has_tactile:
        cost *= TACTILE_FACTOR
    if _get(profile, "prefer_audio_signals") and edge.is_crossing and not edge.has_audio_signal:
        cost *= AUDIO_FACTOR
    if _get(profile, "simplified_mode") and edge.entry_degree(direction) >= COMPLEX_JUNCTION_DEGREE:
        cost *= COMPLEX_JUNCTION_FACTOR
    if _get(profile, "prefer_lit") and not edge.is_lit and is_night(now):
        cost *= DARK_FACTOR
    return cost
