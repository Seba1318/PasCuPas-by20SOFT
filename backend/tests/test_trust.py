"""Gradul de încredere și emailurile de status (planul 20SOFT · test_trust.py)."""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select

from app.models import Institution, RouteBlock, TrustEvent
from app.routing.graph import load_graph, set_graph
from tests.helpers import add_edge, add_node, at, auth, make_user, send_report


@pytest.fixture
def city_admin(db):
    city = Institution(name="Primăria Timișoara", type="primarie")
    db.add(city)
    db.commit()
    return make_user(db, email="primarie@exemplu.ro", role="admin", institution_id=city.id)


def reject_as_false(client, admin, report_id):
    return client.patch(
        f"/admin/reports/{report_id}",
        json={"status": "respins", "is_false": True, "reason": "Poza nu arată problema"},
        headers=auth(admin),
    )


def resolve(client, admin, report_id):
    return client.patch(
        f"/admin/reports/{report_id}", json={"status": "rezolvat"}, headers=auth(admin)
    )


# --- Cazurile obligatorii din plan --------------------------------------------------------


def test_first_and_second_false_report(client, db, city_admin, uploads, outbox):
    ana = make_user(db)
    first = send_report(client, auth(ana), where=(0, 0)).json()["id"]
    second = send_report(client, auth(ana), where=(300, 0)).json()["id"]

    reject_as_false(client, city_admin, first)
    db.refresh(ana)
    assert ana.trust_level == 50 and ana.suspended_until is None

    reject_as_false(client, city_admin, second)
    db.refresh(ana)
    assert ana.trust_level == 0
    days = (ana.suspended_until - datetime.now(UTC)).days
    assert 89 <= days <= 90  # suspendare de 3 luni
    # Suspendat: nu mai poate trimite rapoarte.
    assert send_report(client, auth(ana), where=(600, 0)).status_code == 403

    history = db.scalars(select(TrustEvent).where(TrustEvent.user_id == ana.id)).all()
    assert [(e.change, e.new_level) for e in history] == [(-50, 50), (-50, 0)]
    assert all(e.actor_id == city_admin.id for e in history)


def test_user_with_50_report_without_confirmation_does_not_block(client, db, uploads, outbox):
    a, b = add_node(db, *at(-20, 5)), add_node(db, *at(20, 5))
    add_edge(db, a, b, 40)
    db.commit()
    graph = load_graph(db, datetime.now(UTC))
    set_graph(graph)
    try:
        half = make_user(db, trust_level=50)
        send_report(client, auth(half))
        assert db.scalars(select(RouteBlock)).all() == []
        assert graph.blocked == set()
    finally:
        set_graph(None)


# --- Restul regulilor ---------------------------------------------------------------------


def test_same_report_is_penalised_only_once(client, db, city_admin, uploads, outbox):
    ana = make_user(db)
    report_id = send_report(client, auth(ana)).json()["id"]
    reject_as_false(client, city_admin, report_id)
    client.patch(
        f"/admin/reports/{report_id}", json={"status": "in_lucru"}, headers=auth(city_admin)
    )
    reject_as_false(client, city_admin, report_id)
    db.refresh(ana)
    assert ana.trust_level == 50


def test_account_returns_to_50_after_suspension(client, db):
    ended = datetime.now(UTC) - timedelta(minutes=1)
    user = make_user(db, trust_level=0, suspended_until=ended)
    body = client.get("/users/me", headers=auth(user)).json()
    assert body["trust_level"] == 50 and body["suspended_until"] is None
    event = db.scalar(select(TrustEvent).where(TrustEvent.user_id == user.id))
    assert (event.change, event.new_level, event.actor_id) == (50, 50, None)


def test_five_confirmed_reports_raise_one_level(client, db, city_admin, uploads, outbox):
    ana = make_user(db, trust_level=50)
    ids = [send_report(client, auth(ana), where=(i * 100, 0)).json()["id"] for i in range(5)]
    for report_id in ids[:4]:
        resolve(client, city_admin, report_id)
    # Un raport rezolvat, redeschis și rezolvat din nou se numără o singură dată.
    client.patch(f"/admin/reports/{ids[0]}", json={"status": "in_lucru"}, headers=auth(city_admin))
    resolve(client, city_admin, ids[0])
    db.refresh(ana)
    assert (ana.trust_level, ana.confirmed_reports_count) == (50, 4)

    resolve(client, city_admin, ids[4])
    db.refresh(ana)
    assert ana.trust_level == 100
    assert ana.confirmed_reports_count == 0  # numărătoarea reîncepe după urcare


def test_author_gets_email_when_status_changes(client, db, city_admin, uploads, outbox):
    ana = make_user(db)
    sent = send_report(client, auth(ana)).json()
    client.patch(
        f"/admin/reports/{sent['id']}",
        json={"status": "rezolvat", "message": "Am mutat mașina <b>azi</b>."},
        headers=auth(city_admin),
    )
    mail = outbox[-1]
    assert mail["to"] == "ana@exemplu.ro"
    assert mail["subject"] == f"Problema a fost rezolvată: {sent['public_code']}"
    assert "Am mutat mașina &lt;b&gt;azi&lt;/b&gt;." in mail["html"]  # textul adminului, escapat

    count = len(outbox)
    resolve(client, city_admin, sent["id"])  # același status: niciun email nou
    assert len(outbox) == count


def test_rejection_email_contains_reason(client, db, city_admin, uploads, outbox):
    ana = make_user(db)
    report_id = send_report(client, auth(ana)).json()["id"]
    reject_as_false(client, city_admin, report_id)
    assert "Motivul: Poza nu arată problema." in outbox[-1]["html"]
    db.refresh(ana)
    assert ana.trust_level == 50
