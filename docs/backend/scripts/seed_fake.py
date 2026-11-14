"""Date fictive pentru dezvoltare și demo:
1. instituțiile și conturile demo (parolele sunt în README);
2. atributele de accesibilitate ale segmentelor (borduri, pante, suprafețe, ghidaje, bănci);
3. situațiile de demo: scările spre Rectorat (cu ocol accesibil), UMF fără traseu accesibil,
   o pantă, o bordură înaltă, o alee cu pietriș;
4. dotările și locațiile de pe hartă;
5. lucrări și proiecte ale primăriei;
6. câteva rapoarte de exemplu, ca statisticile din admin să aibă ce arăta.

Din folderul backend/, după scripts/import_osm.py:
    uv run python -m scripts.seed_fake

Se poate rula de mai multe ori: conturile și locurile existente nu se dublează, iar
atributele aleatoare ies la fel de fiecare dată (generator cu sămânță fixă).
Refuză să ruleze dacă DATABASE_URL nu e o bază locală.
"""

import random
import sys
from datetime import UTC, date, datetime, timedelta

from geoalchemy2 import WKTElement
from sqlalchemy import func, select, update
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

from app import config
from app.database import SessionLocal
from app.models import (
    AccessibilityProfile,
    GraphEdge,
    Institution,
    Place,
    Project,
    Report,
    TrustEvent,
    User,
    Work,
)
from app.routing.astar import astar
from app.routing.cost import edge_cost
from app.routing.graph import load_graph
from app.routing.snap import snap
from app.schemas.users import Profile
from app.security import hash_password
from app.services import blocks

LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1", "db"}
DEMO_PASSWORD = "parola-demo1"
SEED = 2026

# (email, rol, nume instituție sau None, încredere)
ACCOUNTS = [
    ("primarie@exemplu.ro", "admin", "Primăria Timișoara", 100),
    ("stpt@exemplu.ro", "admin", "STPT", 100),
    ("andreea@exemplu.ro", "user", None, 100),
    ("mihai@exemplu.ro", "user", None, 50),
]
INSTITUTIONS = {"Primăria Timișoara": "primarie", "STPT": "transport"}
SCOPES = {
    "primarie": ["Rapoarte stradale", "Lucrări", "Proiecte", "Dotări și locații"],
    "transport": ["Vehicule", "Stații", "Rapoarte despre vehicule"],
}
# Profilul implicit pentru scaun cu rotile (planul · Valori inițiale), dat Andreei pentru demo.
WHEELCHAIR = Profile(
    avoid_stairs=True,
    max_kerb_cm=3,
    max_incline_pct=6,
    avoid_rough_surface=True,
    needs_rest_every_m=300,
)
PROFILES = {"andreea@exemplu.ro": WHEELCHAIR}


# --- 1. Conturi ---------------------------------------------------------------------------


def seed_accounts(db: Session) -> None:
    institutions = {}
    for name, kind in INSTITUTIONS.items():
        inst = db.scalar(select(Institution).where(Institution.name == name))
        if inst is None:
            inst = Institution(name=name, type=kind, scopes=SCOPES[kind])
            db.add(inst)
            db.flush()  # ca să primim id-ul înainte de commit
        inst.scopes = inst.scopes or SCOPES[kind]
        institutions[name] = inst

    created = 0
    for email, role, institution, trust in ACCOUNTS:
        if db.scalar(select(User).where(User.email == email)):
            continue
        user = User(
            email=email,
            password_hash=hash_password(DEMO_PASSWORD),
            role=role,
            institution_id=institutions[institution].id if institution else None,
            is_verified=True,
            trust_level=trust,
        )
        db.add(user)
        db.flush()
        if trust == 50:
            db.add(TrustEvent(user_id=user.id, change=-50, reason="Raport marcat fals (date demo)"))
        created += 1
    print(f"Conturi: {created} create, {len(ACCOUNTS) - created} existau deja.")
    for email, profile in PROFILES.items():
        user = db.scalar(select(User).where(User.email == email))
        if user.profile is None:
            db.add(AccessibilityProfile(user_id=user.id, **profile.model_dump()))


