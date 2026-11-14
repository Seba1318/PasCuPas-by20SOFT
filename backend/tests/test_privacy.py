"""Confidențialitatea (F2): exportul datelor și ștergerea contului."""

from datetime import UTC, datetime

from sqlalchemy import func, select

from app.models import (
    AccessibilityProfile,
    Institution,
    Report,
    ReportConfirmation,
    RouteBlock,
    TrustEvent,
    User,
)
from app.routing.graph import load_graph, set_graph
from tests.helpers import add_edge, add_node, at, auth, make_user, send_report


def count(db, model) -> int:
    return db.scalar(select(func.count()).select_from(model))


def test_export_contains_everything_about_the_account(client, db, uploads, outbox):
    ana = make_user(db)
    db.add(AccessibilityProfile(user_id=ana.id, avoid_stairs=True, max_kerb_cm=3))
    db.commit()
    mihai = make_user(db, email="mihai@exemplu.ro")
    mine = send_report(client, auth(ana), description="Mașină pe rampă").json()
    theirs = send_report(client, auth(mihai), where=(500, 0)).json()
    client.post(f"/reports/{theirs['id']}/confirm", json={"kind": "confirm"}, headers=auth(ana))

    data = client.get("/users/me/export", headers=auth(ana)).json()
    assert data["account"]["email"] == "ana@exemplu.ro"
    assert "password_hash" not in data["account"]
    assert data["profile"]["max_kerb_cm"] == 3
    assert [r["public_code"] for r in data["reports"]] == [mine["public_code"]]
    assert data["reports"][0]["description"] == "Mașină pe rampă"
    assert data["reports"][0]["photo_url"].endswith(".jpg")
    assert data["confirmations"] == [
        {
            "report": theirs["public_code"],
            "kind": "confirm",
            "created_at": data["confirmations"][0]["created_at"],
        }
    ]


def test_delete_account_removes_reports_photos_and_blocks(client, db, uploads, outbox):
    a, b = add_node(db, *at(-20, 5)), add_node(db, *at(20, 5))
    edge = add_edge(db, a, b, 40)
    db.commit()
    graph = load_graph(db, datetime.now(UTC))
    set_graph(graph)
    try:
        ana, mihai = make_user(db), make_user(db, email="mihai@exemplu.ro")
        sent = send_report(client, auth(ana)).json()
        other = send_report(client, auth(mihai), where=(500, 0)).json()
        client.post(f"/reports/{other['id']}/confirm", json={"kind": "confirm"}, headers=auth(ana))
        assert graph.blocked == {edge.id} and len(list(uploads.iterdir())) == 2

        res = client.delete("/users/me", headers=auth(ana))
        assert res.status_code == 204

        assert db.scalar(select(User).where(User.email == "ana@exemplu.ro")) is None
        assert client.get(f"/reports/{sent['public_code']}").status_code == 404
        assert count(db, RouteBlock) == 0 and graph.blocked == set()  # traseele nu mai ocolesc
        assert len(list(uploads.iterdir())) == 1  # rămâne doar poza lui Mihai
        assert count(db, ReportConfirmation) == 0  # confirmarea Anei a dispărut
        assert db.get(Report, other["id"]) is not None  # raportul lui Mihai rămâne
        # Token-ul vechi nu mai deschide nimic.
        assert client.get("/users/me", headers=auth(ana)).status_code == 401
    finally:
        set_graph(None)


def test_delete_also_removes_trust_history(client, db):
    ana = make_user(db, trust_level=50)
    db.add(TrustEvent(user_id=ana.id, change=-50, new_level=50, reason="test"))
    db.commit()
    client.delete("/users/me", headers=auth(ana))
    assert count(db, TrustEvent) == 0


def test_admin_accounts_cannot_delete_themselves(client, db):
    city = Institution(name="Primăria", type="primarie")
    db.add(city)
    db.commit()
    admin = make_user(db, email="primarie@exemplu.ro", role="admin", institution_id=city.id)
    res = client.delete("/users/me", headers=auth(admin))
    assert res.status_code == 403
    assert db.get(User, admin.id) is not None
