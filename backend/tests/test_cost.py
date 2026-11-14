"""Funcția de cost (planul 20SOFT · Costul unui segment și Exemplul lucrat)."""

import math
from datetime import UTC, datetime
from types import SimpleNamespace

from app.routing.cost import edge_cost
from app.routing.graph import Edge

DAY = datetime(2026, 11, 15, 10, 0, tzinfo=UTC)  # 12:00 la Timișoara
NIGHT = datetime(2026, 11, 15, 20, 0, tzinfo=UTC)  # 22:00 la Timișoara


def edge(length=100.0, **attrs) -> Edge:
    return Edge(id=1, from_node=1, to_node=2, length_m=length, coords=[(0, 0), (0, 0)], **attrs)


def profile(**fields):
    base = dict(
        avoid_stairs=False,
        max_kerb_cm=None,
        max_incline_pct=None,
        avoid_rough_surface=False,
        prefer_tactile=False,
        prefer_audio_signals=False,
        simplified_mode=False,
        prefer_lit=False,
        needs_rest_every_m=None,
    )
    return SimpleNamespace(**{**base, **fields})


# Utilizatorul din exemplul lucrat: scaun cu rotile, bordură maximă 3 cm (w_s = 0,4).
WHEELCHAIR = profile(avoid_stairs=True, max_kerb_cm=3)


# --- Cazurile obligatorii din plan --------------------------------------------------------


def test_worked_example_a_to_c_paving_is_144():
    assert edge_cost(edge(120, surface="paving"), 1, WHEELCHAIR, DAY) == 144


def test_worked_example_c_to_d_kerb_2cm_is_108():
    assert edge_cost(edge(90, kerb_height_cm=2), 1, WHEELCHAIR, DAY) == 108


def test_stairs_with_avoid_stairs_is_infinite():
    assert math.isinf(edge_cost(edge(has_stairs=True), 1, WHEELCHAIR, DAY))


def test_kerb_4cm_with_max_3cm_is_infinite():
    assert math.isinf(edge_cost(edge(kerb_height_cm=4), 1, WHEELCHAIR, DAY))


# --- Restul regulilor ---------------------------------------------------------------------


def test_without_profile_cost_is_length():
    steep = edge(80, has_stairs=True, incline_pct=12, surface="gravel")
    assert edge_cost(steep, 1, None, DAY) == 80
    # Nimic bifat: traseul cel mai scurt, fără penalizări.
    assert edge_cost(steep, 1, profile(), DAY) == 80


def test_incline_over_max_is_infinite_in_both_directions():
    p = profile(max_incline_pct=6)
    assert math.isinf(edge_cost(edge(incline_pct=8), 1, p, DAY))
    assert math.isinf(edge_cost(edge(incline_pct=8), -1, p, DAY))


def test_incline_above_comfortable_is_penalised_downhill_too():
    p = profile(max_incline_pct=6)  # p_conf = 3
    expected = 100 * (1 + 0.05 * 2)  # 5 % față de p_conf = 3 %: 2 puncte peste
    up = edge_cost(edge(100, incline_pct=5), 1, p, DAY)
    # incline_pct negativ = coborâre în sensul from → to; costă la fel ca urcarea.
    down = edge_cost(edge(100, incline_pct=-5), 1, p, DAY)
    back = edge_cost(edge(100, incline_pct=5), -1, p, DAY)
    assert up == down == back == expected


def test_avoid_rough_surface_doubles_w_s():
    p = profile(avoid_stairs=True, avoid_rough_surface=True)
    assert edge_cost(edge(100, surface="gravel"), 1, p, DAY) == 180


def test_preference_multipliers():
    tactile = profile(prefer_tactile=True)
    assert edge_cost(edge(100), 1, tactile, DAY) == 125
    assert edge_cost(edge(100, has_tactile=True), 1, tactile, DAY) == 100

    audio = profile(prefer_audio_signals=True)
    assert edge_cost(edge(100, is_crossing=True), 1, audio, DAY) == 125
    assert edge_cost(edge(100), 1, audio, DAY) == 100  # nu e trecere


def test_simplified_mode_penalises_entering_big_junctions():
    p = profile(simplified_mode=True)
    big = edge(100, to_degree=5, from_degree=2)
    assert edge_cost(big, 1, p, DAY) == 120  # intră în intersecția cu 5 străzi
    assert edge_cost(big, -1, p, DAY) == 100  # în sens invers intră în cea cu 2


def test_prefer_lit_only_at_night():
    p = profile(prefer_lit=True)
    dark = edge(100, is_lit=False)
    assert edge_cost(dark, 1, p, DAY) == 100
    assert edge_cost(dark, 1, p, NIGHT) == 120


def test_cost_is_never_below_length():
    p = profile(
        avoid_stairs=True,
        max_kerb_cm=6,
        max_incline_pct=8,
        prefer_tactile=True,
        simplified_mode=True,
    )
    for e in [edge(50), edge(50, has_tactile=True), edge(50, incline_pct=-2, surface="paving")]:
        assert edge_cost(e, 1, p, DAY) >= e.length_m
