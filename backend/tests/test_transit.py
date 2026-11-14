"""Transportul public: sosiri și traseu cu o linie (planul 20SOFT · Transportul public).

Orarul de test e construit față de ora curentă, deci testele merg la orice oră.

    start ── 40 m ── stația S1 ═══ linia 1 (5 min) ═══ stația S2 ── 40 m ── destinație
"""

from datetime import UTC, date, datetime, timedelta

import pytest
from sqlalchemy import select

from app.models import (
    AccessibilityProfile,
    GraphNode,
    StopTime,
    TransitRoute,
    TransitStop,
    Trip,
    Vehicle,
)
from app.routing import transit
from app.routing.graph import load_graph, set_graph
from tests.helpers import add_edge, add_node, at, auth, make_user, point

START, S1, S2, END = at(0, 0), at(40, 0), at(1500, 0), at(1540, 0)


def seconds_from_now(minutes: float) -> tuple[date, int]:
    local = (datetime.now(UTC) + timedelta(minutes=minutes)).astimezone(transit.config.LOCAL_TIME)
    today = datetime.now(UTC).astimezone(transit.config.LOCAL_TIME).date()
    # Peste miezul nopții, GTFS scrie ora ca 24:xx a zilei de serviciu de azi.
    return today, int((local.date() - today).days) * 86400 + local.hour * 3600 + local.minute * 60


@pytest.fixture
def network(db):
    """Străzile dintre stații și o linie de tramvai cu două curse: una peste 10 minute (vehicul
    cu rampă) și una peste 4 minute (vehicul cu rampa stricată)."""
    nodes = [add_node(db, *p) for p in (START, S1, S2, END)]
    for a, b in zip(nodes, nodes[1:], strict=False):
        add_edge(db, a, b, 40 if b is not nodes[2] else 1460)
    s1 = TransitStop(gtfs_stop_id="S1", name="Complex", geom=point(*S1), wheelchair_boarding=True)
    s2 = TransitStop(
        gtfs_stop_id="S2", name="Piața Victoriei", geom=point(*S2), wheelchair_boarding=True
    )
    route = TransitRoute(gtfs_route_id="R1", short_name="1", type="tram")
    db.add_all([s1, s2, route])
    db.flush()
    good = Vehicle(route_id=route.id, label="1-01", has_ramp=True, low_floor=True, ramp_ok=True)
    broken = Vehicle(route_id=route.id, label="1-02", has_ramp=True, low_floor=True, ramp_ok=False)
    db.add_all([good, broken])
    db.flush()
    for label, vehicle, depart in (("T-ok", good, 10), ("T-broken", broken, 4)):
        day, dep = seconds_from_now(depart)
        trip = Trip(
            gtfs_trip_id=label,
            route_id=route.id,
            vehicle_id=vehicle.id,
            service_days=[day],
            headsign="Piața Victoriei",
        )
        db.add(trip)
        db.flush()
        db.add_all(
            [
                StopTime(trip_id=trip.id, stop_id=s1.id, sequence=1, arrival_time=dep),
                StopTime(trip_id=trip.id, stop_id=s2.id, sequence=2, arrival_time=dep + 300),
            ]
        )
    db.commit()
    set_graph(load_graph(db, datetime.now(UTC)))
    yield {"s1": s1, "s2": s2, "broken": broken}
    set_graph(None)


def plan(client, headers, start=START, end=END):
    return client.post(
        "/routes/plan", json={"start": start, "end": end, "mode": "transit"}, headers=headers
    )


def test_without_profile_takes_the_first_tram(client, db, network):
    body = plan(client, auth(make_user(db))).json()
    walk_to, ride, walk_from = body["legs"]
    assert (walk_to["type"], ride["type"], walk_from["type"]) == ("walk", "transit", "walk")
    assert ride["vehicle"]["label"] == "1-02"  # cel de peste 4 minute
    assert ride["line"] == "1" and ride["vehicle_type"] == "Tramvai"
    assert (
        ride["board_stop"] == "Stația Complex" and ride["alight_stop"] == "Stația Piața Victoriei"
    )
    assert body["steps"][1]["instruction"] == "Urcă în tramvaiul 1 spre Piața Victoriei"


def test_wheelchair_skips_the_vehicle_with_broken_ramp(client, db, network):
    user = make_user(db)
    db.add(AccessibilityProfile(user_id=user.id, avoid_stairs=True, max_kerb_cm=3))
    db.commit()
    body = plan(client, auth(user)).json()
    assert body["legs"][1]["vehicle"]["label"] == "1-01"  # rampa funcțională, peste 10 minute
    assert body["explanation"] == "Am ales doar stații accesibile și vehicule cu rampă funcțională."


def test_no_line_when_ramp_is_needed_but_all_are_broken(client, db, network):
    for v in db.query(Vehicle):
        v.ramp_ok = False
    db.commit()
    user = make_user(db)
    db.add(AccessibilityProfile(user_id=user.id, avoid_stairs=True))
    db.commit()
    assert plan(client, auth(user)).status_code == 404


def test_arrivals_with_vehicle_equipment(client, db, network):
    res = client.get(f"/transit/stops/{network['s1'].id}/arrivals")
    assert res.status_code == 200
    first, second = res.json()
    assert (first["route"], first["type"], first["headsign"]) == ("1", "Tramvai", "Piața Victoriei")
    assert first["vehicle"]["ramp_ok"] is False and second["vehicle"]["ramp_ok"] is True
    assert first["arrival_time"] < second["arrival_time"]
    assert client.get("/transit/stops/9999/arrivals").status_code == 404


def test_routes_list(client, db, network):
    routes = client.get("/transit/routes").json()
    assert [(r["short_name"], r["type"]) for r in routes] == [("1", "tramvai")]


def test_trip_after_midnight_belongs_to_yesterday():
    now = datetime(2026, 11, 3, 0, 20, tzinfo=transit.config.LOCAL_TIME)  # 00:20, marți
    # O cursă din serviciul de luni, la „24:30” (= 00:30 marți).
    assert transit.service_day(24 * 3600 + 30 * 60, now) == date(2026, 11, 2)
    assert transit.when(date(2026, 11, 2), 24 * 3600 + 30 * 60) == datetime(
        2026, 11, 3, 0, 30, tzinfo=transit.config.LOCAL_TIME
    )


def test_tram_leaving_before_you_reach_the_stop_is_skipped(client, db, network):
    """De la 360 m, mersul până la stație durează ~5 minute: tramvaiul de peste 4 minute e
    pierdut, deci aplicația îl propune pe cel de peste 10 minute."""
    far_start = at(-360, 0)
    far = add_node(db, *far_start)
    start_node = db.scalar(
        select(GraphNode).order_by(GraphNode.geom.op("<->")(point(*START))).limit(1)
    )
    add_edge(db, far, start_node, 360)
    db.commit()
    set_graph(load_graph(db, datetime.now(UTC)))
    body = plan(client, auth(make_user(db)), start=far_start).json()
    assert body["legs"][1]["vehicle"]["label"] == "1-01"


def test_stops_say_which_kinds_of_lines_stop_there(client, db, network):
    features = client.get("/transit/stops").json()["features"]
    assert {f["properties"]["name"]: f["properties"]["modes"] for f in features} == {
        "Complex": ["tramvai"],
        "Piața Victoriei": ["tramvai"],
    }
