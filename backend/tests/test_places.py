"""/places: GeoJSON cu [lon, lat], filtrare după zona hărții și după categorie."""

from geoalchemy2 import WKTElement

from app.models import Place

BBOX = "21.215,45.738,21.248,45.756"


def add_place(db, name, category, lon, lat, **attributes) -> Place:
    place = Place(
        name=name,
        category=category,
        geom=WKTElement(f"POINT({lon} {lat})", srid=4326),
        attributes=attributes,
    )
    db.add(place)
    db.commit()
    return place


def test_places_in_bbox_as_geojson(client, db):
    add_place(db, "Rectoratul UPT", "building", 21.2257, 45.7536, lift=True)
    add_place(db, "Gara de Nord", "building", 21.2068, 45.7505)  # în afara zonei

    res = client.get("/places", params={"bbox": BBOX})
    assert res.status_code == 200
    body = res.json()
    assert body["type"] == "FeatureCollection"
    assert [f["properties"]["name"] for f in body["features"]] == ["Rectoratul UPT"]
    feature = body["features"][0]
    assert feature["geometry"] == {"type": "Point", "coordinates": [21.2257, 45.7536]}
    assert feature["properties"]["attributes"] == {"lift": True}


def test_places_filter_by_category(client, db):
    add_place(db, "Rampă UVT", "ramp", 21.2316, 45.7473)
    add_place(db, "Bancă", "bench", 21.2382, 45.7472)
    res = client.get("/places", params={"bbox": BBOX, "category": "ramp"})
    assert [f["properties"]["category"] for f in res.json()["features"]] == ["ramp"]


def test_bad_bbox_is_400(client):
    assert client.get("/places", params={"bbox": "1,2,3"}).status_code == 400
    assert client.get("/places", params={"bbox": "21.3,45.7,21.2,45.8"}).status_code == 400


def test_place_details_and_404(client, db):
    place = add_place(db, "Toaletă accesibilă UVT", "toilet", 21.2307, 45.7469)
    res = client.get(f"/places/{place.id}")
    assert res.status_code == 200
    assert res.json()["properties"]["name"] == "Toaletă accesibilă UVT"
    missing = client.get("/places/9999")
    assert missing.status_code == 404
    assert missing.json() == {"detail": "Locul nu există."}


def test_works_on_map_hide_finished_ones(client, db):
    from datetime import date, timedelta

    from app.models import Institution, Work

    city = Institution(name="Primăria Timișoara", type="primarie")
    db.add(city)
    db.flush()
    line = WKTElement("LINESTRING(21.23 45.747, 21.232 45.747)", srid=4326)
    today = date.today()
    db.add_all(
        [
            Work(
                institution_id=city.id,
                title="Trotuar nou",
                geom=line,
                blocks_route=True,
                start_date=today,
                end_date=today + timedelta(days=10),
            ),
            Work(
                institution_id=city.id,
                title="Terminată",
                geom=line,
                start_date=today - timedelta(days=30),
                end_date=today - timedelta(days=1),
            ),
        ]
    )
    db.commit()
    body = client.get("/works", params={"bbox": BBOX}).json()
    assert [f["properties"]["title"] for f in body["features"]] == ["Trotuar nou"]
    assert body["features"][0]["geometry"]["type"] == "LineString"


def test_transit_stops_in_bbox(client, db):
    from app.models import TransitStop

    db.add(
        TransitStop(
            gtfs_stop_id="s1",
            name="Complex Studențesc",
            geom=WKTElement("POINT(21.2385 45.7478)", srid=4326),
            wheelchair_boarding=True,
        )
    )
    db.commit()
    body = client.get("/transit/stops", params={"bbox": BBOX}).json()
    assert body["features"][0]["properties"]["name"] == "Complex Studențesc"
    assert body["features"][0]["properties"]["wheelchair_boarding"] is True
