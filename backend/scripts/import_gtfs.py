"""Importă orarul transportului public din GTFS-ul publicat de SMTT (planul 20SOFT ·
Transportul public și „Detalii pentru import_gtfs.py”).

Din folderul backend/:
    uv run python -m scripts.import_gtfs              # descarcă fișierul de la SMTT
    uv run python -m scripts.import_gtfs --replace    # reface datele de transport
    uv run python -m scripts.import_gtfs --file cale/catre/gtfs.zip

Păstrăm doar ce trece prin zona demo (DEMO_BBOX plus 500 m): stațiile din zonă, cursele care
opresc în cel puțin două dintre ele și opririle din zonă. Liniile și orarul sunt reale.
Dotările vehiculelor și accesibilitatea stațiilor sunt fictive (fișierul nu le are), generate
cu o sămânță fixă, deci ies la fel de fiecare dată.

Date: Societatea Metropolitană de Transport Timișoara (SMTT) / STPT.
"""

import argparse
import csv
import io
import random
import sys
import urllib.request
import zipfile
from collections import defaultdict
from datetime import date, datetime, timedelta

from geoalchemy2 import WKTElement
from sqlalchemy import delete, func, insert, select
from sqlalchemy.orm import Session

from app import config
from app.database import SessionLocal
from app.models import StopTime, TransitRoute, TransitStop, Trip, Vehicle

GTFS_URL = "https://smtt.ro/transit/gtfs/maps/smtt-timisoara-ro.zip"
CACHE = config.REPO_ROOT / "backend" / "cache" / "smtt-timisoara-gtfs.zip"
MARGIN_LON, MARGIN_LAT = 0.0065, 0.0045  # ~500 m la latitudinea Timișoarei
ROUTE_TYPES = {"0": "tram", "3": "bus", "11": "trolleybus"}  # 4 = vaporetto, îl lăsăm deoparte
SEED = 2026
DEMO_DAYS_AHEAD = 14


def read_feed(args) -> zipfile.ZipFile:
    if args.file:
        return zipfile.ZipFile(args.file)
    if not CACHE.exists():
        print(f"Descarc {GTFS_URL} ...")
        CACHE.parent.mkdir(parents=True, exist_ok=True)
        request = urllib.request.Request(
            GTFS_URL, headers={"User-Agent": config.NOMINATIM_USER_AGENT}
        )
        with urllib.request.urlopen(request, timeout=300) as response:
            CACHE.write_bytes(response.read())
    return zipfile.ZipFile(CACHE)


def rows(feed: zipfile.ZipFile, name: str):
    """Rândurile unui fișier din arhivă, ca dicționare. utf-8-sig ignoră BOM-ul de la început."""
    with feed.open(f"{name}.txt") as raw:
        yield from csv.DictReader(io.TextIOWrapper(raw, encoding="utf-8-sig"))


def seconds(hms: str) -> int:
    """„25:10:00” → 90600. GTFS permite ore peste 24 pentru cursele de după miezul nopții."""
    h, m, s = (int(x) for x in hms.split(":"))
    return h * 3600 + m * 60 + s


def service_days(feed: zipfile.ZipFile) -> dict[str, list[date]]:
    """Zilele în care circulă fiecare serviciu: calendar.txt, corectat de calendar_dates.txt
    (1 = zi adăugată, 2 = zi scoasă, de exemplu sărbătorile)."""
    days: dict[str, set[date]] = defaultdict(set)
    weekdays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    for r in rows(feed, "calendar"):
        day = datetime.strptime(r["start_date"], "%Y%m%d").date()
        end = datetime.strptime(r["end_date"], "%Y%m%d").date()
        while day <= end:
            if r[weekdays[day.weekday()]] == "1":
                days[r["service_id"]].add(day)
            day += timedelta(days=1)
    for r in rows(feed, "calendar_dates"):
        day = datetime.strptime(r["date"], "%Y%m%d").date()
        if r["exception_type"] == "1":
            days[r["service_id"]].add(day)
        else:
            days[r["service_id"]].discard(day)
    return {service: sorted(d) for service, d in days.items()}


