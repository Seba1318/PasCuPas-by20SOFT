"""Legarea punctelor de graf (planul 20SOFT · test_snap.py)."""

import pytest

from app.routing.snap import OutOfArea, snap
from tests.helpers import M_PER_DEG_LAT, add_edge, add_node

LON, LAT = 21.23, 45.75


@pytest.fixture
def one_segment(db):
    """Un segment est–vest de ~78 m."""
    a = add_node(db, LON, LAT)
    b = add_node(db, LON + 0.001, LAT)
    edge = add_edge(db, a, b, 78)
    db.commit()
    return a, b, edge


def north_of_segment(meters: float) -> tuple[float, float]:
    return LON + 0.0002, LAT + meters / M_PER_DEG_LAT


def test_point_80m_from_any_segment_is_out_of_area(db, one_segment):
    with pytest.raises(OutOfArea):
        snap(db, *north_of_segment(80))


def test_point_near_segment_snaps_to_closer_end(db, one_segment):
    a, b, edge = one_segment
    result = snap(db, *north_of_segment(20))  # mai aproape de capătul a
    assert result.edge_id == edge.id
    assert result.node_id == a.id
    assert 19 < result.distance_m < 21

    near_b = snap(db, LON + 0.0009, LAT + 0.0001)
    assert near_b.node_id == b.id


def test_empty_graph_is_out_of_area(db):
    with pytest.raises(OutOfArea):
        snap(db, LON, LAT)