# --- 2. Atribute fictive pe segmente ------------------------------------------------------


def _pick(rng: random.Random, options: list[tuple[float, object]]):
    """Alege o valoare după ponderi: [(0.7, a), (0.3, b)] → a în ~70% din cazuri."""
    return rng.choices([v for _, v in options], weights=[w for w, _ in options])[0]


def fake_attributes(rng: random.Random, is_crossing: bool) -> dict:
    kerb = _pick(rng, [(0.7, (0, 0)), (0.2, (1, 6)), (0.1, (7, 15))])
    incline = _pick(rng, [(0.75, (0, 2)), (0.2, (2, 6)), (0.05, (6, 10))])
    return {
        # Bordurile apar la capătul trecerilor de pietoni.
        "kerb_height_cm": round(rng.uniform(*kerb), 1) if is_crossing else 0,
        # incline_pct are semn: urcare în sensul from_node → to_node dacă e pozitiv.
        "incline_pct": round(rng.uniform(*incline) * rng.choice((1, -1)), 1),
        "surface": _pick(rng, [(0.75, "asphalt"), (0.18, "paving"), (0.07, "gravel")]),
        "width_cm": rng.randrange(90, 301, 10),
        "has_tactile": rng.random() < (0.5 if is_crossing else 0.1),
        "has_audio_signal": is_crossing and rng.random() < 0.35,
        "is_lit": rng.random() < 0.85,
        "has_bench": not is_crossing and rng.random() < 0.08,
        # ~10% din segmente primesc trepte; treptele reale din OSM rămân.
        "stairs_extra": rng.random() < 0.10,
    }


def seed_edges(db: Session) -> bool:
    edges = db.execute(
        select(GraphEdge.id, GraphEdge.is_crossing, GraphEdge.has_stairs).order_by(GraphEdge.id)
    ).all()
    if not edges:
        print("Graful e gol: rulați întâi scripts/import_osm.py. Sar peste atributele străzilor.")
        return False
    rng = random.Random(SEED)
    rows = []
    for edge_id, is_crossing, has_stairs in edges:
        attrs = fake_attributes(rng, is_crossing)
        # O trecere de pietoni nu are trepte.
        stairs = has_stairs or (attrs.pop("stairs_extra") and not is_crossing)
        rows.append({"id": edge_id, "has_stairs": stairs, **attrs})
    # UPDATE în masă: SQLAlchemy găsește fiecare rând după cheia primară „id”.
    db.execute(update(GraphEdge), rows)
    print(f"Atribute fictive pe {len(rows)} segmente.")
    return True


# --- 3. Situații de demo ------------------------------------------------------------------

CAMIN_1 = (21.2389, 45.7469)
RECTORAT = (21.2257, 45.7536)
UMF = (21.2236, 45.7525)
DETOUR_M = (80, 300)  # cât de lung poate fi ocolul accesibil (planul: „ocolește 150 m”)

# Situații puse pe segmentul cel mai apropiat de un punct.
SCENARIOS = [
    ("Pantă abruptă lângă UVT", (21.2318, 45.7466), {"incline_pct": 9.0, "has_stairs": False}),
    (
        "Bordură înaltă la trecerea dinspre Complexul Studențesc",
        (21.2372, 45.7476),
        {"kerb_height_cm": 12.0, "has_stairs": False},
    ),
    ("Alee cu pietriș lângă Cantină", (21.2408, 45.7455), {"surface": "gravel"}),
]


def seed_scenarios(db: Session) -> None:
    for title, (lon, lat), attrs in SCENARIOS:
        point = func.ST_SetSRID(func.ST_MakePoint(lon, lat), 4326)
        # <-> = distanța folosind indexul GIST: cel mai apropiat segment de punct.
        edge_id = db.scalar(select(GraphEdge.id).order_by(GraphEdge.geom.op("<->")(point)).limit(1))
        db.execute(update(GraphEdge).where(GraphEdge.id == edge_id).values(**attrs))
        print(f"Scenariu: {title} → segmentul {edge_id}")
    db.flush()
    seed_rectorat_stairs(db)
    seed_umf_unreachable(db)


