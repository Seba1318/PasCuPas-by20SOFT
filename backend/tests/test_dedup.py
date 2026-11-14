"""Deduplicarea: același loc (25 m) și aceeași categorie (planul 20SOFT · test_dedup.py)."""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import func, select

from app.models import Report, ReportConfirmation
from tests.helpers import auth, make_user, send_report


@pytest.fixture
def first(client, db, uploads, outbox):
    """Ana raportează o rampă blocată în punctul (0, 0)."""
    ana = make_user(db)
    return send_report(client, auth(ana)).json()


@pytest.fixture
def mihai(db):
    return make_user(db, email="mihai@exemplu.ro")


def count(db, model) -> int:
    return db.scalar(select(func.count()).select_from(model))


# --- Cazurile obligatorii din plan --------------------------------------------------------


def test_same_category_20m_away_becomes_a_confirmation(client, db, first, mihai):
    res = send_report(client, auth(mihai), where=(20, 0))
    assert res.status_code == 200
    assert res.json() == {
        "merged_into": first["public_code"],
        "confirmations": 1,
        "category": "rampa_blocata",
    }
    assert count(db, Report) == 1
    assert count(db, ReportConfirmation) == 1


def test_30m_away_is_a_new_report(client, db, first, mihai):
    res = send_report(client, auth(mihai), where=(30, 0))
    assert res.status_code == 201
    assert count(db, Report) == 2


def test_other_category_20m_away_is_a_new_report(client, db, first, mihai):
    res = send_report(client, auth(mihai), where=(20, 0), category="masina_trotuar")
    assert res.status_code == 201
    assert count(db, Report) == 2


# --- Restul regulilor ---------------------------------------------------------------------


def test_own_duplicate_does_not_count_as_confirmation(client, db, first):
    ana = db.scalar(select(Report)).user
    res = send_report(client, auth(ana), where=(10, 0))
    assert res.json()["merged_into"] == first["public_code"]
    assert res.json()["confirmations"] == 0


def test_rejected_report_reopens_after_two_confirmations(client, db, first, mihai):
    report = db.get(Report, first["id"])
    report.status, report.resolved_at = "respins", datetime.now(UTC)
    db.commit()

    send_report(client, auth(mihai), where=(5, 0))
    db.refresh(report)
    assert report.status == "respins"  # o singură confirmare nu ajunge

    send_report(client, auth(make_user(db, email="ioana@exemplu.ro")), where=(5, 5))
    db.refresh(report)
    assert report.status == "in_lucru"


def test_rejected_more_than_30_days_ago_is_not_a_duplicate(client, db, first, mihai):
    report = db.get(Report, first["id"])
    report.status = "respins"
    report.created_at = datetime.now(UTC) - timedelta(days=40)
    db.commit()
    assert send_report(client, auth(mihai), where=(5, 0)).status_code == 201


def test_resolved_report_is_not_a_duplicate(client, db, first, mihai):
    report = db.get(Report, first["id"])
    report.status = "rezolvat"
    db.commit()
    assert send_report(client, auth(mihai), where=(5, 0)).status_code == 201
