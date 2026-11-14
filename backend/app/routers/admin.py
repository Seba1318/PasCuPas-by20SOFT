"""Router: admin. Dashboard-ul instituțiilor (planul 20SOFT · Dashboard de admin).

Fiecare endpoint cere rolul admin (sau superadmin) prin Depends(require_role("admin")).
Un admin vede doar ce ține de instituția lui; superadminul vede tot.
"""

import json
import secrets
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator
from pydantic_core import PydanticCustomError
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import bbox_param, require_role
from app.models import (
    GraphEdge,
    Institution,
    Place,
    Project,
    Report,
    RouteBlock,
    TransitRoute,
    TrustEvent,
    User,
    Vehicle,
    Work,
)
from app.models.places import PLACE_CATEGORIES
from app.models.reports import PROJECT_STATUSES, VEHICLE_CATEGORY
from app.models.users import INSTITUTION_TYPES
from app.routers.places import place_feature, work_feature
from app.routers.reports import NOT_FOUND, features, with_coords
from app.routing.graph import load_blocked, loaded_graph
from app.routing.transit import KIND
from app.security import create_token, hash_password, password_stamp
from app.services import blocks, email, trust
from app.services.accounts import user_json

router = APIRouter(prefix="/admin", tags=["admin"])


def visible_to(user: User):
    """Ce rapoarte vede un admin: transportul doar vehiculele, celelalte instituții strada."""
    if user.role == "superadmin":
        return True
    if user.institution.type == "transport":
        return Report.category == VEHICLE_CATEGORY
    return Report.category != VEHICLE_CATEGORY


def admin_item(feature: dict, report: Report) -> dict:
    """Raportul ca în lista adminului: datele publice plus scorul verificării automate."""
    parts = {"ai": report.ai_score or 0, "date": report.score_date or 0}
    parts["location"] = report.score_location or 0
    return {
        **feature["properties"],
        "geometry": feature["geometry"],
        "is_false": report.is_false,
        "score": {**parts, "total": sum(parts.values()), "ai_notes": report.ai_notes or ""},
    }


@router.get("/reports")
def list_reports(
    request: Request,
    status_filter: str = Query(
        "", alias="status", description="active, in_lucru, rezolvat, respins"
    ),
    category: str = "",
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Toate rapoartele, cele mai noi primele, cu filtre și scorul verificării."""
    conditions = [visible_to(user)]
    if status_filter:
        conditions.append(
            Report.status == ("in_lucru" if status_filter == "active" else status_filter)
        )
    if category:
        conditions.append(Report.category == category)
    total = db.scalar(select(func.count()).select_from(Report).where(*conditions))
    rows = db.execute(
        with_coords(*conditions).order_by(Report.created_at.desc()).limit(limit).offset(offset)
    ).all()
    items = [
        admin_item(f, r) for f, (r, _, _) in zip(features(request, db, rows), rows, strict=True)
    ]
    return {"items": items, "total": total}


class ReportChange(BaseModel):
    status: Literal["in_lucru", "rezolvat", "respins"]
    is_false: bool = False
    reason: str | None = Field(None, max_length=200)
    message: str | None = Field(None, max_length=1000)


@router.patch("/reports/{report_id}")
def change_report(
    request: Request,
    background: BackgroundTasks,
    report_id: int,
    change: ReportChange,
    user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Schimbă statusul. La „respins” cere motivul și poate marca raportul ca fals (autorul
    coboară un nivel de încredere). Rezolvat sau respins: blocajele se ridică; redeschis:
    revin. Autorul primește email la fiecare schimbare de status."""
    row = db.execute(with_coords(Report.id == report_id, visible_to(user))).first()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, NOT_FOUND)
    report = row[0]
    if change.status == "respins" and not (change.reason or "").strip():
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Alege motivul respingerii.")
    if change.is_false and change.status != "respins":
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "Doar un raport respins poate fi marcat fals."
        )

    now = datetime.now(UTC)
    previous = report.status
    report.status = change.status
    report.is_false = change.is_false
    if change.status == "in_lucru":
        report.resolved_at = report.resolved_by = None
        report.possibly_resolved = False
        blocks.apply_report(db, report, now)
    else:
        report.resolved_at, report.resolved_by = now, user.id
        blocks.lift_report(db, report, now)
    db.flush()
    if change.is_false:
        trust.report_marked_false(db, report, user, now)
    trust.recount_confirmed(db, report.user, now)
    db.commit()
    if previous != change.status:
        background.add_task(
            email.send_report_status,
            report.user.email,
            report.public_code,
            change.status,
            change.reason,
            change.message,
        )
    return admin_item(features(request, db, [row])[0], report)


