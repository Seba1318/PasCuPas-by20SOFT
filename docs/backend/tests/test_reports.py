"""Rapoartele: limită, poze, cod public, scor, confirmări, blocaje (planul 20SOFT)."""

import re
from datetime import UTC, datetime, timedelta

import pytest
from PIL import Image

from app.models import Report, RouteBlock
from app.routing.graph import load_graph, set_graph
from tests.helpers import add_edge, add_node, at, auth, make_user, photo_bytes, send_report

CODE = re.compile(r"^TM-\d{4}-\d{6}$")


@pytest.fixture
def ana(db):
    return make_user(db)


@pytest.fixture
def mihai(db):
    return make_user(db, email="mihai@exemplu.ro")


# --- Cazurile obligatorii din plan --------------------------------------------------------


def test_sixth_report_in_an_hour_is_429(client, db, ana, uploads, outbox):
    for i in range(5):  # locuri la 100 m unul de altul, ca să nu fie duplicate
        assert send_report(client, auth(ana), where=(i * 100, 0)).status_code == 201
    res = send_report(client, auth(ana), where=(600, 0))
    assert res.status_code == 429
    assert "5 rapoarte în ultima oră" in res.json()["detail"]


def test_exe_renamed_to_jpg_is_400(client, ana, uploads):
    exe = b"MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff" + b"\x00" * 200
    res = send_report(client, auth(ana), photo=("poza.jpg", exe, "image/jpeg"))
    assert res.status_code == 400
    assert "poz" in res.json()["detail"]  # frontendul arată eroarea lângă câmpul pozei
    assert list(uploads.iterdir()) == []


def test_user_cannot_confirm_own_report_is_400(client, ana, uploads, outbox):
    report_id = send_report(client, auth(ana)).json()["id"]
    res = client.post(f"/reports/{report_id}/confirm", json={"kind": "confirm"}, headers=auth(ana))
    assert res.status_code == 400
    assert res.json()["detail"] == "Nu îți poți confirma propriul raport."


# --- Raportul nou -------------------------------------------------------------------------


def test_new_report_gets_code_clean_photo_and_email(client, db, ana, uploads, outbox):
    res = send_report(client, auth(ana), description="O mașină e parcată pe rampă.")
    assert res.status_code == 201
    code = res.json()["public_code"]
    assert CODE.match(code)
    assert outbox[-1]["to"] == "ana@exemplu.ro" and code in outbox[-1]["subject"]

    saved = list(uploads.iterdir())
    assert len(saved) == 1 and saved[0].suffix == ".jpg"
    with Image.open(saved[0]) as image:
        assert max(image.size) == 1600  # micșorată de la 2400 px
        assert not image.getexif()  # fără metadate (modelul telefonului a dispărut)

    page = client.get(f"/reports/{code}").json()
    assert page["properties"]["status"] == "in_lucru"
    assert page["properties"]["description"] == "O mașină e parcată pe rampă."
    assert page["properties"]["photo_url"].endswith(saved[0].name)
    assert page["properties"]["reporter"]["name"] == "Ana"
    assert page["geometry"]["coordinates"] == pytest.approx(list(at(0, 0)))


def test_png_is_accepted(client, ana, uploads, outbox):
    png = ("poza.png", photo_bytes("PNG", size=(400, 300)), "image/png")
    assert send_report(client, auth(ana), photo=png).status_code == 201


def test_location_required_except_for_vehicles(client, ana, uploads, outbox):
    assert send_report(client, auth(ana), where=None).status_code == 422
    res = send_report(client, auth(ana), where=None, category="dotare_vehicul", equipment="ramp")
    assert res.status_code == 201


def test_unknown_category_is_422(client, ana, uploads):
    assert send_report(client, auth(ana), category="nu-exista").status_code == 422


def test_suspended_user_cannot_report(client, db, uploads):
    until = datetime.now(UTC) + timedelta(days=90)
    user = make_user(db, trust_level=0, suspended_until=until)
    res = send_report(client, auth(user))
    assert res.status_code == 403
    assert "Raportarea e oprită" in res.json()["detail"]


@pytest.mark.parametrize(
    ("taken", "reporter", "date_points", "location_points"),
    [
        (timedelta(hours=-2), (30, 0), 20, 20),  # poză proaspătă, telefonul lângă pin
        (timedelta(days=-10), (500, 0), 0, 0),  # poză veche, telefonul la 500 m
        (None, None, 10, 10),  # fără dată și fără poziție
    ],
)
def test_verification_score(
    client, db, ana, uploads, outbox, taken, reporter, date_points, location_points
):
    taken_at = datetime.now().astimezone() + taken if taken is not None else None
    fields = {}
    if reporter:
        fields["reporter_lon"], fields["reporter_lat"] = at(*reporter)
    photo = ("p.jpg", photo_bytes(taken_at=taken_at), "image/jpeg")
    report_id = send_report(client, auth(ana), photo=photo, **fields).json()["id"]
    report = db.get(Report, report_id)
    assert (report.ai_score, report.ai_notes) == (30, "neverificat")
    assert report.score_date == date_points
    assert report.score_location == location_points


