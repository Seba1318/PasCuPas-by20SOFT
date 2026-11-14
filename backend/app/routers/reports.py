"""Router: reports. Raportarea problemelor (planul 20SOFT · Raportare, verificare și încredere).

Fluxul unui raport nou: limită 5/oră → poza verificată → deduplicare (25 m) → cod public →
scor de verificare → blocaje (după regulile de încredere) → email cu codul.
"""

from datetime import UTC, datetime, timedelta

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    Request,
    Response,
    UploadFile,
    status,
)
from geoalchemy2 import WKTElement
from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import config
from app.ai import photo_check
from app.ai.photo_check import score_report
from app.database import get_db
from app.dependencies import bbox_param, get_current_user
from app.models import Report, ReportConfirmation, User
from app.models.reports import CONFIRMATION_KINDS, EQUIPMENT, REPORT_CATEGORIES, VEHICLE_CATEGORY
from app.services import blocks, email
from app.services.accounts import avatar_url, public_name
from app.services.dedup import find_duplicate
from app.services.photos import MAX_BYTES, PhotoError, read_photo, save_photo

router = APIRouter(tags=["reports"])

RATE_LIMIT = 5
RATE_WINDOW = timedelta(hours=1)
HIDE_AFTER_RESOLVED = timedelta(days=3)
RESOLVED_ANSWERS_TO_LIFT = 3
SUPPORT_TO_REOPEN = 2
NOT_FOUND = "Raportul nu există."


# --- Cum arată un raport în JSON -----------------------------------------------------------


def with_coords(*where):
    """Raportul plus longitudinea și latitudinea lui, citite din PostGIS."""
    return select(Report, func.ST_X(Report.geom), func.ST_Y(Report.geom)).where(*where)


def support_counts(db: Session, ids: list[int]) -> dict[int, int]:
    rows = db.execute(
        select(ReportConfirmation.report_id, func.count(func.distinct(ReportConfirmation.user_id)))
        .where(
            ReportConfirmation.report_id.in_(ids),
            ReportConfirmation.kind.in_(blocks.SUPPORT_KINDS),
        )
        .group_by(ReportConfirmation.report_id)
    )
    return dict(rows.all())


def report_feature(request: Request, report: Report, lon, lat, confirmations: int) -> dict:
    timeline = [{"status": "trimis", "at": report.created_at}]
    if report.resolved_at:
        timeline.append({"status": report.status, "at": report.resolved_at})
    photo = str(request.url_for("media", path=report.photo_path)) if report.photo_path else None
    return {
        "type": "Feature",
        "id": report.id,
        "geometry": {"type": "Point", "coordinates": [lon, lat]} if lon is not None else None,
        "properties": {
            "id": report.id,
            "public_code": report.public_code,
            "category": report.category,
            "status": report.status,
            "possibly_resolved": report.possibly_resolved,
            "created_at": report.created_at,
            "resolved_at": report.resolved_at,
            "location_text": report.location_text or "",
            "description": report.description or "",
            "confirmations": confirmations,
            "photo_url": photo,
            "vehicle_id": report.vehicle_id,
            "equipment": report.equipment,
            "reporter": {
                "name": public_name(report.user),
                "user_id": report.user_id,
                "avatar_url": avatar_url(request, report.user),
            },
            "timeline": timeline,
        },
    }


def features(request: Request, db: Session, rows) -> list[dict]:
    rows = list(rows)
    counts = support_counts(db, [report.id for report, _, _ in rows])
    return [report_feature(request, r, lon, lat, counts.get(r.id, 0)) for r, lon, lat in rows]


# --- Trimiterea unui raport ----------------------------------------------------------------


def _point(lon: float | None, lat: float | None) -> tuple[float, float] | None:
    return (lon, lat) if lon is not None and lat is not None else None


def _check_can_report(db: Session, user: User, now: datetime) -> None:
    if user.trust_level == 0 or (user.suspended_until and user.suspended_until > now):
        until = f" până pe {user.suspended_until:%d.%m.%Y}" if user.suspended_until else ""
        raise HTTPException(status.HTTP_403_FORBIDDEN, f"Raportarea e oprită{until}.")
    # Limita se numără în bază, nu în memorie: rămâne corectă și după repornirea serverului.
    recent = db.scalars(
        select(Report.created_at)
        .where(Report.user_id == user.id, Report.created_at > now - RATE_WINDOW)
        .order_by(Report.created_at)
    ).all()
    if len(recent) >= RATE_LIMIT:
        again = (recent[0] + RATE_WINDOW).astimezone(config.LOCAL_TIME)
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            f"Ai trimis {RATE_LIMIT} rapoarte în ultima oră. "
            f"Poți trimite din nou de la {again:%H:%M}.",
        )


