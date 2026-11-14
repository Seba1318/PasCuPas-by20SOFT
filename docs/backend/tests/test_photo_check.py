"""Verificarea pozelor cu AI (planul 20SOFT · Fluxul unui raport, pasul 2). Testele nu
apelează API-ul real: înlocuiesc ask_model cu un răspuns fix."""

import json

import anthropic
import httpx
import pytest

from app import config
from app.ai import photo_check
from app.models import Report
from tests.helpers import auth, make_user, send_report


@pytest.mark.parametrize(
    ("answer", "points", "notes"),
    [
        (
            {
                "matches": True,
                "confidence": 0.9,
                "looks_generated": False,
                "notes": "Mașină pe rampă.",
            },
            54,
            "Mașină pe rampă.",
        ),
        (
            {
                "matches": False,
                "confidence": 0.8,
                "looks_generated": False,
                "notes": "Se vede un parc.",
            },
            0,
            "Se vede un parc.",
        ),
        (
            {
                "matches": True,
                "confidence": 0.95,
                "looks_generated": True,
                "notes": "Umbre ciudate.",
            },
            0,
            "Poza pare generată sau editată. Umbre ciudate.",
        ),
        (
            {"matches": True, "confidence": 1.7, "looks_generated": False, "notes": "x"},
            60,
            "x",
        ),  # limitat la 1
        (None, 30, "neverificat: modelul a refuzat cererea"),
    ],
)
def test_points_follow_the_plan(answer, points, notes):
    assert photo_check.points_from(answer) == (points, notes)


@pytest.fixture
def ai_on(monkeypatch):
    monkeypatch.setattr(config, "AI_API_KEY", "cheie-de-test")
    asked = []

    def fake(photo, category):
        asked.append((photo[:2], category))
        return {
            "matches": True,
            "confidence": 0.75,
            "looks_generated": False,
            "notes": "Rampă blocată de o mașină.",
        }

    monkeypatch.setattr(photo_check, "ask_model", fake)
    return asked


def test_new_report_gets_ai_score_after_saving(client, db, uploads, outbox, ai_on):
    report_id = send_report(client, auth(make_user(db))).json()["id"]
    report = db.get(Report, report_id)
    assert (report.ai_score, report.ai_notes) == (45, "Rampă blocată de o mașină.")
    assert ai_on == [(b"\xff\xd8", "rampa_blocata")]  # modelul a primit poza salvată (JPEG)


def test_without_key_the_report_stays_unchecked(client, db, uploads, outbox, monkeypatch):
    monkeypatch.setattr(config, "AI_API_KEY", "")
    monkeypatch.setattr(photo_check, "ask_model", lambda *a: pytest.fail("nu trebuia apelat"))
    report_id = send_report(client, auth(make_user(db))).json()["id"]
    assert db.get(Report, report_id).ai_notes == "neverificat"


def test_daily_limit_stops_ai_checks(client, db, uploads, outbox, ai_on, monkeypatch):
    monkeypatch.setattr(config, "AI_DAILY_LIMIT", 1)
    headers = auth(make_user(db))
    first = send_report(client, headers).json()["id"]
    second = send_report(client, headers, where=(500, 0)).json()["id"]
    assert db.get(Report, first).ai_score == 45
    assert (db.get(Report, second).ai_score, db.get(Report, second).ai_notes) == (
        30,
        photo_check.OVER_LIMIT_NOTE,
    )
    assert len(ai_on) == 1  # modelul a fost întrebat o singură dată


def test_api_error_leaves_the_report_unchecked(client, db, uploads, outbox, monkeypatch):
    monkeypatch.setattr(config, "AI_API_KEY", "cheie-de-test")

    def down(photo, category):
        raise anthropic.APIConnectionError(
            request=httpx.Request("POST", "https://api.anthropic.com")
        )

    monkeypatch.setattr(photo_check, "ask_model", down)
    res = send_report(client, auth(make_user(db)))
    assert res.status_code == 201  # utilizatorul nu vede eroarea
    report = db.get(Report, res.json()["id"])
    assert (report.ai_score, report.ai_notes) == (30, "neverificat")


def test_request_sent_to_claude(monkeypatch):
    """Forma cererii: modelul, poza ca base64, schema JSON și fallback-ul la refuz."""
    sent = {}

    class FakeMessages:
        def create(self, **kwargs):
            sent.update(kwargs)
            block = type(
                "B",
                (),
                {
                    "type": "text",
                    "text": json.dumps(
                        {
                            "matches": True,
                            "confidence": 0.5,
                            "looks_generated": False,
                            "notes": "ok",
                        }
                    ),
                },
            )()
            return type("R", (), {"stop_reason": "end_turn", "content": [block]})()

    class FakeClient:
        def __init__(self, **kwargs):
            self.beta = type("Beta", (), {"messages": FakeMessages()})()

    monkeypatch.setattr(photo_check.anthropic, "Anthropic", FakeClient)
    monkeypatch.setattr(config, "AI_MODEL", "")
    answer = photo_check.ask_model(b"\xff\xd8poza", "lift_defect")
    assert answer["confidence"] == 0.5
    assert sent["model"] == "claude-opus-5-5"
    assert sent["fallbacks"] == "default"
    assert sent["output_config"]["format"]["schema"]["required"] == [
        "matches",
        "confidence",
        "looks_generated",
        "notes",
    ]
    image, text = sent["messages"][0]["content"]
    assert image["source"]["media_type"] == "image/jpeg"
    assert "lift defect" in text["text"]


def test_refusal_from_the_model_means_unchecked(monkeypatch):
    """stop_reason „refusal” (după ce și modelul de rezervă a refuzat): nu citim conținutul."""

    class Refusing:
        def create(self, **kwargs):
            return type("R", (), {"stop_reason": "refusal", "content": []})()

    class FakeClient:
        def __init__(self, **kwargs):
            self.beta = type("Beta", (), {"messages": Refusing()})()

    monkeypatch.setattr(photo_check.anthropic, "Anthropic", FakeClient)
    answer = photo_check.ask_model(b"\xff\xd8poza", "rampa_blocata")
    assert answer is None
    assert photo_check.points_from(answer) == (30, "neverificat: modelul a refuzat cererea")
