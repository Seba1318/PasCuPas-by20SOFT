"""Dashboard-ul de admin: lista rapoartelor și schimbarea statusului."""

from datetime import UTC, datetime

import pytest

from app.models import Institution, Report
from app.routing.graph import load_graph, set_graph
from tests.helpers import add_edge, add_node, at, auth, make_user, send_report


@pytest.fixture
def people(db):
    city = Institution(name="Primăria Timișoara", type="primarie")
    transport = Institution(name="STPT", type="transport")
    db.add_all([city, transport])
    db.commit()
    return {
        "ana": make_user(db),
        "primarie": make_user(
            db, email="primarie@exemplu.ro", role="admin", institution_id=city.id
        ),
        "stpt": make_user(db, email="stpt@exemplu.ro", role="admin", institution_id=transport.id),
        "super": make_user(db, email="super@exemplu.ro", role="superadmin"),
    }


@pytest.fixture
def two_reports(client, people, uploads, outbox):
    ana = auth(people["ana"])
    street = send_report(client, ana).json()
    vehicle = send_report(client, ana, where=None, category="dotare_vehicul", equipment="audio")
    return street, vehicle.json()


def test_plain_user_has_no_access(client, people):
    assert client.get("/admin/reports", headers=auth(people["ana"])).status_code == 403


def test_list_with_verification_score(client, people, two_reports):
    body = client.get("/admin/reports", headers=auth(people["super"])).json()
    assert body["total"] == 2
    street = next(r for r in body["items"] if r["category"] == "rampa_blocata")
    assert street["score"] == {
        "ai": 30,
        "date": 10,
        "location": 10,
        "total": 50,
        "ai_notes": "neverificat",
    }


def test_each_institution_sees_its_own_reports(client, people, two_reports):
    city = client.get("/admin/reports", headers=auth(people["primarie"])).json()
    transport = client.get("/admin/reports", headers=auth(people["stpt"])).json()
    assert [r["category"] for r in city["items"]] == ["rampa_blocata"]
    assert [r["category"] for r in transport["items"]] == ["dotare_vehicul"]


def test_filters_and_pagination(client, people, two_reports):
    headers = auth(people["super"])
    active = client.get("/admin/reports", params={"status": "active"}, headers=headers).json()
    assert active["total"] == 2
    page = client.get("/admin/reports", params={"limit": 1, "offset": 1}, headers=headers).json()
    assert page["total"] == 2 and len(page["items"]) == 1
    only = client.get(
        "/admin/reports", params={"category": "dotare_vehicul"}, headers=headers
    ).json()
    assert only["total"] == 1


def test_reject_needs_a_reason(client, people, two_reports):
    street, _ = two_reports
    url, headers = f"/admin/reports/{street['id']}", auth(people["primarie"])
    res = client.patch(url, json={"status": "respins"}, headers=headers)
    assert res.status_code == 422
    res = client.patch(
        url,
        json={"status": "respins", "reason": "Poza nu arată problema", "is_false": True},
        headers=headers,
    )
    assert res.status_code == 200
    assert res.json()["status"] == "respins" and res.json()["is_false"] is True


def test_admin_cannot_change_another_institutions_report(client, people, two_reports):
    street, _ = two_reports
    res = client.patch(
        f"/admin/reports/{street['id']}", json={"status": "rezolvat"}, headers=auth(people["stpt"])
    )
    assert res.status_code == 404


def test_resolving_lifts_the_block_and_reopening_restores_it(client, db, people, uploads, outbox):
    a, b = add_node(db, *at(-20, 5)), add_node(db, *at(20, 5))
    edge = add_edge(db, a, b, 40)
    db.commit()
    graph = load_graph(db, datetime.now(UTC))
    set_graph(graph)
    try:
        report = send_report(client, auth(people["ana"])).json()
        assert graph.blocked == {edge.id}
        url, headers = f"/admin/reports/{report['id']}", auth(people["primarie"])

        res = client.patch(url, json={"status": "rezolvat"}, headers=headers)
        assert res.json()["status"] == "rezolvat" and res.json()["resolved_at"]
        assert graph.blocked == set()
        assert db.get(Report, report["id"]).resolved_by == people["primarie"].id

        client.patch(url, json={"status": "in_lucru"}, headers=headers)
        assert graph.blocked == {edge.id}
    finally:
        set_graph(None)
