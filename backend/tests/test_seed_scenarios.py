"""Scenariul de demo „scări spre Rectorat” din scripts/seed_fake.py, pe un graf mic.

S = Căminul 1, G = Rectoratul UPT. Drumul cel mai scurt e S → M1 → G (1300 m).
M1 → M3 → G ocolește doar segmentul M1–G (+150 m), iar S → M2 → G ocolește tot (+500 m).
Atributele aleatoare au pus deja trepte pe ambele segmente ale drumului cel mai scurt,
ca în graful real din 14 noiembrie 2026.
"""

from datetime import UTC, datetime

from sqlalchemy import select

from app.models import GraphEdge
from app.routing.astar import astar
from app.routing.graph import load_graph
from app.routing.snap import snap
from scripts import seed_fake
from tests.helpers import add_edge, add_node

S, G = seed_fake.CAMIN_1, seed_fake.RECTORAT
M1 = ((S[0] + G[0]) / 2, (S[1] + G[1]) / 2)
M3 = ((M1[0] + G[0]) / 2, (M1[1] + G[1]) / 2 + 0.0015)  # ~170 m spre nord
M2 = (M1[0], M1[1] - 0.003)  # ~330 m spre sud


def build(db) -> dict[str, GraphEdge]:
    s, m1, m2, m3, g = (add_node(db, *p) for p in (S, M1, M2, M3, G))
    edges = {
        "S-M1": add_edge(db, s, m1, 650, has_stairs=True),
        "M1-G": add_edge(db, m1, g, 650, has_stairs=True),
        "M1-M3": add_edge(db, m1, m3, 400),
        "M3-G": add_edge(db, m3, g, 400),
        "S-M2": add_edge(db, s, m2, 900),
        "M2-G": add_edge(db, m2, g, 900),
    }
    db.commit()
    return edges


def test_stairs_to_the_rectorate_are_rebuilt_over_random_stairs(db):
    edges = build(db)

    seed_fake.seed_rectorat_stairs(db)
    db.commit()

    stairs = set(db.scalars(select(GraphEdge.id).where(GraphEdge.has_stairs)))
    assert stairs == {edges["M1-G"].id}  # o singură treaptă, pusă de scenariu
    now = datetime.now(UTC)
    graph = load_graph(db, now)
    start, goal = snap(db, *S).node_id, snap(db, *G).node_id
    shortest = astar(graph, start, goal, lambda edge, direction: edge.length_m)
    accessible = astar(graph, start, goal, seed_fake._wheelchair_cost(now))
    assert edges["M1-G"].id in {edge_id for edge_id, _ in shortest.steps}
    assert accessible.length_m(graph) - shortest.length_m(graph) == 150


def test_scenario_edges_set_just_before_are_kept(db):
    edges = build(db)
    db.get(GraphEdge, edges["S-M1"].id).has_stairs = False
    db.get(GraphEdge, edges["S-M1"].id).incline_pct = 9.0  # „Pantă abruptă”, alt scenariu
    db.commit()

    seed_fake.seed_rectorat_stairs(db, keep={edges["S-M1"].id})
    db.commit()

    assert db.get(GraphEdge, edges["S-M1"].id).incline_pct == 9.0
