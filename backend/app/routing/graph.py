"""Graful de trotuare ținut în memorie (planul 20SOFT · Graful în memorie).

Se încarcă din bază o singură dată, la pornirea serverului. Fiecare segment apare în lista
de vecini a ambelor capete, cu direction = +1 (from_node → to_node) sau −1 (invers).
Blocajele sunt un set de id-uri separat de graf: un blocaj nou modifică doar setul.
"""

import json
from dataclasses import dataclass, field
from datetime import datetime

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models import GraphEdge, GraphNode, RouteBlock

Coord = tuple[float, float]  # (lon, lat), ca în GeoJSON


@dataclass(slots=True)
class Edge:
    id: int
    from_node: int
    to_node: int
    length_m: float
    coords: list[Coord]  # geometria, în sensul from_node → to_node
    name: str | None = None  # numele străzii, pentru indicații
    has_stairs: bool = False
    kerb_height_cm: float = 0
    incline_pct: float = 0  # cu semn, în sensul from_node → to_node
    surface: str = "asphalt"
    has_tactile: bool = False
    has_audio_signal: bool = False
    is_crossing: bool = False
    is_lit: bool = True
    has_bench: bool = False
    # Câte segmente pleacă din fiecare capăt; folosit de simplified_mode (intersecții 4+).
    from_degree: int = 0
    to_degree: int = 0

    def end_node(self, direction: int) -> int:
        return self.to_node if direction == 1 else self.from_node

    def entry_degree(self, direction: int) -> int:
        """Gradul intersecției în care intră segmentul, mergând în sensul dat."""
        return self.to_degree if direction == 1 else self.from_degree

    def coords_in(self, direction: int) -> list[Coord]:
        return self.coords if direction == 1 else self.coords[::-1]


@dataclass
class Graph:
    nodes: dict[int, Coord] = field(default_factory=dict)
    edges: dict[int, Edge] = field(default_factory=dict)
    adjacency: dict[int, list[tuple[int, int]]] = field(default_factory=dict)
    blocked: set[int] = field(default_factory=set)

    def add_node(self, node_id: int, coord: Coord) -> None:
        self.nodes[node_id] = coord
        self.adjacency.setdefault(node_id, [])

    def add_edge(self, edge: Edge) -> None:
        self.edges[edge.id] = edge
        self.adjacency[edge.from_node].append((edge.id, 1))
        self.adjacency[edge.to_node].append((edge.id, -1))

    def compute_degrees(self) -> None:
        for edge in self.edges.values():
            edge.from_degree = len(self.adjacency[edge.from_node])
            edge.to_degree = len(self.adjacency[edge.to_node])


ATTRIBUTES = (
    "name",
    "has_stairs",
    "kerb_height_cm",
    "incline_pct",
    "surface",
    "has_tactile",
    "has_audio_signal",
    "is_crossing",
    "is_lit",
    "has_bench",
)


def edge_from_row(row: GraphEdge, coords: list[Coord]) -> Edge:
    return Edge(
        id=row.id,
        from_node=row.from_node,
        to_node=row.to_node,
        length_m=row.length_m,
        coords=coords,
        **{name: getattr(row, name) for name in ATTRIBUTES},
    )


def load_graph(db: Session, now: datetime) -> Graph:
    graph = Graph()
    for node_id, lon, lat in db.execute(
        select(GraphNode.id, func.ST_X(GraphNode.geom), func.ST_Y(GraphNode.geom))
    ):
        graph.add_node(node_id, (lon, lat))
    for row, geojson in db.execute(select(GraphEdge, func.ST_AsGeoJSON(GraphEdge.geom))):
        coords = [tuple(c) for c in json.loads(geojson)["coordinates"]]
        graph.add_edge(edge_from_row(row, coords))
    graph.compute_degrees()
    graph.blocked = load_blocked(db, now)
    return graph


def load_blocked(db: Session, now: datetime) -> set[int]:
    """Segmentele blocate acum: blocaje începute și neîncheiate."""
    query = select(RouteBlock.edge_id).where(
        RouteBlock.active_from <= now,
        or_(RouteBlock.active_until.is_(None), RouteBlock.active_until > now),
    )
    return set(db.scalars(query))


# Graful serverului. main.py îl încarcă la pornire; testele îl pun direct cu set_graph.
_graph: Graph | None = None


def set_graph(graph: Graph | None) -> None:
    global _graph
    _graph = graph


def loaded_graph() -> Graph | None:
    """Graful, dacă e încărcat (scripturile și unele teste rulează fără el)."""
    return _graph


def get_graph() -> Graph:
    if _graph is None:
        raise RuntimeError("Graful nu e încărcat. Serverul pornește prin app.main (lifespan).")
    return _graph