def test_exif_gps_counts_for_location(client, db, ana, uploads, outbox):
    photo = ("p.jpg", photo_bytes(gps=at(20, 0)), "image/jpeg")
    report_id = send_report(client, auth(ana), photo=photo).json()["id"]
    assert db.get(Report, report_id).score_location == 20


# --- Listări ------------------------------------------------------------------------------


def test_map_lists_active_reports_in_bbox(client, ana, uploads, outbox):
    send_report(client, auth(ana), where=(0, 0))
    send_report(client, auth(ana), where=(5000, 0))  # la 5 km, în afara zonei
    lon, lat = at(0, 0)
    bbox = f"{lon - 0.01},{lat - 0.01},{lon + 0.01},{lat + 0.01}"
    body = client.get("/reports", params={"bbox": bbox, "status": "in_lucru"}).json()
    assert len(body["features"]) == 1
    props = body["features"][0]["properties"]
    assert CODE.match(props["public_code"]) and props["status"] == "in_lucru"


def test_my_reports(client, ana, mihai, uploads, outbox):
    send_report(client, auth(ana), where=(0, 0))
    send_report(client, auth(mihai), where=(300, 0))
    mine = client.get("/reports/mine", headers=auth(ana)).json()
    assert [r["reporter"]["name"] for r in mine] == ["Ana"]


def test_unknown_code_is_404(client):
    assert client.get("/reports/TM-2026-999999").status_code == 404


# --- Confirmări și blocaje -----------------------------------------------------------------


@pytest.fixture
def street(db):
    """Două segmente: unul chiar lângă locul raportului (5 m), altul la 40 m."""
    a, b = add_node(db, *at(-20, 5)), add_node(db, *at(20, 5))
    c, d = add_node(db, *at(-20, 40)), add_node(db, *at(20, 40))
    near, far = add_edge(db, a, b, 40), add_edge(db, c, d, 40)
    db.commit()
    graph = load_graph(db, datetime.now(UTC))
    set_graph(graph)
    yield graph, near, far
    set_graph(None)


def active_blocks(db) -> set[int]:
    return set(db.scalars(RouteBlock.__table__.select().with_only_columns(RouteBlock.edge_id)))


def test_trusted_user_blocks_nearby_segments_at_once(client, db, ana, street, uploads, outbox):
    graph, near, far = street
    send_report(client, auth(ana))
    assert active_blocks(db) == {near.id}  # 15 m: segmentul de la 40 m rămâne liber
    assert graph.blocked == {near.id}  # și graful din memorie știe, în același request


def test_user_with_50_needs_a_confirmation_to_block(client, db, mihai, street, uploads, outbox):
    graph, near, _ = street
    half = make_user(db, email="radu@exemplu.ro", trust_level=50)
    report_id = send_report(client, auth(half)).json()["id"]
    assert active_blocks(db) == set() and graph.blocked == set()

    res = client.post(
        f"/reports/{report_id}/confirm", json={"kind": "confirm"}, headers=auth(mihai)
    )
    assert res.json()["confirmations"] == 1
    assert graph.blocked == {near.id}


def test_same_answer_twice_is_400(client, ana, mihai, uploads, outbox):
    report_id = send_report(client, auth(ana)).json()["id"]
    url = f"/reports/{report_id}/confirm"
    assert client.post(url, json={"kind": "inca_exista"}, headers=auth(mihai)).status_code == 200
    assert client.post(url, json={"kind": "inca_exista"}, headers=auth(mihai)).status_code == 400


def test_three_fixed_answers_lift_the_block(client, db, ana, street, uploads, outbox):
    graph, near, _ = street
    report_id = send_report(client, auth(ana)).json()["id"]
    assert graph.blocked == {near.id}
    for i in range(3):
        neighbour = make_user(db, email=f"vecin{i}@exemplu.ro")
        res = client.post(
            f"/reports/{report_id}/confirm", json={"kind": "rezolvat"}, headers=auth(neighbour)
        )
    assert res.json()["possibly_resolved"] is True
    assert res.json()["status"] == "in_lucru"  # adminul îl închide
    assert graph.blocked == set()