def feed_range(feed: zipfile.ZipFile) -> tuple[date, date]:
    """Prima și ultima zi pe care le descrie fișierul (calendar.txt și calendar_dates.txt)."""
    texts = [r[k] for r in rows(feed, "calendar") for k in ("start_date", "end_date")]
    texts += [r["date"] for r in rows(feed, "calendar_dates")]
    days = [datetime.strptime(text, "%Y%m%d").date() for text in texts]
    return min(days), max(days)


def cover_demo_days(
    days: dict[str, list[date]], first: date, last: date, demo_day: date
) -> tuple[dict[str, list[date]], list[date]]:
    """SMTT publică orarul pe perioade. Dacă demo-ul cade înainte sau după perioada din fișier,
    zilele din jurul lui (de ieri, pentru cursele de după miezul nopții, până peste 14 zile)
    folosesc orarul aceleiași zile a săptămânii din prima, respectiv ultima săptămână."""
    covered: dict[str, set[date]] = {service: set(d) for service, d in days.items()}
    added = []
    for offset in range(-1, DEMO_DAYS_AHEAD + 1):
        day = demo_day + timedelta(days=offset)
        if first <= day <= last:
            continue
        if day < first:
            same = first + timedelta(days=(day.weekday() - first.weekday()) % 7)
        else:
            same = last - timedelta(days=(last.weekday() - day.weekday()) % 7)
        added.append(day)
        for running_days in covered.values():
            if same in running_days:
                running_days.add(day)
    return {service: sorted(d) for service, d in covered.items()}, added


def fake_vehicle(rng: random.Random, kind: str) -> dict:
    """Dotări fictive: tramvaiele vechi au mai rar podea joasă decât autobuzele."""
    low_floor = rng.random() < (0.6 if kind == "tram" else 0.85)
    return {
        "low_floor": low_floor,
        "has_ramp": low_floor and rng.random() < 0.85,
        "has_audio_announce": rng.random() < 0.9,
        "has_visual_display": rng.random() < 0.85,
        "ramp_ok": True,
        "audio_ok": True,
    }


def clear(db: Session) -> None:
    for model in (StopTime, Trip, Vehicle, TransitRoute, TransitStop):
        db.execute(delete(model))


