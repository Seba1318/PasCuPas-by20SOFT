"""/routes/plan și /routes/check pe graful din exemplul lucrat, salvat în baza de test.

A ──100 m── B
│           │ 80 m, trepte
120 m,      D
pavaj       │
C ──90 m, bordură 2 cm┘
"""

import math
from datetime import UTC, datetime

import pytest

from app.models import AccessibilityProfile
from app.routing.graph import load_graph, set_graph
from tests.helpers import M_PER_DEG_LAT, add_edge, add_node, auth, make_user

LON, LAT = 21.23, 45.75
M_PER_DEG_LON = M_PER_DEG_LAT * math.cos(math.radians(LAT))


def at(east_m: float, north_m: float) -> tuple[float, float]:
    return LON + east_m / M_PER_DEG_LON, LAT + north_m / M_PER_DEG_LAT


A, B, C, D = at(0, 0), at(100, 0), at(10, -80), at(100, -80)


@pytest.fixture
def graph(db):
    a, b, c, d = (add_node(db, *p) for p in (A, B, C, D))
    edges = {
        "AB": add_edge(db, a, b, 100),
        "BD": add_edge(db, b, d, 80, has_stairs=True),
        "AC": add_edge(db, a, c, 120, surface="paving"),
        "CD": add_edge(db, c, d, 90, kerb_height_cm=2),
    }
    db.commit()
    graph = load_graph(db, datetime.now(UTC))
    set_graph(graph)
    yield graph, edges
    set_graph(None)


def user_with(db, **profile):
    user = make_user(db)
    if profile:
        db.add(AccessibilityProfile(user_id=user.id, **profile))
        db.commit()
    return auth(user)


def plan(client, headers, start=A, end=D, mode="walk"):
    return client.post(
        "/routes/plan", json={"start": start, "end": end, "mode": mode}, headers=headers
    )


def test_wheelchair_route_avoids_stairs_and_explains_why(client, db, graph):
    res = plan(client, user_with(db, avoid_stairs=True, max_kerb_cm=3))
    assert res.status_code == 200
    body = res.json()
    assert body["length_m"] == 210
    assert body["route"]["type"] == "LineString"
    assert body["route"]["coordinates"][0] == list(A)
    assert body["route"]["coordinates"][-1] == list(D)
    assert body["explanation"] == "Traseu cu 30 m mai lung, evită scările."
    assert body["extra_m"] == 30
    assert body["avoided"]["reason"] == "Trepte"
    assert body["avoided"]["stairs_at"] is not None
    assert body["steps"][0]["instruction"].startswith("Pornește spre")
    assert body["steps"][-1]["instruction"] == "Ai ajuns la destinație"
    assert sum(step["distance_m"] for step in body["steps"]) == 210


def test_without_profile_route_is_the_shortest(client, db, graph):
    body = plan(client, user_with(db)).json()
    assert body["length_m"] == 180
    assert "explanation" not in body and "avoided" not in body


def test_turns_appear_in_steps(client, db, graph):
    body = plan(client, user_with(db)).json()  # A → B (spre est), apoi B → D (spre sud)
    assert [s["instruction"] for s in body["steps"]] == [
        "Pornește spre est",
        "Virează la dreapta",
        "Ai ajuns la destinație",
    ]


def test_all_roads_blocked_is_404(client, db, graph):
    g, edges = graph
    g.blocked = {edges["AB"].id, edges["AC"].id}
    res = plan(client, user_with(db))
    assert res.status_code == 404
    assert res.json()["detail"] == "Nu există traseu care să respecte profilul tău"


def test_no_route_for_profile_is_404(client, db, graph):
    # Bordura de 2 cm depășește 1 cm, iar pe cealaltă parte sunt trepte.
    res = plan(client, user_with(db, avoid_stairs=True, max_kerb_cm=1))
    assert res.status_code == 404


def test_point_80m_away_is_422(client, db, graph):
    res = plan(client, user_with(db), start=at(50, 80 + 80))
    assert res.status_code == 422
    assert res.json()["detail"] == "Punctul e în afara zonei acoperite"


def test_route_requires_login(client, graph):
    assert client.post("/routes/plan", json={"start": A, "end": D}).status_code == 401


def test_transit_without_lines_is_404(client, db, graph):
    res = plan(client, user_with(db), mode="transit")
    assert res.status_code == 404
    assert "Nu am găsit o linie potrivită" in res.json()["detail"]


def test_kerb_warning_for_wheelchair(client, db, graph):
    body = plan(client, user_with(db, avoid_stairs=True, max_kerb_cm=3)).json()
    # Bordura de 2 cm e permisă (maxim 3), dar trece de jumătate: merită știută.
    assert any(w["type"] == "kerb" for w in body["warnings"])


def test_check_reports_a_new_block_on_the_route(client, db, graph):
    g, edges = graph
    headers = user_with(db, avoid_stairs=True, max_kerb_cm=3)
    route = plan(client, headers).json()["route"]
    assert client.post("/routes/check", json={"route": route}, headers=headers).json() == {
        "blocked": False
    }
    g.blocked = {edges["AB"].id}  # blocaj pe alt drum: traseul nostru nu e afectat
    assert client.post("/routes/check", json={"route": route}, headers=headers).json() == {
        "blocked": False
    }
    g.blocked = {edges["CD"].id}
    assert client.post("/routes/check", json={"route": route}, headers=headers).json() == {
        "blocked": True
    }


def test_warnings_use_decimal_comma_and_skip_short_slopes(db):
    from types import SimpleNamespace

    from app.routing.astar import Path
    from app.routing.graph import Edge, Graph
    from app.routing.instructions import build_warnings

    graph = Graph()
    for node in range(5):
        graph.add_node(node, (21.23 + node * 0.001, 45.75))
    for i, (length, incline) in enumerate([(40, 4.5), (8, 5.9), (30, 5.2), (25, 3.4)]):
        graph.add_edge(
            Edge(i, i, i + 1, length, [graph.nodes[i], graph.nodes[i + 1]], incline_pct=incline)
        )
    path = Path(nodes=[0, 1, 2, 3, 4], steps=[(i, 1) for i in range(4)], cost=0)
    profile = SimpleNamespace(avoid_stairs=True, max_incline_pct=6, max_kerb_cm=3)
    texts = [w["text"] for w in build_warnings(graph, path, profile)]
    # 8 m e prea scurt; restul, de la cea mai abruptă la cea mai lină.
    assert texts == [
        "Urcare cu pantă de 5,2 % pe 30 m",
        "Urcare cu pantă de 4,5 % pe 40 m",
        "Urcare cu pantă de 3,4 % pe 25 m",
    ]


def test_tiny_turns_and_double_crossings_are_merged():
    from app.routing.instructions import compact

    steps = [
        {"instruction": "Pornește spre est", "distance_m": 100.0},
        {"instruction": "Traversează strada", "distance_m": 20.0},
        {"instruction": "Traversează strada la semaforul sonor", "distance_m": 9.0},
        {"instruction": "Virează la stânga", "distance_m": 4.0},
        {"instruction": "Virează la dreapta pe Bd. Vasile Pârvan", "distance_m": 300.0},
    ]
    assert [(s["instruction"], s["distance_m"]) for s in compact(steps)] == [
        ("Pornește spre est", 100.0),
        ("Traversează strada la semaforul sonor", 33.0),
        ("Virează la dreapta pe Bd. Vasile Pârvan", 300.0),
    ]
