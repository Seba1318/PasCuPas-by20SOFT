"""Secțiunile de admin: lucrări, străzi, locuri, vehicule, proiecte (planul 20SOFT)."""

from datetime import UTC, date, datetime, timedelta

import pytest
from sqlalchemy import select

from app import config
from app.models import Institution, Project, RouteBlock, TransitRoute, Vehicle
from app.routing.cost import edge_cost
from app.routing.graph import load_graph, set_graph
from tests.helpers import add_edge, add_node, at, auth, make_user, send_report

TODAY = date.today()


@pytest.fixture
def admins(db):
    city = Institution(name="Primăria Timișoara", type="primarie")
    transport = Institution(name="STPT", type="transport")
    db.add_all([city, transport])
    db.commit()
    return {
        "primarie": make_user(
            db, email="primarie@exemplu.ro", role="admin", institution_id=city.id
        ),
        "stpt": make_user(db, email="stpt@exemplu.ro", role="admin", institution_id=transport.id),
    }


@pytest.fixture
def street(db):
    """Un segment est–vest (0 → 100 m, la nord 0) și unul paralel, 60 m mai la nord."""
    a, b = add_node(db, *at(0, 0)), add_node(db, *at(100, 0))
    c, d = add_node(db, *at(0, 60)), add_node(db, *at(100, 60))
    near, far = add_edge(db, a, b, 100), add_edge(db, c, d, 100)
    db.commit()
    graph = load_graph(db, datetime.now(UTC))
    set_graph(graph)
    yield graph, near, far
    set_graph(None)


def square(east, north, size):
    """Un poligon pătrat, ca zona hașurată a unei lucrări."""
    corners = [
        at(east, north),
        at(east + size, north),
        at(east + size, north + size),
        at(east, north + size),
        at(east, north),
    ]
    return {"type": "Polygon", "coordinates": [[list(p) for p in corners]]}


def work(title="Refacere trotuar", start=TODAY, days=10, blocks=True, geometry=None):
    return {
        "title": title,
        "description": "",
        "start_date": start.isoformat(),
        "end_date": (start + timedelta(days=days)).isoformat(),
        "blocks_route": blocks,
        "geometry": geometry or square(30, -10, 20),
    }


# --- Cazul obligatoriu din plan -----------------------------------------------------------


def test_city_admin_cannot_change_a_vehicle_403(client, db, admins):
    route = TransitRoute(gtfs_route_id="R1", short_name="1", type="tram")
    db.add(route)
    db.flush()
    db.add(Vehicle(route_id=route.id, label="1-01", has_ramp=True))
    db.commit()
    res = client.patch(
        "/admin/vehicles/1-01", json={"ramp_ok": False}, headers=auth(admins["primarie"])
    )
    assert res.status_code == 403
    assert res.json()["detail"] == "Secțiunea e gestionată de altă instituție."


# --- Lucrări -------------------------------------------------------------------------------


def test_work_blocking_the_route_blocks_touched_segments(client, db, admins, street):
    graph, near, far = street
    res = client.post("/admin/works", json=work(), headers=auth(admins["primarie"]))
    assert res.status_code == 201
    assert res.json()["properties"]["title"] == "Refacere trotuar"
    assert graph.blocked == {near.id}  # zona atinge doar segmentul de jos
    # Lucrarea apare și pe harta publică.
    assert [f["properties"]["title"] for f in client.get("/works").json()["features"]] == [
        "Refacere trotuar"
    ]


def test_line_work_blocks_segments_within_10m(client, db, admins, street):
    graph, near, far = street
    line = {"type": "LineString", "coordinates": [list(at(10, 8)), list(at(90, 8))]}
    client.post("/admin/works", json=work(geometry=line), headers=auth(admins["primarie"]))
    assert graph.blocked == {near.id}  # 8 m de segmentul de jos, 52 m de cel de sus


def test_future_work_is_not_active_yet(client, db, admins, street):
    graph, near, _ = street
    client.post(
        "/admin/works", json=work(start=TODAY + timedelta(days=3)), headers=auth(admins["primarie"])
    )
    assert graph.blocked == set()
    block = db.scalar(select(RouteBlock))
    # Lucrarea începe la miezul nopții, ora României. Baza întoarce momentul în fusul sesiunii
    # (UTC în CI), deci îl aducem la ora României înainte să comparăm ziua.
    starts = block.active_from.astimezone(config.LOCAL_TIME)
    assert starts.date() == TODAY + timedelta(days=3)


def test_deleting_a_work_lifts_its_blocks(client, db, admins, street):
    graph, near, _ = street
    created = client.post("/admin/works", json=work(), headers=auth(admins["primarie"])).json()
    res = client.delete(f"/admin/works/{created['id']}", headers=auth(admins["primarie"]))
    assert res.status_code == 204
    assert graph.blocked == set()


def test_changing_a_work_rebuilds_its_blocks(client, db, admins, street):
    graph, near, _ = street
    created = client.post("/admin/works", json=work(), headers=auth(admins["primarie"])).json()
    client.patch(
        f"/admin/works/{created['id']}",
        json={"blocks_route": False},
        headers=auth(admins["primarie"]),
    )
    assert graph.blocked == set()