def main() -> None:
    parser = argparse.ArgumentParser(description="Importă GTFS-ul SMTT pentru zona demo.")
    parser.add_argument("--file", help="arhivă GTFS locală, în loc de descărcare")
    parser.add_argument(
        "--replace", action="store_true", help="șterge datele de transport existente"
    )
    parser.add_argument(
        "--zi-demo",
        type=date.fromisoformat,
        default=datetime.now(config.LOCAL_TIME).date(),
        help="ziua demo-ului (AAAA-LL-ZZ), implicit azi; orarul o acoperă chiar dacă "
        "fișierul GTFS începe mai târziu sau s-a terminat",
    )
    args = parser.parse_args()
    rng = random.Random(SEED)

    with SessionLocal() as db:
        if db.scalar(select(func.count()).select_from(TransitStop)) and not args.replace:
            sys.exit("Există deja date de transport. Folosiți --replace ca să le refaceți.")
        feed = read_feed(args)

        min_lon, min_lat, max_lon, max_lat = config.DEMO_BBOX
        stops = {
            r["stop_id"]: r
            for r in rows(feed, "stops")
            if min_lon - MARGIN_LON <= float(r["stop_lon"]) <= max_lon + MARGIN_LON
            and min_lat - MARGIN_LAT <= float(r["stop_lat"]) <= max_lat + MARGIN_LAT
        }
        times = defaultdict(list)  # trip_id → opririle din zonă
        for r in rows(feed, "stop_times"):
            if r["stop_id"] in stops:
                times[r["trip_id"]].append(r)
        times = {trip: t for trip, t in times.items() if len(t) >= 2}
        routes = {r["route_id"]: r for r in rows(feed, "routes") if r["route_type"] in ROUTE_TYPES}
        trips = [
            r for r in rows(feed, "trips") if r["trip_id"] in times and r["route_id"] in routes
        ]
        first, last = feed_range(feed)
        days, borrowed = cover_demo_days(service_days(feed), first, last, args.zi_demo)
        if borrowed:
            print(
                f"Fișierul GTFS acoperă {first:%d.%m.%Y}–{last:%d.%m.%Y}. Pentru "
                f"{borrowed[0]:%d.%m}–{borrowed[-1]:%d.%m} folosim orarul aceleiași zile a "
                "săptămânii din fișier."
            )

        if args.replace:
            clear(db)

        stop_id = {}
        for gtfs_id, r in sorted(stops.items()):
            stop_id[gtfs_id] = db.scalar(
                insert(TransitStop)
                .values(
                    gtfs_stop_id=gtfs_id,
                    name=r["stop_name"],
                    geom=WKTElement(f"POINT({r['stop_lon']} {r['stop_lat']})", srid=4326),
                    # Fictiv, cum cere planul: GTFS-ul nu are wheelchair_boarding.
                    wheelchair_boarding=rng.random() < 0.7,
                    has_tactile=rng.random() < 0.4,
                    has_display=rng.random() < 0.3,
                )
                .returning(TransitStop.id)
            )
        used_routes = {t["route_id"] for t in trips}
        route_id = {}
        for gtfs_id in sorted(used_routes):
            r = routes[gtfs_id]
            route_id[gtfs_id] = db.scalar(
                insert(TransitRoute)
                .values(
                    gtfs_route_id=gtfs_id,
                    short_name=r["route_short_name"],
                    type=ROUTE_TYPES[r["route_type"]],
                )
                .returning(TransitRoute.id)
            )

        # Un vehicul fictiv pentru fiecare block_id: același vehicul face cursele unui block.
        vehicle_id = {}
        for t in sorted(trips, key=lambda t: (t["route_id"], t.get("block_id") or t["trip_id"])):
            key = (t["route_id"], t.get("block_id") or t["trip_id"])
            if key in vehicle_id:
                continue
            route = routes[t["route_id"]]
            kind = ROUTE_TYPES[route["route_type"]]
            number = sum(1 for k in vehicle_id if k[0] == t["route_id"]) + 1
            vehicle_id[key] = db.scalar(
                insert(Vehicle)
                .values(
                    route_id=route_id[t["route_id"]],
                    label=f"{route['route_short_name']}-{number:02d}",
                    **fake_vehicle(rng, kind),
                )
                .returning(Vehicle.id)
            )

        trip_rows = [
            {
                "gtfs_trip_id": t["trip_id"],
                "route_id": route_id[t["route_id"]],
                "vehicle_id": vehicle_id[(t["route_id"], t.get("block_id") or t["trip_id"])],
                "service_days": days.get(t["service_id"], []),
                "headsign": t.get("trip_headsign") or None,
            }
            for t in trips
        ]
        trip_id = dict(
            (gtfs, ours)
            for ours, gtfs in db.execute(
                insert(Trip).returning(Trip.id, Trip.gtfs_trip_id), trip_rows
            )
        )
        stop_time_rows = [
            {
                "trip_id": trip_id[t["trip_id"]],
                "stop_id": stop_id[s["stop_id"]],
                "sequence": int(s["stop_sequence"]),
                "arrival_time": seconds(s["arrival_time"]),
            }
            for t in trips
            for s in times[t["trip_id"]]
        ]
        db.execute(insert(StopTime), stop_time_rows)
        db.commit()

    print(
        f"Gata: {len(stop_id)} stații, {len(route_id)} linii, {len(vehicle_id)} vehicule, "
        f"{len(trip_rows)} curse, {len(stop_time_rows)} opriri."
    )


if __name__ == "__main__":
    main()
