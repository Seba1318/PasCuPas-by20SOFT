"""Statisticile din admin: harta termică și clasamentul zonelor (planul 20SOFT · Dashboard)."""

from datetime import UTC, datetime, timedelta

import pytest

from app.models import Institution, Report
from tests.helpers import add_edge, add_node, at, auth, make_user, point


@pytest.fixture
def admin(db):
    city = Institution(name="Primăria Timișoara", type="primarie")
    db.add(city)
    db.commit()
    return make_user(db, email="primarie@exemplu.ro", role="admin", institution_id=city.id)


@pytest.fixture
def streets(db):
    """Două străzi cu nume, la 500 m una de alta."""
    a, b = add_node(db, *at(0, 0)), add_node(db, *at(100, 0))
    c, d = add_node(db, *at(0, 500)), add_node(db, *at(100, 500))
    add_edge(db, a, b, 100, name="Aleea Studenților")
    add_edge(db, c, d, 100, name="Bulevardul Vasile Pârvan")
    db.commit()


def report(db, author, where, days_ago, category="rampa_blocata", resolved_after=None, **fields):
    created = datetime.now(UTC) - timedelta(days=days_ago)
    r = Report(
        user_id=author.id,
        category=category,
        geom=point(*at(*where)),
        created_at=created,
        status="rezolvat" if resolved_after is not None else "in_lucru",
        resolved_at=created + timedelta(days=resolved_after)
        if resolved_after is not None
        else None,
        **fields,
    )
    db.add(r)
    db.commit()
    return r


def test_zones_rank_open_reports_and_resolution_time(client, db, admin, streets):
    ana = make_user(db)
    # Aleea Studenților: 2 active (cel mai vechi de acum 20 de zile), niciun rezolvat.
    report(db, ana, (20, 10), days_ago=20)
    report(db, ana, (60, -10), days_ago=3, category="masina_trotuar")
    # Vasile Pârvan: 1 activ, 2 rezolvate în 2 și 4 zile, ultimul închis acum 5 zile.
    report(db, ana, (50, 510), days_ago=1)
    report(db, ana, (30, 490), days_ago=10, resolved_after=2)
    report(db, ana, (70, 505), days_ago=9, resolved_after=4)

    zones = client.get("/admin/stats/zones", headers=auth(admin)).json()
    assert [z["zone"] for z in zones] == ["Aleea Studenților", "Bulevardul Vasile Pârvan"]
    alee, bulevard = zones
    assert (alee["open_count"], alee["avg_resolution_days"], alee["last_action_days"]) == (
        2,
        None,
        20,
    )
    assert (bulevard["open_count"], bulevard["avg_resolution_days"]) == (1, 3.0)
    assert bulevard["last_action_days"] == 5
    assert bulevard["note"] == "Mai ales rampe blocate"


def test_false_reports_are_left_out(client, db, admin, streets):
    ana = make_user(db)
    report(db, ana, (20, 0), days_ago=2, is_false=True)
    assert client.get("/admin/stats/zones", headers=auth(admin)).json() == []
    assert client.get("/admin/stats/heatmap", headers=auth(admin)).json() == []


def test_heatmap_points_weighted_by_status(client, db, admin, streets):
    ana = make_user(db)
    report(db, ana, (20, 0), days_ago=2)
    report(db, ana, (40, 0), days_ago=6, resolved_after=1)
    report(db, ana, (60, 0), days_ago=400)  # prea vechi pentru hartă
    points = client.get("/admin/stats/heatmap", headers=auth(admin)).json()
    assert sorted(w for _, _, w in points) == [0.5, 1.0]
    lon, lat, _ = points[0]
    assert 21 < lon < 22 and 45 < lat < 46  # [lon, lat], ca în GeoJSON


def test_report_far_from_any_street_uses_its_location_text(client, db, admin, streets):
    report(db, make_user(db), (2000, 2000), days_ago=1, location_text="Parcul Rozelor")
    assert [z["zone"] for z in client.get("/admin/stats/zones", headers=auth(admin)).json()] == [
        "Parcul Rozelor"
    ]


def test_stats_need_admin(client, db):
    assert client.get("/admin/stats/zones", headers=auth(make_user(db))).status_code == 403
