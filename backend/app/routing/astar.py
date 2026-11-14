"""A* pe graful de trotuare (planul 20SOFT · Algoritmul de rutare).

A* explorează mereu nodul cu cel mai mic f = g + h:
    g = costul real de la start până la nod;
    h = estimarea costului rămas = distanța în linie dreaptă (haversine) până la destinație.
Costul unui segment e cel puțin lungimea lui, iar lungimea e cel puțin linia dreaptă, deci h
nu supraestimează niciodată: A* găsește traseul cu cost minim, explorând mai puțin decât
Dijkstra.
"""

import heapq
import math
from collections.abc import Callable
from dataclasses import dataclass

from app.routing.graph import Coord, Edge, Graph

EARTH_RADIUS_M = 6_371_009  # aceeași rază ca osmnx, care a calculat length_m


def haversine_m(a: Coord, b: Coord) -> float:
    lon1, lat1, lon2, lat2 = map(math.radians, (*a, *b))
    h = (
        math.sin((lat2 - lat1) / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    )
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(h))


@dataclass
class Path:
    nodes: list[int]  # nodurile parcurse, de la start la destinație
    steps: list[tuple[int, int]]  # (edge_id, direction) pentru fiecare segment
    cost: float

    def length_m(self, graph: Graph) -> float:
        return sum(graph.edges[edge_id].length_m for edge_id, _ in self.steps)


CostFn = Callable[[Edge, int], float]


def astar(graph: Graph, start: int, goal: int, cost: CostFn) -> Path | None:
    """Traseul cu cost minim de la start la goal, sau None dacă nu există."""
    goal_coord = graph.nodes[goal]
    best = {start: 0.0}  # g: cel mai mic cost cunoscut până la fiecare nod
    came_from: dict[int, tuple[int, int, int]] = {}  # nod → (nodul anterior, edge, direction)
    queue = [(haversine_m(graph.nodes[start], goal_coord), 0.0, start)]
    done = set()

    while queue:
        _, g, node = heapq.heappop(queue)
        if node == goal:
            return _rebuild(came_from, start, goal, g)
        if node in done:
            continue  # am mai scos nodul din coadă, cu un cost mai bun
        done.add(node)
        for edge_id, direction in graph.adjacency[node]:
            if edge_id in graph.blocked:
                continue
            edge = graph.edges[edge_id]
            step = cost(edge, direction)
            if math.isinf(step):
                continue
            nxt = edge.end_node(direction)
            new_g = g + step
            if new_g < best.get(nxt, math.inf):
                best[nxt] = new_g
                came_from[nxt] = (node, edge_id, direction)
                heapq.heappush(
                    queue, (new_g + haversine_m(graph.nodes[nxt], goal_coord), new_g, nxt)
                )
    return None


def _rebuild(came_from, start: int, goal: int, cost: float) -> Path:
    nodes, steps = [goal], []
    while nodes[-1] != start:
        prev, edge_id, direction = came_from[nodes[-1]]
        steps.append((edge_id, direction))
        nodes.append(prev)
    return Path(nodes=nodes[::-1], steps=steps[::-1], cost=cost)