# === Secțiunile fiecărei instituții ========================================================

# Ce gestionează fiecare tip de instituție. Superadminul are acces peste tot.
SECTIONS = {
    "primarie": {"works", "projects", "places", "streets"},
    "transport": {"vehicles"},
    "universitate": {"places"},
    "alta": {"places"},
}
OTHER_INSTITUTION = "Secțiunea e gestionată de altă instituție."


def require_section(section: str):
    """Ca require_role("admin"), plus verificarea că instituția adminului gestionează secțiunea."""

    def checker(user: User = Depends(require_role("admin"))) -> User:
        if user.role != "superadmin" and section not in SECTIONS[user.institution.type]:
            raise HTTPException(status.HTTP_403_FORBIDDEN, OTHER_INSTITUTION)
        return user

    return checker


def geometry_sql(geometry: dict):
    """GeoJSON din frontend → geometrie PostGIS în SRID 4326."""
    return func.ST_SetSRID(func.ST_GeomFromGeoJSON(json.dumps(geometry)), 4326)


class GeoJSONShape(BaseModel):
    type: Literal["Point", "LineString", "Polygon"]
    coordinates: list


# --- Lucrări -------------------------------------------------------------------------------


class WorkIn(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    description: str | None = Field(None, max_length=2000)
    start_date: date
    end_date: date
    blocks_route: bool = False
    geometry: GeoJSONShape

    @model_validator(mode="after")
    def check(self):
        if self.end_date < self.start_date:
            raise PydanticCustomError("work", "Data de final e înaintea datei de început.")
        if self.geometry.type == "Point":
            raise PydanticCustomError("work", "Desenează lucrarea ca linie sau zonă pe hartă.")
        return self


class WorkPatch(BaseModel):
    title: str | None = Field(None, min_length=3, max_length=200)
    description: str | None = Field(None, max_length=2000)
    start_date: date | None = None
    end_date: date | None = None
    blocks_route: bool | None = None
    geometry: GeoJSONShape | None = None


def _own_works(user: User):
    return True if user.role == "superadmin" else Work.institution_id == user.institution_id


def _work_or_404(db: Session, user: User, work_id: int) -> Work:
    work = db.scalar(select(Work).where(Work.id == work_id, _own_works(user)))
    if work is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lucrarea nu există.")
    return work


def _work_out(db: Session, work: Work) -> dict:
    geojson = db.scalar(select(func.ST_AsGeoJSON(Work.geom)).where(Work.id == work.id))
    return work_feature(work, geojson)


@router.get("/works")
def list_works(user: User = Depends(require_section("works")), db: Session = Depends(get_db)):
    """Lucrările instituției, inclusiv cele terminate."""
    rows = db.execute(
        select(Work, func.ST_AsGeoJSON(Work.geom))
        .where(_own_works(user))
        .order_by(Work.start_date.desc())
    )
    return {"type": "FeatureCollection", "features": [work_feature(w, g) for w, g in rows]}


@router.post("/works", status_code=status.HTTP_201_CREATED)
def create_work(
    data: WorkIn, user: User = Depends(require_section("works")), db: Session = Depends(get_db)
):
    """Publică o lucrare. Cu blocks_route, segmentele atinse sunt blocate pe perioada ei."""
    institution_id = user.institution_id or db.scalar(
        select(Institution.id).where(Institution.type == "primarie").order_by(Institution.id)
    )
    if institution_id is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Nu există nicio primărie.")
    fields = data.model_dump(exclude={"geometry"})
    work = Work(
        institution_id=institution_id, geom=geometry_sql(data.geometry.model_dump()), **fields
    )
    db.add(work)
    db.flush()
    blocks.apply_work(db, work, datetime.now(UTC))
    db.commit()
    return _work_out(db, work)


@router.patch("/works/{work_id}")
def change_work(
    work_id: int,
    data: WorkPatch,
    user: User = Depends(require_section("works")),
    db: Session = Depends(get_db),
):
    """Modifică o lucrare; blocajele ei se refac după noile date."""
    work = _work_or_404(db, user, work_id)
    changes = data.model_dump(exclude_unset=True, exclude={"geometry"})
    for field, value in changes.items():
        setattr(work, field, value)
    if data.geometry is not None:
        work.geom = geometry_sql(data.geometry.model_dump())
    if work.end_date < work.start_date:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "Data de final e înaintea datei de început."
        )
    db.flush()
    now = datetime.now(UTC)
    blocks.lift_work(db, work, now)
    blocks.apply_work(db, work, now)
    db.commit()
    return _work_out(db, work)


