"""Păstrarea datelor: pozele se șterg după 30 de zile, rezolvatele dispar de pe hartă după 3."""

from datetime import UTC, datetime, timedelta

from app.models import Report
from app.services.retention import apply_retention
from tests.helpers import auth, make_user, send_report


def age(db, report_id, days, **fields):
    report = db.get(Report, report_id)
    report.created_at = datetime.now(UTC) - timedelta(days=days)
    for field, value in fields.items():
        setattr(report, field, value)
    db.commit()
    return report


def test_photos_older_than_30_days_are_deleted(client, db, uploads, outbox):
    ana = make_user(db)
    old = send_report(client, auth(ana), where=(0, 0)).json()["id"]
    new = send_report(client, auth(ana), where=(300, 0)).json()["id"]
    age(db, old, 31)
    age(db, new, 29)

    assert apply_retention(db, datetime.now(UTC)) == (1, 0)
    db.expire_all()
    assert db.get(Report, old).photo_path is None
    assert db.get(Report, new).photo_path is not None
    assert len(list(uploads.iterdir())) == 1  # fișierul vechi a dispărut de pe disc
    # Raportul rămâne, fără poză, pentru statistici.
    page = client.get(f"/reports/{db.get(Report, old).public_code}").json()
    assert page["properties"]["photo_url"] is None


def test_resolved_reports_leave_the_map_after_3_days(client, db, uploads, outbox):
    ana = make_user(db)
    now = datetime.now(UTC)
    old = send_report(client, auth(ana), where=(0, 0)).json()["id"]
    recent = send_report(client, auth(ana), where=(300, 0)).json()["id"]
    age(db, old, 10, status="rezolvat", resolved_at=now - timedelta(days=4))
    age(db, recent, 10, status="rezolvat", resolved_at=now - timedelta(days=1))

    assert apply_retention(db, now) == (0, 1)
    db.expire_all()
    assert db.get(Report, old).hidden_at is not None
    assert db.get(Report, recent).hidden_at is None
    visible = client.get("/reports", params={"status": "rezolvat"}).json()["features"]
    assert [f["id"] for f in visible] == [recent]
    assert apply_retention(db, now) == (0, 0)  # a doua rulare nu mai are ce face
