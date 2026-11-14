"""Legarea unui punct GPS de graf (planul 20SOFT · Graful în memorie, „Legarea punctelor”).

Startul și destinația se leagă de cel mai apropiat segment (ORDER BY geom <-> punct LIMIT 1,
cu indexul GIST), apoi de capătul lui mai apropiat. Peste 50 m de orice segment, punctul e
în afara zonei acoperite.
"""

from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import GraphEdge

MAX_SNAP_M = 50


class OutOfArea(Exception):
    """Punctul e la peste MAX_SNAP_M de orice segment."""


@dataclass
class Snapped:
    node_id: int
    edge_id: int
    distance_m: float  # de la punct la segment


def snap(db: Session, lon: float, lat: float) -> Snapped:
    point = func.ST_SetSRID(func.ST_MakePoint(lon, lat), 4326)

    def meters(geom):  # distanța în metri: cast la geography (în 4326 unitatea e gradul)
        return func.ST_Distance(func.geography(geom), func.geography(point))

    row = db.execute(
        select(
            GraphEdge.id,
            GraphEdge.from_node,
            GraphEdge.to_node,
            meters(GraphEdge.geom),
            meters(func.ST_StartPoint(GraphEdge.geom)),
            meters(func.ST_EndPoint(GraphEdge.geom)),
        )
        .order_by(GraphEdge.geom.op("<->")(point))
        .limit(1)
    ).first()
    if row is None or row[3] > MAX_SNAP_M:
        raise OutOfArea
    edge_id, from_node, to_node, distance, to_start, to_end = row
    node = from_node if to_start <= to_end else to_node
    return Snapped(node_id=node, edge_id=edge_id, distance_m=distance)