@router.delete("/works/{work_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_work(
    work_id: int, user: User = Depends(require_section("works")), db: Session = Depends(get_db)
):
    """Șterge lucrarea. Blocajele ei se încheie acum (rândurile rămân pentru istoric)."""
    work = _work_or_404(db, user, work_id)
    blocks.lift_work(db, work, datetime.now(UTC))
    db.delete(work)
    db.commit()


# --- Străzi (tronsoanele grafului) ---------------------------------------------------------

# Editorul de străzi (X8) folosește denumiri românești pentru suprafață.
SURFACE_RO = {"asphalt": "asfalt", "paving": "pavele", "gravel": "pietris"}
SURFACE_EN = {ro: en for en, ro in SURFACE_RO.items()}


def _admin_blocked(db: Session) -> set[int]:
    """Segmentele marcate inaccesibile de un admin (blocaj fără dată de final)."""
    return set(
        db.scalars(
            select(RouteBlock.edge_id).where(
                RouteBlock.source_type == "admin", RouteBlock.active_until.is_(None)
            )
        )
    )


def _edge_out(edge: GraphEdge, geojson: str, blocked: set[int]) -> dict:
    return {
        "type": "Feature",
        "id": edge.id,
        "geometry": json.loads(geojson),
        "properties": {
            "id": edge.id,
            "name": edge.name or "Alee fără nume",
            "length_m": round(edge.length_m),
            "has_stairs": edge.has_stairs,
            "kerb_height_cm": edge.kerb_height_cm,
            # Editorul cere 0–30 %; semnul (urcare sau coborâre) se păstrează la salvare.
            "incline_pct": abs(edge.incline_pct),
            "surface": SURFACE_RO[edge.surface],
            "has_tactile": edge.has_tactile,
            "has_audio_signal": edge.has_audio_signal,
            "is_lit": edge.is_lit,
            "has_bench": edge.has_bench,
            "blocked": edge.id in blocked,
        },
    }


@router.get("/edges")
def list_edges(
    bbox: tuple[float, float, float, float] | None = Depends(bbox_param),
    user: User = Depends(require_section("streets")),
    db: Session = Depends(get_db),
):
    """Tronsoanele grafului, ca să poată fi selectate și editate pe hartă."""
    query = select(GraphEdge, func.ST_AsGeoJSON(GraphEdge.geom)).order_by(GraphEdge.id)
    if bbox:
        query = query.where(GraphEdge.geom.op("&&")(func.ST_MakeEnvelope(*bbox, 4326)))
    blocked = _admin_blocked(db)
    features = [_edge_out(edge, geojson, blocked) for edge, geojson in db.execute(query)]
    return {"type": "FeatureCollection", "features": features}


