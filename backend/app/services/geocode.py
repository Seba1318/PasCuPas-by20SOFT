"""Căutarea de locuri și adrese (planul 20SOFT · Reguli de folosire, „Cache pentru căutare”).

1. Întâi în locurile noastre (tabelul places), după nume sau adresă.
2. Dacă nu ajung, în Nominatim (OpenStreetMap), cu regulile lor: cel mult o cerere pe
   secundă, User-Agent propriu, răspunsurile păstrate 24 h. Totul limitat la DEMO_BBOX.
"""

import json
import logging
import threading
import time
import unicodedata
import urllib.parse
import urllib.request

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import config
from app.models import Place

log = logging.getLogger(__name__)

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
CACHE_SECONDS = 24 * 3600
MIN_INTERVAL_SECONDS = 1.0
MAX_RESULTS = 8
SEARCHABLE = ("building",)  # pe hartă, rampele și băncile au straturi; căutăm clădiri

_cache: dict[str, tuple[float, list[dict]]] = {}
_lock = threading.Lock()  # o singură cerere la Nominatim odată
_last_request = 0.0


def fold(text: str) -> str:
    """Litere mici, fără diacritice: „Piața” și „piata” se potrivesc."""
    decomposed = unicodedata.normalize("NFD", text.lower())
    return "".join(ch for ch in decomposed if not unicodedata.combining(ch))


def search_places(db: Session, query: str) -> list[dict]:
    # Locurile din zona demo sunt câteva sute cel mult, deci le comparăm în Python, fără
    # diacritice. (ILIKE din PostgreSQL ar face diferență între „ț” și „t”.)
    rows = db.execute(
        select(Place, func.ST_X(Place.geom), func.ST_Y(Place.geom)).where(
            Place.category.in_(SEARCHABLE)
        )
    ).all()
    needle = fold(query)
    found = []
    for place, lon, lat in rows:
        address = place.attributes.get("address")
        if needle in fold(place.name) or (address and needle in fold(address)):
            found.append(
                {
                    "id": place.id,
                    "name": place.name,
                    "address": address,
                    "attributes": place.attributes,
                    "geometry": {"type": "Point", "coordinates": [lon, lat]},
                    "source": "place",
                }
            )
    return found[:MAX_RESULTS]


def _fetch_nominatim(query: str) -> list[dict]:
    """Cererea propriu-zisă către Nominatim (înlocuită în teste)."""
    min_lon, min_lat, max_lon, max_lat = config.DEMO_BBOX
    params = urllib.parse.urlencode(
        {
            "q": query,
            "format": "jsonv2",
            "limit": 5,
            "accept-language": "ro",
            "viewbox": f"{min_lon},{max_lat},{max_lon},{min_lat}",
            "bounded": 1,  # doar rezultate din viewbox
        }
    )
    request = urllib.request.Request(
        f"{NOMINATIM_URL}?{params}", headers={"User-Agent": config.NOMINATIM_USER_AGENT}
    )
    with urllib.request.urlopen(request, timeout=5) as response:
        return json.load(response)


def search_addresses(query: str) -> list[dict]:
    global _last_request
    key = fold(query)
    cached = _cache.get(key)
    if cached and cached[0] > time.monotonic():
        return cached[1]
    with _lock:
        wait = _last_request + MIN_INTERVAL_SECONDS - time.monotonic()
        if wait > 0:
            time.sleep(wait)
        _last_request = time.monotonic()
        try:
            raw = _fetch_nominatim(query)
        except Exception:
            log.exception("Nominatim nu a răspuns pentru %r", query)
            return []  # fără cache: data viitoare încercăm din nou
    results, seen = [], set()
    for item in raw:
        name, _, address = item.get("display_name", "").partition(", ")
        name = item.get("name") or name
        # O stradă lungă apare în OSM ca mai multe segmente cu același nume: păstrăm unul.
        if (name, address) in seen:
            continue
        seen.add((name, address))
        results.append(
            {
                "id": f"osm-{item.get('osm_type', '')}{item.get('osm_id', '')}",
                "name": name,
                "address": address or None,
                "geometry": {
                    "type": "Point",
                    "coordinates": [float(item["lon"]), float(item["lat"])],
                },
                "source": "address",
            }
        )
    _cache[key] = (time.monotonic() + CACHE_SECONDS, results)
    return results


def search(db: Session, query: str) -> list[dict]:
    query = query.strip()
    if len(query) < 2:
        return []
    own = search_places(db, query)
    if len(own) >= MAX_RESULTS:
        return own
    return own + search_addresses(query)[: MAX_RESULTS - len(own)]