def test_work_validation(client, admins):
    headers = auth(admins["primarie"])
    backwards = work()
    backwards["end_date"] = (TODAY - timedelta(days=1)).isoformat()
    res = client.post("/admin/works", json=backwards, headers=headers)
    assert res.status_code == 422
    assert res.json()["detail"][0]["msg"] == "Data de final e înaintea datei de început."
    point = work(geometry={"type": "Point", "coordinates": list(at(0, 0))})
    assert client.post("/admin/works", json=point, headers=headers).status_code == 422


def test_transport_admin_cannot_publish_works(client, admins):
    assert client.post("/admin/works", json=work(), headers=auth(admins["stpt"])).status_code == 403


# --- Străzi --------------------------------------------------------------------------------


def test_edit_street_updates_the_graph_in_memory(client, db, admins, street):
    graph, near, _ = street
    near.incline_pct = -2.0
    db.commit()
    headers = auth(admins["primarie"])
    listed = client.get("/admin/edges", headers=headers).json()["features"]
    first = next(f for f in listed if f["id"] == near.id)["properties"]
    assert first["surface"] == "asfalt" and first["incline_pct"] == 2.0

    res = client.patch(
        f"/admin/edges/{near.id}",
        json={
            "kerb_height_cm": 6,
            "surface": "pietris",
            "incline_pct": 4,
            "name": "Aleea Studenților",
        },
        headers=headers,
    )
    assert res.status_code == 200
    db.refresh(near)
    assert (near.kerb_height_cm, near.surface, near.incline_pct) == (
        6,
        "gravel",
        -4,
    )  # semnul rămâne
    memory = graph.edges[near.id]
    assert memory.surface == "gravel" and memory.name == "Aleea Studenților"
    wheelchair = {"avoid_stairs": True, "max_kerb_cm": 3}
    profile = type("P", (), wheelchair)()
    assert edge_cost(memory, 1, profile, datetime.now(UTC)) == float("inf")


def test_mark_street_inaccessible_and_back(client, db, admins, street):
    graph, near, _ = street
    url, headers = f"/admin/edges/{near.id}", auth(admins["primarie"])
    assert client.patch(url, json={"blocked": True}, headers=headers).json()["properties"][
        "blocked"
    ]
    assert graph.blocked == {near.id}
    client.patch(url, json={"blocked": False}, headers=headers)
    assert graph.blocked == set()


# --- Locuri --------------------------------------------------------------------------------


def test_places_create_change_delete(client, db, admins):
    headers = auth(admins["primarie"])
    body = {
        "name": "Rampă nouă",
        "category": "ramp",
        "geometry": {"type": "Point", "coordinates": list(at(5, 5))},
    }
    created = client.post("/admin/places", json=body, headers=headers)
    assert created.status_code == 201
    place_id = created.json()["id"]
    changed = client.patch(
        f"/admin/places/{place_id}", json={"attributes": {"width_cm": 120}}, headers=headers
    )
    assert changed.json()["properties"]["attributes"] == {"width_cm": 120}
    assert client.delete(f"/admin/places/{place_id}", headers=headers).status_code == 204
    assert client.get(f"/places/{place_id}").status_code == 404


# --- Vehicule ------------------------------------------------------------------------------


def test_transport_admin_manages_vehicles(client, db, admins, uploads, outbox):
    route = TransitRoute(gtfs_route_id="R14", short_name="14", type="trolleybus")
    db.add(route)
    db.flush()
    vehicle = Vehicle(route_id=route.id, label="14-03", has_ramp=True, has_audio_announce=True)
    db.add(vehicle)
    db.commit()
    reporter = make_user(db)
    sent = send_report(
        client,
        auth(reporter),
        where=None,
        category="dotare_vehicul",
        equipment="ramp",
        vehicle_id=str(vehicle.id),
    )
    assert sent.status_code == 201
    db.refresh(vehicle)
    assert vehicle.ramp_ok is False  # raport de la un utilizator cu încredere 100%

    headers = auth(admins["stpt"])
    listed = client.get("/admin/vehicles", headers=headers).json()
    assert listed[0]["id"] == "14-03" and listed[0]["route_name"] == "Troleibuz 14"
    assert listed[0]["open_reports"] == 1
    res = client.patch("/admin/vehicles/14-03", json={"ramp_ok": True}, headers=headers)
    assert res.json()["ramp_ok"] is True


# --- Proiecte ------------------------------------------------------------------------------


def test_projects_crud_with_empty_form_fields(client, db, admins):
    headers = auth(admins["primarie"])
    body = {
        "title": "Semafoare sonore",
        "description": "",
        "zone": "Piața Victoriei",
        "start_date": "2026-11-01",
        "end_date": "",
        "status": "planificat",
        "budget": "",
    }
    created = client.post("/admin/projects", json=body, headers=headers)
    assert created.status_code == 201
    assert created.json()["end_date"] is None and created.json()["budget"] is None
    project_id = created.json()["id"]
    client.patch(f"/admin/projects/{project_id}", json={"status": "in_curs"}, headers=headers)
    assert [p["status"] for p in client.get("/admin/projects", headers=headers).json()] == [
        "in_curs"
    ]
    assert client.delete(f"/admin/projects/{project_id}", headers=headers).status_code == 204
    assert db.scalar(select(Project)) is None
    assert client.get("/admin/projects", headers=auth(admins["stpt"])).status_code == 403