class EdgePatch(BaseModel):
    name: str | None = Field(None, max_length=200)
    has_stairs: bool | None = None
    kerb_height_cm: float | None = Field(None, ge=0, le=30)
    incline_pct: float | None = Field(None, ge=0, le=30)
    surface: Literal["asfalt", "pavele", "pietris", "asphalt", "paving", "gravel"] | None = None
    has_tactile: bool | None = None
    has_audio_signal: bool | None = None
    is_lit: bool | None = None
    has_bench: bool | None = None
    blocked: bool | None = None


@router.patch("/edges/{edge_id}")
def change_edge(
    edge_id: int,
    data: EdgePatch,
    user: User = Depends(require_section("streets")),
    db: Session = Depends(get_db),
):
    """Editează atributele unei străzi sau o marchează inaccesibilă. Actualizează și graful din
    memorie, deci următorul traseu folosește deja noile valori."""
    edge = db.get(GraphEdge, edge_id)
    if edge is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tronsonul nu există.")
    changes = data.model_dump(exclude_unset=True, exclude={"blocked"})
    if "surface" in changes:
        changes["surface"] = SURFACE_EN.get(changes["surface"], changes["surface"])
    if "incline_pct" in changes:
        sign = -1 if edge.incline_pct < 0 else 1
        changes["incline_pct"] = sign * changes["incline_pct"]
    for field, value in changes.items():
        setattr(edge, field, value)

    now = datetime.now(UTC)
    blocked = edge_id in _admin_blocked(db)
    if data.blocked is True and not blocked:
        db.add(RouteBlock(edge_id=edge_id, source_type="admin", source_id=user.id, active_from=now))
    elif data.blocked is False and blocked:
        db.execute(
            update(RouteBlock)
            .where(
                RouteBlock.edge_id == edge_id,
                RouteBlock.source_type == "admin",
                RouteBlock.active_until.is_(None),
            )
            .values(active_until=now)
        )
    db.flush()
    graph = loaded_graph()
    if graph is not None and edge_id in graph.edges:
        memory = graph.edges[edge_id]
        for field, value in changes.items():
            setattr(memory, field, value)
        graph.blocked = load_blocked(db, now)
    db.commit()
    geojson = db.scalar(select(func.ST_AsGeoJSON(GraphEdge.geom)).where(GraphEdge.id == edge_id))
    return _edge_out(edge, geojson, _admin_blocked(db))


# --- Dotări și locații ---------------------------------------------------------------------