def _merge_into(db: Session, existing: Report, user: User, now: datetime) -> dict:
    """Raportul nou e de fapt o confirmare a unuia existent (planul · pasul 3)."""
    if existing.user_id != user.id:
        exists = db.scalar(
            select(ReportConfirmation.id).where(
                ReportConfirmation.report_id == existing.id,
                ReportConfirmation.user_id == user.id,
                ReportConfirmation.kind == "confirm",
            )
        )
        if not exists:
            db.add(ReportConfirmation(report_id=existing.id, user_id=user.id, kind="confirm"))
            db.flush()
        _after_support(db, existing, now)
    db.commit()
    return {
        "merged_into": existing.public_code,
        "confirmations": blocks.support_count(db, existing),
        "category": existing.category,
    }


def _after_support(db: Session, report: Report, now: datetime) -> None:
    """După o confirmare: un raport respins confirmat de 2 oameni revine în lucru; un raport
    cu cel puțin o confirmare blochează rutarea."""
    if report.status == "respins" and blocks.support_count(db, report) >= SUPPORT_TO_REOPEN:
        report.status, report.resolved_at, report.resolved_by = "in_lucru", None, None
    blocks.apply_report(db, report, now)


class CreatedOut(BaseModel):
    id: int | None = None
    public_code: str | None = None
    status: str | None = None
    merged_into: str | None = None
    confirmations: int | None = None
    category: str