def _wheelchair_cost(now):
    return lambda edge, direction: edge_cost(edge, direction, WHEELCHAIR, now)


def seed_rectorat_stairs(db: Session) -> None:
    """Scări pe drumul cel mai scurt Căminul 1 → Rectorat, alese astfel încât traseul pentru
    scaun cu rotile să existe și să ocolească 80–300 m. Căutăm cu A* pe graful real, de la
    capătul dinspre Rectorat spre start."""
    now = datetime.now(UTC)
    graph = load_graph(db, now)
    start, goal = snap(db, *CAMIN_1).node_id, snap(db, *RECTORAT).node_id
    shortest = astar(graph, start, goal, lambda edge, direction: edge.length_m)
    accessible = astar(graph, start, goal, _wheelchair_cost(now))
    on_path = [e for e, _ in shortest.steps if graph.edges[e].has_stairs]
    if on_path and accessible is not None:
        detour = accessible.length_m(graph) - shortest.length_m(graph)
        if DETOUR_M[0] <= detour <= DETOUR_M[1]:  # pus deja, la o rulare anterioară
            print(f"Scenariu: Scări spre Rectoratul UPT există deja; ocol de {detour:.0f} m")
            return
    for edge_id, _ in reversed(shortest.steps):
        edge = graph.edges[edge_id]
        if edge.is_crossing or edge.has_stairs:
            continue
        edge.has_stairs = True
        shortest_now = astar(graph, start, goal, lambda e, d: e.length_m)
        accessible = astar(graph, start, goal, _wheelchair_cost(now))
        if accessible is not None:
            detour = accessible.length_m(graph) - shortest_now.length_m(graph)
            if DETOUR_M[0] <= detour <= DETOUR_M[1]:
                db.execute(update(GraphEdge).where(GraphEdge.id == edge_id).values(has_stairs=True))
                print(
                    f"Scenariu: Scări spre Rectoratul UPT → segmentul {edge_id}; "
                    f"traseul accesibil ocolește {detour:.0f} m"
                )
                return
        edge.has_stairs = False
    print("Scenariu: nu am găsit scări potrivite spre Rectorat (graful s-a schimbat?)")


def seed_umf_unreachable(db: Session) -> None:
    """Spre intrarea UMF, toate segmentele au bordură înaltă: pentru scaun cu rotile nu există
    traseu, iar aplicația arată ecranul G1, fără să propună pe tăcute un drum inaccesibil."""
    goal = snap(db, *UMF).node_id
    touching = (GraphEdge.from_node == goal) | (GraphEdge.to_node == goal)
    edges = db.scalars(select(GraphEdge.id).where(touching)).all()
    db.execute(update(GraphEdge).where(touching).values(kerb_height_cm=8.0))
    db.flush()
    graph = load_graph(db, datetime.now(UTC))
    start = snap(db, *CAMIN_1).node_id
    reachable = astar(graph, start, goal, _wheelchair_cost(datetime.now(UTC))) is not None
    print(
        f"Scenariu: UMF fără traseu accesibil → borduri de 8 cm pe {len(edges)} segmente"
        + (" (ATENȚIE: încă accesibil!)" if reachable else "")
    )


# --- 4. Dotări și locații -----------------------------------------------------------------