class PlaceIn(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    category: Literal[PLACE_CATEGORIES]  # type: ignore[valid-type]
    geometry: GeoJSONShape
    attributes: dict = Field(default_factory=dict)


class PlacePatch(BaseModel):
    name: str | None = Field(None, min_length=2, max_length=200)
    category: Literal[PLACE_CATEGORIES] | None = None  # type: ignore[valid-type]
    geometry: GeoJSONShape | None = None
    attributes: dict | None = None


def _place_out(db: Session, place_id: int) -> dict:
    row = db.execute(
        select(Place, func.ST_X(Place.geom), func.ST_Y(Place.geom)).where(Place.id == place_id)
    ).one()
    return place_feature(*row)


def _point(shape: GeoJSONShape):
    if shape.type != "Point":
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Alege locul pe hartă.")
    return geometry_sql(shape.model_dump())


@router.post("/places", status_code=status.HTTP_201_CREATED)
def create_place(
    data: PlaceIn, user: User = Depends(require_section("places")), db: Session = Depends(get_db)
):
    """Adaugă o dotare (rampă, lift, toaletă...) sau o locație cu fișa de accesibilitate."""
    place = Place(
        name=data.name.strip(),
        category=data.category,
        geom=_point(data.geometry),
        attributes=data.attributes,
        created_by=user.id,
    )
    db.add(place)
    db.commit()
    return _place_out(db, place.id)


@router.patch("/places/{place_id}")
def change_place(
    place_id: int,
    data: PlacePatch,
    user: User = Depends(require_section("places")),
    db: Session = Depends(get_db),
):
    place = db.get(Place, place_id)
    if place is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Locul nu există.")
    if data.name is not None:
        place.name = data.name.strip()
    if data.category is not None:
        place.category = data.category
    if data.geometry is not None:
        place.geom = _point(data.geometry)
    if data.attributes is not None:
        place.attributes = {**place.attributes, **data.attributes}
    db.commit()
    return _place_out(db, place.id)


@router.delete("/places/{place_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_place(
    place_id: int, user: User = Depends(require_section("places")), db: Session = Depends(get_db)
):
    place = db.get(Place, place_id)
    if place is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Locul nu există.")
    db.delete(place)
    db.commit()


# --- Vehicule (operatorul de transport) ----------------------------------------------------

VEHICLE_FIELDS = ("has_ramp", "ramp_ok", "low_floor", "has_audio_announce", "audio_ok")


def _vehicle_out(vehicle: Vehicle, route: TransitRoute, open_reports: int) -> dict:
    return {
        # Frontendul (X9) afișează id-ul ca nume al vehiculului: folosim eticheta.
        "id": vehicle.label,
        "vehicle_id": vehicle.id,
        "route": route.short_name,
        "route_name": f"{KIND[route.type][0]} {route.short_name}",
        "has_visual_display": vehicle.has_visual_display,
        "open_reports": open_reports,
        **{f: getattr(vehicle, f) for f in VEHICLE_FIELDS},
    }


def _open_vehicle_reports(db: Session) -> dict[int, int]:
    rows = db.execute(
        select(Report.vehicle_id, func.count())
        .where(Report.vehicle_id.is_not(None), Report.status == "in_lucru")
        .group_by(Report.vehicle_id)
    )
    return dict(rows.all())


@router.get("/vehicles")
def list_vehicles(user: User = Depends(require_section("vehicles")), db: Session = Depends(get_db)):
    """Vehiculele cu dotările și starea lor."""
    counts = _open_vehicle_reports(db)
    rows = db.execute(
        select(Vehicle, TransitRoute)
        .join(TransitRoute, TransitRoute.id == Vehicle.route_id)
        .order_by(TransitRoute.type, TransitRoute.short_name, Vehicle.label)
    )
    return [_vehicle_out(v, r, counts.get(v.id, 0)) for v, r in rows]


class VehiclePatch(BaseModel):
    ramp_ok: bool | None = None
    audio_ok: bool | None = None
    has_ramp: bool | None = None
    low_floor: bool | None = None
    has_audio_announce: bool | None = None
    has_visual_display: bool | None = None


@router.patch("/vehicles/{vehicle_ref}")
def change_vehicle(
    vehicle_ref: str,
    data: VehiclePatch,
    user: User = Depends(require_section("vehicles")),
    db: Session = Depends(get_db),
):
    """Starea dotărilor unui vehicul (după eticheta din listă, de exemplu „1-01”, sau după id).
    Un vehicul cu rampa stricată nu mai apare în traseele celor care au nevoie de rampă."""
    by = Vehicle.id == int(vehicle_ref) if vehicle_ref.isdigit() else Vehicle.label == vehicle_ref
    row = db.execute(
        select(Vehicle, TransitRoute)
        .join(TransitRoute, TransitRoute.id == Vehicle.route_id)
        .where(by)
    ).first()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Vehiculul nu există.")
    vehicle, route = row
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(vehicle, field, value)
    db.commit()
    return _vehicle_out(vehicle, route, _open_vehicle_reports(db).get(vehicle.id, 0))


# --- Proiectele primăriei (sursa chatbotului) ----------------------------------------------


class ProjectIn(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    description: str | None = Field(None, max_length=4000)
    zone: str | None = Field(None, max_length=200)
    start_date: date | None = None
    end_date: date | None = None
    status: Literal[PROJECT_STATUSES] = "planificat"  # type: ignore[valid-type]
    budget: Decimal | None = Field(None, ge=0)

    @field_validator("start_date", "end_date", "budget", "zone", "description", mode="before")
    @classmethod
    def empty_is_none(cls, value):
        return None if value == "" else value  # formularul trimite "" pentru câmpurile goale


class ProjectPatch(ProjectIn):
    title: str | None = Field(None, min_length=3, max_length=200)
    status: Literal[PROJECT_STATUSES] | None = None  # type: ignore[valid-type]


def _project_out(project: Project) -> dict:
    fields = ("id", "title", "description", "zone", "status")
    return {
        **{f: getattr(project, f) for f in fields},
        "start_date": project.start_date.isoformat() if project.start_date else None,
        "end_date": project.end_date.isoformat() if project.end_date else None,
        "budget": float(project.budget) if project.budget is not None else None,
    }


def _project_or_404(db: Session, user: User, project_id: int) -> Project:
    own = True if user.role == "superadmin" else Project.institution_id == user.institution_id
    project = db.scalar(select(Project).where(Project.id == project_id, own))
    if project is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Proiectul nu există.")
    return project


@router.get("/projects")
def list_projects(user: User = Depends(require_section("projects")), db: Session = Depends(get_db)):
    own = True if user.role == "superadmin" else Project.institution_id == user.institution_id
    projects = db.scalars(select(Project).where(own).order_by(Project.start_date.desc()))
    return [_project_out(p) for p in projects]


@router.post("/projects", status_code=status.HTTP_201_CREATED)
def create_project(
    data: ProjectIn,
    user: User = Depends(require_section("projects")),
    db: Session = Depends(get_db),
):
    institution_id = user.institution_id or db.scalar(
        select(Institution.id).where(Institution.type == "primarie").order_by(Institution.id)
    )
    project = Project(institution_id=institution_id, **data.model_dump())
    db.add(project)
    db.commit()
    return _project_out(project)


@router.patch("/projects/{project_id}")
def change_project(
    project_id: int,
    data: ProjectPatch,
    user: User = Depends(require_section("projects")),
    db: Session = Depends(get_db),
):
    project = _project_or_404(db, user, project_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(project, field, value)
    db.commit()
    return _project_out(project)


@router.delete("/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: int,
    user: User = Depends(require_section("projects")),
    db: Session = Depends(get_db),
):
    db.delete(_project_or_404(db, user, project_id))
    db.commit()


# === Superadmin: utilizatori și instituții ==================================================


def _history(db: Session, user_ids: list[int]) -> dict[int, list[dict]]:
    events = db.scalars(
        select(TrustEvent)
        .where(TrustEvent.user_id.in_(user_ids))
        .order_by(TrustEvent.created_at.desc())
    )
    history: dict[int, list[dict]] = {}
    for e in events:
        level = f"{e.new_level - e.change} → {e.new_level}: " if e.new_level is not None else ""
        history.setdefault(e.user_id, []).append(
            {
                "change": f"{level}{e.reason}",
                "at": e.created_at,
                "by": e.actor.email if e.actor else "automat",
            }
        )
    return history


def _user_items(request: Request, db: Session, users: list[User]) -> list[dict]:
    ids = [u.id for u in users]
    counts = dict(
        db.execute(
            select(Report.user_id, func.count())
            .where(Report.user_id.in_(ids))
            .group_by(Report.user_id)
        ).all()
    )
    false = dict(
        db.execute(
            select(Report.user_id, func.count())
            .where(Report.user_id.in_(ids), Report.is_false.is_(True))
            .group_by(Report.user_id)
        ).all()
    )
    history = _history(db, ids)
    return [
        {
            **user_json(request, u),
            "reports_count": counts.get(u.id, 0),
            "false_count": false.get(u.id, 0),
            "history": history.get(u.id, []),
        }
        for u in users
    ]


@router.get("/users")
def list_users(
    request: Request,
    q: str = "",
    trust_level: int | None = Query(None, alias="trust"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: User = Depends(require_role("superadmin")),
    db: Session = Depends(get_db),
):
    """Utilizatorii, cu nivelul de încredere și istoricul lui."""
    conditions = []
    if q.strip():
        like = f"%{q.strip()}%"
        conditions.append(User.email.ilike(like) | User.display_name.ilike(like))
    if trust_level is not None:
        conditions.append(User.trust_level == trust_level)
    total = db.scalar(select(func.count()).select_from(User).where(*conditions))
    users = db.scalars(
        select(User).where(*conditions).order_by(User.created_at.desc()).limit(limit).offset(offset)
    ).all()
    return {"items": _user_items(request, db, users), "total": total}


class TrustChange(BaseModel):
    trust_level: Literal[100, 50, 0]
    reason: str = Field(max_length=500)


@router.patch("/users/{user_id}")
def change_user_trust(
    request: Request,
    user_id: int,
    data: TrustChange,
    user: User = Depends(require_role("superadmin")),
    db: Session = Depends(get_db),
):
    """Ajustează încrederea unui utilizator. La 0%, contul e suspendat 3 luni."""
    target = db.get(User, user_id)
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Utilizatorul nu există.")
    if not data.reason.strip():
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Scrie motivul schimbării.")
    if data.trust_level != target.trust_level:
        trust.set_level(
            db, target, data.trust_level, data.reason.strip(), datetime.now(UTC), actor=user
        )
        db.commit()
    return _user_items(request, db, [target])[0]


INVITE_DAYS = 7


class AccountIn(BaseModel):
    email: EmailStr
    role: str = "admin"  # „admin” sau „operator” în formular; amândouă devin admin


class InstitutionIn(BaseModel):
    name: str = Field(max_length=200)
    type: Literal[INSTITUTION_TYPES]  # type: ignore[valid-type]
    scopes: list[str] = Field(default_factory=list)
    accounts: list[AccountIn] = Field(default_factory=list)


def _institution_out(db: Session, institution: Institution) -> dict:
    accounts = db.scalar(select(func.count()).where(User.institution_id == institution.id))
    return {
        "id": institution.id,
        "name": institution.name,
        "type": institution.type,
        "scopes": institution.scopes,
        "accounts": accounts,
    }


@router.get("/institutions")
def list_institutions(
    user: User = Depends(require_role("superadmin")), db: Session = Depends(get_db)
):
    institutions = db.scalars(select(Institution).order_by(Institution.name))
    return [_institution_out(db, i) for i in institutions]


@router.post("/institutions", status_code=status.HTTP_201_CREATED)
def create_institution(
    data: InstitutionIn,
    background: BackgroundTasks,
    user: User = Depends(require_role("superadmin")),
    db: Session = Depends(get_db),
):
    """Adaugă o instituție și conturile ei de admin. Fiecare cont primește pe email un link
    (valabil 7 zile) cu care își alege parola; contul nu are parolă până atunci."""
    if not data.name.strip():
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Scrie numele instituției.")
    emails = [a.email.strip().lower() for a in data.accounts]
    taken = db.scalar(select(User.email).where(User.email.in_(emails)))
    if taken:
        raise HTTPException(status.HTTP_409_CONFLICT, f"Există deja un cont cu adresa {taken}.")
    institution = Institution(name=data.name.strip(), type=data.type, scopes=data.scopes)
    db.add(institution)
    db.flush()
    invited = []
    for address in emails:
        account = User(
            email=address,
            # Parolă aleatoare pe care nu o știe nimeni: contul se folosește după invitație.
            password_hash=hash_password(secrets.token_urlsafe(32)),
            role="admin",
            institution_id=institution.id,
        )
        db.add(account)
        invited.append(account)
    db.commit()
    for account in invited:
        token = create_token(
            account.id,
            "reset",
            timedelta(days=INVITE_DAYS),
            pca=password_stamp(account.password_changed_at),
        )
        background.add_task(email.send_invitation, account.email, institution.name, token)
    return _institution_out(db, institution)


# === Statistici ===========================================================================

# Etichetele categoriilor, ca în frontend (src/reports/categories.js).
CATEGORY_LABELS = {
    "rampa_blocata": "rampe blocate",
    "masina_trotuar": "mașini pe trotuar",
    "lift_defect": "lifturi defecte",
    "lucrari": "lucrări",
    "ghidaj_tactil": "ghidaje tactile lipsă",
    "bordura_inalta": "borduri înalte",
    "semafor_sonor": "semafoare sonore defecte",
    "dotare_vehicul": "dotări defecte în vehicule",
    "altceva": "alte probleme",
}
ZONE_RADIUS_M = 60
HEAT_PERIOD = timedelta(days=180)


def _zone_name():
    """Zona unui raport: strada cu nume cea mai apropiată, la cel mult 60 m (din graful OSM)."""
    return (
        select(GraphEdge.name)
        .where(
            GraphEdge.name.is_not(None),
            func.ST_DWithin(
                func.geography(GraphEdge.geom), func.geography(Report.geom), ZONE_RADIUS_M
            ),
        )
        .order_by(GraphEdge.geom.op("<->")(Report.geom))
        .limit(1)
        .scalar_subquery()
    )


@router.get("/stats/heatmap")
def stats_heatmap(user: User = Depends(require_role("admin")), db: Session = Depends(get_db)):
    """Puncte pentru harta termică: [lon, lat, greutate]. Rapoartele active cântăresc 1,
    cele închise 0,5; rapoartele false nu intră."""
    rows = db.execute(
        select(func.ST_X(Report.geom), func.ST_Y(Report.geom), Report.status).where(
            visible_to(user),
            Report.geom.is_not(None),
            Report.is_false.is_(False),
            Report.created_at > datetime.now(UTC) - HEAT_PERIOD,
        )
    )
    return [[lon, lat, 1.0 if state == "in_lucru" else 0.5] for lon, lat, state in rows]


@router.get("/stats/zones")
def stats_zones(user: User = Depends(require_role("admin")), db: Session = Depends(get_db)):
    """Clasamentul zonelor: rapoarte active, timpul mediu de rezolvare și de câte zile nu s-a
    mai intervenit (planul: „clasament al zonelor neglijate”, „timp mediu de rezolvare”)."""
    now = datetime.now(UTC)
    rows = db.execute(
        select(Report, _zone_name().label("zone")).where(
            visible_to(user), Report.geom.is_not(None), Report.is_false.is_(False)
        )
    ).all()
    zones: dict[str, list[Report]] = {}
    for report, zone in rows:
        name = zone or (report.location_text or "").strip() or "Fără stradă cunoscută"
        zones.setdefault(name, []).append(report)

    result = []
    for name, reports in zones.items():
        open_reports = [r for r in reports if r.status == "in_lucru"]
        resolved = [r for r in reports if r.status == "rezolvat" and r.resolved_at]
        days = [(r.resolved_at - r.created_at).total_seconds() / 86400 for r in resolved]
        # Ultima intervenție: ultimul raport închis; fără niciunul, cel mai vechi raport activ.
        actions = [r.resolved_at for r in reports if r.resolved_at]
        since = max(actions) if actions else min(r.created_at for r in reports)
        top = max(
            CATEGORY_LABELS,
            key=lambda c: sum(r.category == c for r in open_reports or reports),
        )
        result.append(
            {
                "zone": name,
                "open_count": len(open_reports),
                "avg_resolution_days": round(sum(days) / len(days), 1) if days else None,
                "last_action_days": (now - since).days,
                "note": f"Mai ales {CATEGORY_LABELS[top]}",
            }
        )
    return sorted(result, key=lambda z: (-z["open_count"], -z["last_action_days"]))
