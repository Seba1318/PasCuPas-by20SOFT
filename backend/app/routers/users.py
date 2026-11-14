"""Router: users. Datele contului curent, profilul de nevoi și confidențialitatea (F2)."""

import logging
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app import config
from app.database import get_db
from app.dependencies import get_current_user
from app.models import (
    AccessibilityProfile,
    Report,
    ReportConfirmation,
    RouteBlock,
    TrustEvent,
    User,
)
from app.routing.graph import load_blocked, loaded_graph
from app.schemas.users import AccountUpdate, Profile
from app.services.accounts import NAME_MIN, user_json
from app.services.photos import MAX_BYTES, PhotoError, read_photo, save_avatar

log = logging.getLogger(__name__)

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me")
def me(request: Request, user: User = Depends(get_current_user)):
    """Datele contului, numele afișat, poza de profil și nivelul de încredere."""
    return user_json(request, user)


@router.patch("/me")
def update_me(
    data: AccountUpdate,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Schimbă numele afișat pe pagina publică a rapoartelor."""
    name = " ".join((data.display_name or "").split())  # fără spații duble sau la capete
    if name and len(name) < NAME_MIN:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "Numele are cel puțin 2 caractere."
        )
    user.display_name = name or None
    db.commit()
    return user_json(request, user)


def _remove_avatar_file(path: str | None) -> None:
    if not path:
        return
    try:
        (config.UPLOAD_DIR / path).unlink(missing_ok=True)
    except OSError:
        log.exception("Poza de profil %s nu a putut fi ștearsă", path)


@router.post("/me/avatar")
async def upload_avatar(
    request: Request,
    photo: UploadFile = File(..., description="JPEG sau PNG, maxim 8 MB"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Poza de profil (opțională): aceeași verificare ca pozele rapoartelor, apoi decupată
    pătrat, 256×256, fără metadate. Poza veche se șterge."""
    try:
        picture = read_photo(await photo.read(MAX_BYTES + 1))
    except PhotoError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from None
    old = user.avatar_path
    user.avatar_path = save_avatar(picture, config.UPLOAD_DIR)
    db.commit()
    _remove_avatar_file(old)
    return user_json(request, user)


@router.delete("/me/avatar")
def delete_avatar(
    request: Request, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Elimină poza de profil; pe pagina raportului apare din nou inițiala."""
    old = user.avatar_path
    user.avatar_path = None
    db.commit()
    _remove_avatar_file(old)
    return user_json(request, user)


@router.get("/me/profile", response_model=Profile | None)
def get_profile(user: User = Depends(get_current_user)):
    """Profilul de nevoi. null înseamnă că utilizatorul nu l-a completat încă: frontendul
    îl trimite atunci la pașii de bun venit."""
    return user.profile


@router.put("/me/profile", response_model=Profile)
def save_profile(
    data: Profile, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Salvează profilul (îl creează la prima salvare). Rutarea îl citește la fiecare traseu."""
    profile = user.profile or AccessibilityProfile(user_id=user.id)
    for field, value in data.model_dump().items():
        setattr(profile, field, value)
    db.add(profile)
    db.commit()
    return profile


# --- Confidențialitate (F2) ----------------------------------------------------------------


@router.get("/me/export")
def export_my_data(
    request: Request, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Tot ce știm despre cont, ca fișier JSON: contul, profilul, rapoartele (cu locul și poza),
    confirmările și istoricul încrederii."""
    reports = db.execute(
        select(Report, func.ST_X(Report.geom), func.ST_Y(Report.geom))
        .where(Report.user_id == user.id)
        .order_by(Report.created_at)
    ).all()
    confirmations = db.execute(
        select(ReportConfirmation, Report.public_code)
        .join(Report, Report.id == ReportConfirmation.report_id)
        .where(ReportConfirmation.user_id == user.id)
        .order_by(ReportConfirmation.created_at)
    ).all()
    history = db.scalars(
        select(TrustEvent).where(TrustEvent.user_id == user.id).order_by(TrustEvent.created_at)
    )
    return {
        "exported_at": datetime.now(UTC),
        "account": user_json(request, user),
        "profile": Profile.model_validate(user.profile).model_dump() if user.profile else None,
        "reports": [
            {
                "public_code": r.public_code,
                "category": r.category,
                "status": r.status,
                "created_at": r.created_at,
                "resolved_at": r.resolved_at,
                "location_text": r.location_text,
                "description": r.description,
                "location": [lon, lat] if lon is not None else None,
                "photo_url": str(request.url_for("media", path=r.photo_path))
                if r.photo_path
                else None,
            }
            for r, lon, lat in reports
        ],
        "confirmations": [
            {"report": code, "kind": c.kind, "created_at": c.created_at}
            for c, code in confirmations
        ],
        "trust_history": [
            {"change": e.change, "new_level": e.new_level, "reason": e.reason, "at": e.created_at}
            for e in history
        ],
    }


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_my_account(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Șterge contul. Rapoartele lui, pozele și blocajele de segment pe care le-au pus dispar
    și ele (regula din design), deci traseele nu le mai ocolesc. Profilul, confirmările și
    istoricul încrederii se șterg în cascadă, din baza de date."""
    if user.role != "user":
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Conturile de administrare le șterge un superadmin."
        )
    reports = db.execute(select(Report.id, Report.photo_path).where(Report.user_id == user.id))
    report_ids, photos = [], []
    for report_id, photo in reports:
        report_ids.append(report_id)
        if photo:
            photos.append(photo)
    db.execute(
        delete(RouteBlock).where(
            RouteBlock.source_type == "report", RouteBlock.source_id.in_(report_ids)
        )
    )
    avatar = user.avatar_path
    db.delete(user)  # ON DELETE CASCADE: profil, rapoarte, confirmări, istoric
    db.commit()
    _remove_avatar_file(avatar)
    for photo in photos:
        try:
            (config.UPLOAD_DIR / photo).unlink(missing_ok=True)
        except OSError:
            log.exception("Poza %s nu a putut fi ștearsă", photo)
    graph = loaded_graph()
    if graph is not None:
        graph.blocked = load_blocked(db, datetime.now(UTC))