@router.post(
    "/reports",
    status_code=status.HTTP_201_CREATED,
    response_model=CreatedOut,
    response_model_exclude_none=True,
)
async def create_report(
    response: Response,
    background: BackgroundTasks,
    category: str = Form(...),
    photo: UploadFile = File(..., description="JPEG sau PNG, maxim 8 MB"),
    lon: float | None = Form(None),
    lat: float | None = Form(None),
    location_text: str | None = Form(None, max_length=200),
    description: str | None = Form(None, max_length=500),
    vehicle_id: int | None = Form(None),
    equipment: str | None = Form(None),
    reporter_lon: float | None = Form(None),
    reporter_lat: float | None = Form(None),
    reporter_accuracy_m: float | None = Form(None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Raport nou (multipart: poză + date). Dacă există deja aceeași problemă la cel mult
    25 m, devine o confirmare a ei și răspunsul conține `merged_into`."""
    now = datetime.now(UTC)
    _check_can_report(db, user, now)
    if category not in REPORT_CATEGORIES:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Alege o categorie din listă.")
    if equipment is not None and equipment not in EQUIPMENT:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Alege rampa sau anunțurile.")
    pin, reporter = _point(lon, lat), _point(reporter_lon, reporter_lat)
    if pin is None and category != VEHICLE_CATEGORY:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "Alege locul pe hartă sau folosește locația ta."
        )

    try:
        picture = read_photo(await photo.read(MAX_BYTES + 1))
    except PhotoError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from None

    if pin is not None:
        existing = find_duplicate(db, category, *pin, now)
        if existing is not None:
            response.status_code = status.HTTP_200_OK
            return _merge_into(db, existing, user, now)

    score = score_report(pin, reporter, picture.gps, picture.taken_at, now)
    report = Report(
        user_id=user.id,
        category=category,
        description=(description or "").strip() or None,
        location_text=(location_text or "").strip() or None,
        geom=WKTElement(f"POINT({pin[0]} {pin[1]})", srid=4326) if pin else None,
        reporter_geom=WKTElement(f"POINT({reporter[0]} {reporter[1]})", srid=4326)
        if reporter
        else None,
        reporter_accuracy_m=reporter_accuracy_m,
        vehicle_id=vehicle_id,
        equipment=equipment,
        photo_path=save_photo(picture, config.UPLOAD_DIR),
        ai_score=score.ai,
        ai_notes=score.ai_notes,
        score_date=score.date,
        score_location=score.location,
    )
    db.add(report)
    try:
        db.flush()  # INSERT: acum avem id-ul, din care facem codul public
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Vehiculul nu există.") from None
    report.public_code = f"TM-{now.year}-{report.id:06d}"
    blocks.apply_report(db, report, now)
    check_with_ai = photo_check.ai_enabled() and photo_check.within_daily_limit(db, now)
    if photo_check.ai_enabled() and not check_with_ai:
        report.ai_notes = photo_check.OVER_LIMIT_NOTE
    db.commit()
    background.add_task(email.send_report_created, user.email, report.public_code)
    if check_with_ai:
        background.add_task(photo_check.verify_report_photo, report.id)
    return {
        "id": report.id,
        "public_code": report.public_code,
        "status": report.status,
        "category": category,
    }


# --- Citirea rapoartelor -------------------------------------------------------------------


@router.get("/reports")
def list_reports(
    request: Request,
    bbox: tuple[float, float, float, float] | None = Depends(bbox_param),
    # ?status=... (numele status e deja folosit de modulul fastapi.status)
    status_filter: str | None = Query("in_lucru", alias="status"),
    db: Session = Depends(get_db),
):
    """Problemele din zona vizibilă, ca alertele din Waze. Un raport rezolvat mai rămâne pe
    hartă 3 zile, apoi dispare (dar rămâne în bază pentru statistici)."""
    now = datetime.now(UTC)
    query = with_coords(
        Report.geom.is_not(None),
        Report.hidden_at.is_(None),
        or_(Report.status != "rezolvat", Report.resolved_at > now - HIDE_AFTER_RESOLVED),
    )
    if status_filter:
        query = query.where(Report.status == status_filter)
    if bbox:
        query = query.where(Report.geom.op("&&")(func.ST_MakeEnvelope(*bbox, 4326)))
    rows = db.execute(query.order_by(Report.created_at.desc()).limit(500)).all()
    return {"type": "FeatureCollection", "features": features(request, db, rows)}


@router.get("/reports/mine")
def my_reports(
    request: Request, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Rapoartele mele, cele mai noi primele."""
    rows = db.execute(
        with_coords(Report.user_id == user.id).order_by(Report.created_at.desc())
    ).all()
    return [
        {**feature["properties"], "geometry": feature["geometry"]}
        for feature in features(request, db, rows)
    ]


@router.get("/reports/{public_code}")
def get_report(request: Request, public_code: str, db: Session = Depends(get_db)):
    """Detaliile și statusul unui raport, după codul public."""
    row = db.execute(with_coords(Report.public_code == public_code.upper())).first()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, NOT_FOUND)
    return features(request, db, [row])[0]


# --- Confirmări ----------------------------------------------------------------------------


class ConfirmIn(BaseModel):
    kind: str


@router.post("/reports/{report_id}/confirm")
def confirm(
    report_id: int,
    data: ConfirmIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """„Confirm”, „Încă există” sau „A fost reparat”. Fiecare utilizator răspunde o singură
    dată pe tip și nu își poate confirma propriul raport."""
    if data.kind not in CONFIRMATION_KINDS:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Răspuns necunoscut.")
    report = db.get(Report, report_id)
    if report is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, NOT_FOUND)
    if report.user_id == user.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Nu îți poți confirma propriul raport.")
    if report.status == "rezolvat":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Raportul e deja rezolvat.")
    db.add(ReportConfirmation(report_id=report.id, user_id=user.id, kind=data.kind))
    try:
        db.flush()
    except IntegrityError:  # cheia unică (report_id, user_id, kind)
        db.rollback()
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "Ai răspuns deja la acest raport."
        ) from None

    now = datetime.now(UTC)
    if data.kind == "rezolvat":
        answers = db.scalar(
            select(func.count()).where(
                ReportConfirmation.report_id == report.id, ReportConfirmation.kind == "rezolvat"
            )
        )
        # 3 oameni spun „reparat”: blocajul se ridică; adminul închide raportul.
        if answers >= RESOLVED_ANSWERS_TO_LIFT and not report.possibly_resolved:
            report.possibly_resolved = True
            blocks.lift_report(db, report, now)
    else:
        _after_support(db, report, now)
    db.commit()
    return {
        "confirmations": blocks.support_count(db, report),
        "possibly_resolved": report.possibly_resolved,
        "status": report.status,
    }