# Aceleași date ca mock-ul din frontend (src/api/mock/fixtures/places.js): pozițiile sunt
# aproximative și trebuie verificate cu OSM.
UPDATED = "2026-10-15T09:00:00Z"
PLACES = [
    (
        "Rectoratul UPT",
        "building",
        (21.2257, 45.7536),
        {
            "kind": "Rectorat",
            "address": "Piața Victoriei 2",
            "step_free_entrance": True,
            "lift": True,
            "accessible_toilet": True,
            "door_width_cm": 120,
        },
    ),
    (
        "Universitatea de Vest",
        "building",
        (21.2311, 45.7471),
        {
            "kind": "Universitate",
            "address": "Bd. Vasile Pârvan 4",
            "step_free_entrance": True,
            "lift": True,
            "accessible_toilet": False,
            "door_width_cm": 90,
        },
    ),
    (
        "Facultatea de Automatică și Calculatoare",
        "building",
        (21.2265, 45.7470),
        {
            "kind": "Facultate",
            "address": "Bd. Vasile Pârvan 2",
            "step_free_entrance": True,
            "entrance_note": "Rampă la intrarea principală",
            "lift": True,
            "lift_note": "Până la toate etajele",
            "accessible_toilet": False,
            "door_width_cm": 90,
        },
    ),
    (
        "UMF „Victor Babeș”",
        "building",
        (21.2236, 45.7525),
        {
            "kind": "Universitate",
            "address": "Piața Eftimie Murgu 2",
            "step_free_entrance": False,
            "lift": True,
            "accessible_toilet": None,
            "door_width_cm": None,
        },
    ),
    (
        "Căminul 1",
        "building",
        (21.2389, 45.7469),
        {"kind": "Cămin", "address": "Aleea Studenților"},
    ),
    (
        "Cantina Complexului Studențesc",
        "building",
        (21.2402, 45.7460),
        {
            "kind": "Cantină",
            "address": "Aleea Studenților",
            "step_free_entrance": True,
            "accessible_toilet": True,
        },
    ),
    ("Rampă la intrarea de est a Rectoratului", "ramp", (21.2263, 45.7535), {}),
    ("Rampă la intrarea UVT", "ramp", (21.2316, 45.7473), {}),
    ("Lift în pasajul Facultății de AC", "lift", (21.2268, 45.7468), {}),
    ("Intrare accesibilă Cantina", "entrance", (21.2399, 45.7462), {}),
    ("Toaletă accesibilă UVT", "toilet", (21.2307, 45.7469), {}),
    ("Parcare pentru persoane cu dizabilități", "parking", (21.2300, 45.7476), {}),
    ("Ghidaj tactil pe Bd. Vasile Pârvan", "tactile", (21.2290, 45.7474), {}),
    ("Semafor sonor Piața Victoriei", "audio_signal", (21.2262, 45.7528), {}),
    ("Bancă lângă Căminul 1", "bench", (21.2382, 45.7472), {}),
    ("Bancă pe Aleea Studenților", "bench", (21.2360, 45.7478), {}),
]


def seed_places(db: Session) -> None:
    existing = set(db.scalars(select(Place.name)))
    new = [
        Place(
            name=name,
            category=category,
            geom=WKTElement(f"POINT({lon} {lat})", srid=4326),
            attributes={**attrs, "updated_at": UPDATED} if category == "building" else attrs,
        )
        for name, category, (lon, lat), attrs in PLACES
        if name not in existing
    ]
    db.add_all(new)
    print(f"Locuri: {len(new)} adăugate, {len(PLACES) - len(new)} existau deja.")


# --- 5. Lucrări și proiecte ale primăriei ---------------------------------------------------

# Aceleași exemple ca mock-ul din frontend; în realitate se introduc din panoul de admin.
PROJECTS = [
    (
        "Semafoare sonore pe Bd. Vasile Pârvan",
        "Montăm semnale sonore la trecerile dintre Piața Victoriei și Complex.",
        "Piața Victoriei – Complex",
        "2026-11-01",
        "2027-02-28",
        "planificat",
    ),
    ("Rampe la intrările UVT", "", "Bd. Vasile Pârvan 4", "2026-09-01", "2026-12-15", "in_curs"),
    (
        "Ghidaj tactil în Piața Victoriei",
        "",
        "Piața Victoriei",
        "2026-10-01",
        "2026-11-30",
        "in_curs",
    ),
    (
        "Trotuare noi în Complexul Studențesc",
        "",
        "Aleea Studenților",
        "2026-03-01",
        "2026-06-30",
        "finalizat",
    ),
]
WORK_AREA = [
    [21.2330, 45.7486],
    [21.2352, 45.7486],
    [21.2352, 45.7493],
    [21.2330, 45.7493],
    [21.2330, 45.7486],
]


