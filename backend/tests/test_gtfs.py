"""scripts/import_gtfs.py pe un fișier GTFS mic, construit în test."""

import sys
import zipfile
from datetime import date

import pytest
from sqlalchemy import func, select

from app.models import StopTime, TransitRoute, TransitStop, Trip, Vehicle
from scripts import import_gtfs

FEED = {
    "stops.txt": "stop_id,stop_name,stop_lat,stop_lon\n"
    "A,Complex Studențesc,45.7478,21.2385\n"
    "B,Piața Victoriei,45.7531,21.2250\n"
    "C,Gara de Nord,45.7505,21.2068\n",  # în afara zonei demo
    "routes.txt": "route_id,route_short_name,route_type\nR1,1,0\nV1,V1,4\n",
    "trips.txt": "route_id,service_id,trip_id,trip_headsign,block_id\n"
    "R1,LV,T1,Piața Victoriei,B1\n"
    "R1,LV,T2,Piața Victoriei,B1\n"  # același vehicul (block_id) ca T1
    "R1,LV,T3,Gara de Nord,B2\n",  # o singură oprire în zonă: nu intră
    "stop_times.txt": "trip_id,arrival_time,departure_time,stop_id,stop_sequence\n"
    "T1,08:00:00,08:00:00,A,1\nT1,08:07:00,08:07:00,B,2\nT1,08:12:00,08:12:00,C,3\n"
    "T2,24:50:00,24:50:00,A,1\nT2,25:10:00,25:10:00,B,2\n"
    "T3,09:00:00,09:00:00,B,1\nT3,09:06:00,09:06:00,C,2\n",
    # Luni–vineri, 2–8 noiembrie 2026; luni 2 scoasă, sâmbătă 7 adăugată.
    "calendar.txt": "service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,"
    "start_date,end_date\nLV,1,1,1,1,1,0,0,20261102,20261108\n",
    "calendar_dates.txt": "service_id,date,exception_type\nLV,20261102,2\nLV,20261107,1\n",
}


@pytest.fixture
def feed_file(tmp_path):
    path = tmp_path / "gtfs.zip"
    with zipfile.ZipFile(path, "w") as archive:
        for name, text in FEED.items():
            archive.writestr(name, text)
    return path


def run(monkeypatch, *args):
    monkeypatch.setattr(sys, "argv", ["import_gtfs", *args])
    import_gtfs.main()


def count(db, model) -> int:
    return db.scalar(select(func.count()).select_from(model))


def test_import_keeps_only_the_demo_area(db, feed_file, monkeypatch):
    run(monkeypatch, "--file", str(feed_file))
    assert {s.name for s in db.scalars(select(TransitStop))} == {
        "Complex Studențesc",
        "Piața Victoriei",
    }
    assert [(r.short_name, r.type) for r in db.scalars(select(TransitRoute))] == [("1", "tram")]
    assert {t.gtfs_trip_id for t in db.scalars(select(Trip))} == {"T1", "T2"}
    assert count(db, StopTime) == 4
    assert count(db, Vehicle) == 1  # T1 și T2 au același block_id


def test_service_days_and_times_after_midnight(db, feed_file, monkeypatch):
    run(monkeypatch, "--file", str(feed_file), "--zi-demo", "2026-11-04")
    trip = db.scalar(select(Trip).where(Trip.gtfs_trip_id == "T2"))
    in_feed = [d for d in trip.service_days if date(2026, 11, 2) <= d <= date(2026, 11, 8)]
    assert in_feed == [date(2026, 11, d) for d in (3, 4, 5, 6, 7)]
    times = db.scalars(select(StopTime.arrival_time).where(StopTime.trip_id == trip.id)).all()
    assert sorted(times) == [24 * 3600 + 50 * 60, 25 * 3600 + 10 * 60]


def trip_days(db, gtfs_trip_id="T1") -> list[date]:
    return db.scalar(select(Trip).where(Trip.gtfs_trip_id == gtfs_trip_id)).service_days


def test_days_before_the_feed_use_the_same_weekday_from_its_first_week(db, feed_file, monkeypatch):
    # Fișierul începe luni, 2 noiembrie; demo-ul e vineri, 30 octombrie.
    run(monkeypatch, "--file", str(feed_file), "--zi-demo", "2026-10-30")
    before = [d for d in trip_days(db) if d < date(2026, 11, 2)]
    # joi 29 (ieri, pentru cursele de după miezul nopții) ca joi 5, vineri 30 ca vineri 6,
    # sâmbătă 31 ca sâmbătă 7 (adăugată în calendar_dates); duminică 1 nu circulă.
    assert before == [date(2026, 10, 29), date(2026, 10, 30), date(2026, 10, 31)]


def test_days_after_the_feed_use_the_same_weekday_from_its_last_week(db, feed_file, monkeypatch):
    # Fișierul se termină duminică, 8 noiembrie; demo-ul e joi, 12 noiembrie.
    run(monkeypatch, "--file", str(feed_file), "--zi-demo", "2026-11-12")
    after = [d for d in trip_days(db) if d > date(2026, 11, 8)]
    # Lunile cad pe luni 2, scoasă din calendar; duminicile nu circulă.
    assert after == [date(2026, 11, d) for d in (11, 12, 13, 14, 17, 18, 19, 20, 21, 24, 25, 26)]


def test_days_inside_the_feed_stay_as_published(db, feed_file, monkeypatch):
    run(monkeypatch, "--file", str(feed_file), "--zi-demo", "2026-11-04")
    assert date(2026, 11, 2) not in trip_days(db)  # scoasă în calendar_dates
    assert date(2026, 11, 8) not in trip_days(db)  # duminică


def test_second_import_needs_replace(db, feed_file, monkeypatch):
    run(monkeypatch, "--file", str(feed_file))
    with pytest.raises(SystemExit):
        run(monkeypatch, "--file", str(feed_file))
    run(monkeypatch, "--file", str(feed_file), "--replace")
    assert count(db, TransitStop) == 2


def test_seconds():
    assert import_gtfs.seconds("05:18:00") == 5 * 3600 + 18 * 60
    assert import_gtfs.seconds("25:10:30") == 90630
