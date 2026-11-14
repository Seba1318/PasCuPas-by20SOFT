"""Funcții comune pentru teste: conturi, token-uri, puncte și segmente în baza de test."""

from datetime import timedelta

from geoalchemy2 import WKTElement

from app.models import GraphEdge, GraphNode, User
from app.security import create_token, hash_password, password_stamp

PASSWORD = "parola-buna1"


def make_user(db, email="ana@exemplu.ro", password=PASSWORD, **fields) -> User:
    user = User(email=email, password_hash=hash_password(password), is_verified=True, **fields)
    db.add(user)
    db.commit()
    return user


def auth(user: User) -> dict:
    """Header-ul Authorization pentru un utilizator, fără să trecem prin /auth/login."""
    token = create_token(
        user.id, "access", timedelta(hours=1), pca=password_stamp(user.password_changed_at)
    )
    return {"Authorization": f"Bearer {token}"}


def point(lon: float, lat: float) -> WKTElement:
    return WKTElement(f"POINT({lon} {lat})", srid=4326)


def add_node(db, lon: float, lat: float) -> GraphNode:
    node = GraphNode(geom=point(lon, lat))
    db.add(node)
    db.flush()
    node.lon, node.lat = lon, lat  # ținute pe obiect, pentru add_edge
    return node


def add_edge(db, a: GraphNode, b: GraphNode, length_m: float, **attrs) -> GraphEdge:
    line = WKTElement(f"LINESTRING({a.lon} {a.lat}, {b.lon} {b.lat})", srid=4326)
    edge = GraphEdge(from_node=a.id, to_node=b.id, geom=line, length_m=length_m, **attrs)
    db.add(edge)
    db.flush()
    return edge


# 0,001° de latitudine ≈ 111 m; 0,001° de longitudine la 45,75° N ≈ 77,6 m.
M_PER_DEG_LAT = 111_195
M_PER_DEG_LON = 77_573  # la latitudinea Timișoarei (45,75° N)
ORIGIN = (21.23, 45.75)


def at(east_m: float, north_m: float) -> tuple[float, float]:
    """Un punct la east_m metri spre est și north_m spre nord de ORIGIN, ca (lon, lat)."""
    return ORIGIN[0] + east_m / M_PER_DEG_LON, ORIGIN[1] + north_m / M_PER_DEG_LAT


def photo_bytes(fmt="JPEG", size=(2400, 1200), taken_at=None, gps=None) -> bytes:
    """O poză generată în memorie, cu EXIF opțional: data (datetime) și GPS ((lon, lat))."""
    from io import BytesIO

    from PIL import Image

    image = Image.new("RGB", size, (90, 140, 200))
    exif = Image.Exif()
    exif[0x0110] = "Telefonul Anei"  # modelul aparatului: trebuie să dispară la salvare
    if taken_at is not None:
        exif.get_ifd(0x8769)[36867] = taken_at.strftime("%Y:%m:%d %H:%M:%S")
    if gps is not None:
        lon, lat = gps
        exif.get_ifd(0x8825).update({1: "N", 2: (lat, 0.0, 0.0), 3: "E", 4: (lon, 0.0, 0.0)})
    buffer = BytesIO()
    image.save(buffer, fmt, exif=exif)
    return buffer.getvalue()


def send_report(client, headers, where=(0, 0), category="rampa_blocata", photo=None, **fields):
    """Trimite un raport ca formularul din frontend (multipart: câmpuri + poză)."""
    data = {"category": category, "location_text": "Bd. Vasile Pârvan", **fields}
    if where is not None:
        data["lon"], data["lat"] = at(*where)
    image = photo if photo is not None else ("poza.jpg", photo_bytes(), "image/jpeg")
    return client.post("/reports", data=data, files={"photo": image}, headers=headers)
