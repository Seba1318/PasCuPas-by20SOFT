"""A* pe graful din exemplul lucrat (planul 20SOFT · Exemplul lucrat).

A ──100 m, asfalt── B ──80 m, trepte── D
└──120 m, pavaj──── C ──90 m, bordură 2 cm──┘
"""

from datetime import UTC, datetime
from types import SimpleNamespace

from app.routing.astar import astar, haversine_m
from app.routing.cost import edge_cost
from app.routing.graph import Edge, Graph

NOW = datetime(2026, 11, 15, 10, 0, tzinfo=UTC)
A, B, C, D = 1, 2, 3, 4
WHEELCHAIR = SimpleNamespace(avoid_stairs=True, max_kerb_cm=3, max_incline_pct=None)


def worked_example() -> Graph:
    graph = Graph()
    # Coordonate apropiate: linia dreaptă (euristica) rămâne sub lungimile reale.
    for node, coord in {A: (21.0, 45.0), B: (21.0005, 45.0), C: (21.0, 45.0005)}.items():
        graph.add_node(node, coord)
    graph.add_node(D, (21.0005, 45.0005))

    def add(edge_id, a, b, length, **attrs):
        coords = [graph.nodes[a], graph.nodes[b]]
        graph.add_edge(Edge(edge_id, a, b, length, coords, **attrs))

    add(1, A, B, 100)
    add(2, B, D, 80, has_stairs=True)
    add(3, A, C, 120, surface="paving")
    add(4, C, D, 90, kerb_height_cm=2)
    graph.compute_degrees()
    return graph


def cost_for(profile):
    return lambda edge, direction: edge_cost(edge, direction, profile, NOW)


def test_worked_example_avoids_stairs_a_c_d_210m():
    graph = worked_example()
    path = astar(graph, A, D, cost_for(WHEELCHAIR))
    assert path.nodes == [A, C, D]
    assert path.length_m(graph) == 210
    assert path.cost == 144 + 108


def test_without_profile_takes_the_short_way_over_the_stairs():
    graph = worked_example()
    path = astar(graph, A, D, cost_for(None))
    assert path.nodes == [A, B, D]
    assert path.length_m(graph) == 180


def test_all_roads_blocked_returns_none():
    graph = worked_example()
    graph.blocked = {1, 3}  # A–B și A–C blocate
    assert astar(graph, A, D, cost_for(None)) is None


def test_segments_work_in_both_directions():
    graph = worked_example()
    path = astar(graph, D, A, cost_for(WHEELCHAIR))
    assert path.nodes == [D, C, A]
    assert path.steps == [(4, -1), (3, -1)]


def test_start_equals_goal():
    graph = worked_example()
    path = astar(graph, A, A, cost_for(None))
    assert path.nodes == [A] and path.steps == []


def test_haversine_one_degree_of_latitude():
    assert round(haversine_m((21, 45), (21, 46))) == 111_195


def test_astar_matches_dijkstra_on_a_grid(monkeypatch):
    """Pe o grilă 6×6 cu costuri variate, A* (cu euristică) dă același cost ca Dijkstra
    (aceeași căutare cu euristica 0): euristica nu strică optimalitatea."""
    graph = Graph()
    size, step = 6, 0.0005
    for i in range(size):
        for j in range(size):
            graph.add_node(i * size + j, (21 + j * step, 45 + i * step))
    edge_id = 0
    for i in range(size):
        for j in range(size):
            for di, dj in ((0, 1), (1, 0)):
                if i + di < size and j + dj < size:
                    a, b = i * size + j, (i + di) * size + (j + dj)
                    straight = haversine_m(graph.nodes[a], graph.nodes[b])
                    surface = ("asphalt", "paving", "gravel")[(i * 7 + j * 3 + di) % 3]
                    graph.add_edge(Edge(edge_id, a, b, straight, [], surface=surface))
                    edge_id += 1
    graph.compute_degrees()
    p = SimpleNamespace(avoid_stairs=True, avoid_rough_surface=True, max_kerb_cm=None)
    cost = cost_for(p)

    import app.routing.astar as module

    with_heuristic = astar(graph, 0, size * size - 1, cost)
    monkeypatch.setattr(module, "haversine_m", lambda a, b: 0.0)
    dijkstra = astar(graph, 0, size * size - 1, cost)
    assert abs(with_heuristic.cost - dijkstra.cost) < 1e-6