def seed_works_projects(db: Session) -> None:
    city = db.scalar(select(Institution).where(Institution.type == "primarie"))
    added = 0
    for title, description, zone, start, end, state in PROJECTS:
        if db.scalar(select(Project.id).where(Project.title == title)):
            continue
        db.add(
            Project(
                institution_id=city.id,
                title=title,
                description=description or None,
                zone=zone,
                start_date=date.fromisoformat(start),
                end_date=date.fromisoformat(end),
                status=state,
            )
        )
        added += 1
    title = "Refacere trotuar pe Aleea Studenților"
    if not db.scalar(select(Work.id).where(Work.title == title)):
        polygon = ", ".join(f"{lon} {lat}" for lon, lat in WORK_AREA)
        work = Work(
            institution_id=city.id,
            title=title,
            blocks_route=True,
            description="Trotuarul e închis; ocolirea e pe partea cealaltă.",
            geom=WKTElement(f"POLYGON(({polygon}))", srid=4326),
            start_date=date(2026, 10, 10),
            end_date=date(2026, 11, 20),
        )
        db.add(work)
        db.flush()
        edges = blocks.apply_work(db, work, datetime.now(UTC))
        print(f"Lucrare: {title} → {edges} segmente blocate")
    print(f"Proiecte: {added} adăugate.")


# --- 6. Rapoarte de exemplu, pentru statistici --------------------------------------------

# (categorie, (lon, lat), locul, zile în urmă, rezolvat după n zile sau None)
# Cele active sunt ale lui Mihai (încredere 50%, neconfirmate): nu blochează nicio stradă,
# deci nu schimbă traseele din demo. Fără poze (ar fi șterse oricum după 30 de zile).
REPORTS = [
    ("masina_trotuar", (21.2318, 45.7476), "Bd. Vasile Pârvan, lângă UVT", 2, None),
    ("rampa_blocata", (21.2300, 45.7479), "Bd. Vasile Pârvan", 5, None),
    ("masina_trotuar", (21.2290, 45.7481), "Bd. Vasile Pârvan", 9, 3),
    ("bordura_inalta", (21.2385, 45.7472), "Aleea Studenților", 21, None),
    ("ghidaj_tactil", (21.2262, 45.7528), "Piața Victoriei", 12, 4),
    ("semafor_sonor", (21.2250, 45.7531), "Piața Victoriei", 6, None),
    ("lift_defect", (21.2267, 45.7467), "Facultatea de AC", 30, 6),
]


def seed_reports(db: Session) -> None:
    if db.scalar(select(func.count()).select_from(Report)):
        print("Rapoarte: există deja, nu adaug exemple.")
        return
    mihai = db.scalar(select(User).where(User.email == "mihai@exemplu.ro"))
    andreea = db.scalar(select(User).where(User.email == "andreea@exemplu.ro"))
    now = datetime.now(UTC)
    for category, (lon, lat), where, days, fixed_after in REPORTS:
        created = now - timedelta(days=days)
        author = andreea if fixed_after is not None else mihai
        report = Report(
            user_id=author.id,
            category=category,
            location_text=where,
            geom=WKTElement(f"POINT({lon} {lat})", srid=4326),
            created_at=created,
            status="rezolvat" if fixed_after is not None else "in_lucru",
            resolved_at=created + timedelta(days=fixed_after) if fixed_after is not None else None,
            ai_score=30,
            ai_notes="neverificat",
            score_date=10,
            score_location=10,
        )
        db.add(report)
        db.flush()
        report.public_code = f"TM-{created.year}-{report.id:06d}"
    print(f"Rapoarte de exemplu: {len(REPORTS)} adăugate.")


def main() -> None:
    host = make_url(config.DATABASE_URL).host
    if host not in LOCAL_HOSTS:
        sys.exit(f"DATABASE_URL arată spre {host}. seed_fake.py rulează doar pe o bază locală.")
    with SessionLocal() as db:
        seed_accounts(db)
        if seed_edges(db):
            seed_scenarios(db)
        seed_places(db)
        seed_works_projects(db)
        seed_reports(db)
        db.commit()
    print(f"Gata. Parola conturilor demo: {DEMO_PASSWORD}")


if __name__ == "__main__":
    main()
