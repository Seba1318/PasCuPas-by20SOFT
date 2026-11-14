"""/search: locurile proprii întâi (fără diacritice), apoi Nominatim, cu cache."""

import pytest

from app.services import geocode
from tests.test_places import add_place

NOMINATIM_ANSWER = [
    {
        "osm_type": "way",
        "osm_id": 123,
        "name": "Piața Victoriei",
        "display_name": "Piața Victoriei, Cetate, Timișoara, România",
        "lon": "21.2255",
        "lat": "45.7530",
    }
]


@pytest.fixture
def nominatim(monkeypatch):
    calls = []

    def fake(query):
        calls.append(query)
        return NOMINATIM_ANSWER

    monkeypatch.setattr(geocode, "_fetch_nominatim", fake)
    monkeypatch.setattr(geocode, "_cache", {})
    monkeypatch.setattr(geocode, "MIN_INTERVAL_SECONDS", 0)
    return calls


def test_own_places_first_without_diacritics(client, db, nominatim):
    add_place(db, "Facultatea de Automatică și Calculatoare", "building", 21.2265, 45.747)
    add_place(db, "Rampă la Automatică", "ramp", 21.2266, 45.747)  # rampele nu se caută
    results = client.get("/search", params={"q": "automatica"}).json()
    assert results[0]["name"] == "Facultatea de Automatică și Calculatoare"
    assert results[0]["source"] == "place"
    assert [r["source"] for r in results] == ["place", "address"]


def test_addresses_from_nominatim_are_cached(client, nominatim):
    first = client.get("/search", params={"q": "Piața Victoriei"}).json()
    second = client.get("/search", params={"q": "piata victoriei"}).json()
    assert first == second
    assert first[0] == {
        "id": "osm-way123",
        "name": "Piața Victoriei",
        "address": "Cetate, Timișoara, România",
        "geometry": {"type": "Point", "coordinates": [21.2255, 45.753]},
        "source": "address",
    }
    assert len(nominatim) == 1  # a doua căutare a venit din cache


def test_short_query_returns_nothing(client, nominatim):
    assert client.get("/search", params={"q": "p"}).json() == []
    assert nominatim == []


def test_nominatim_down_still_returns_own_places(client, db, monkeypatch):
    def broken(query):
        raise TimeoutError

    monkeypatch.setattr(geocode, "_fetch_nominatim", broken)
    monkeypatch.setattr(geocode, "_cache", {})
    add_place(db, "Cantina Complexului Studențesc", "building", 21.24, 45.746)
    results = client.get("/search", params={"q": "cantina"}).json()
    assert [r["name"] for r in results] == ["Cantina Complexului Studențesc"]


def test_same_street_in_several_osm_pieces_appears_once(client, monkeypatch):
    piece = {
        "osm_type": "way",
        "name": "Bulevardul Vasile Pârvan",
        "lon": "21.23",
        "lat": "45.747",
        "display_name": "Bulevardul Vasile Pârvan, Timișoara, România",
    }
    answer = [{**piece, "osm_id": i} for i in range(4)]
    monkeypatch.setattr(geocode, "_fetch_nominatim", lambda query: answer)
    monkeypatch.setattr(geocode, "_cache", {})
    monkeypatch.setattr(geocode, "MIN_INTERVAL_SECONDS", 0)
    results = client.get("/search", params={"q": "vasile parvan"}).json()
    assert [r["name"] for r in results] == ["Bulevardul Vasile Pârvan"]
