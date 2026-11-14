"""Cât păstrăm datele (planul 20SOFT · „Ce am ajustat” și Raportare; pagina F2).

- Pozele rapoartelor se șterg după 30 de zile. Raportul rămâne, fără poză, pentru statistici.
- Un raport rezolvat dispare de pe hartă după 3 zile (hidden_at), dar rămâne în bază: fără
  el, clasamentul zonelor și timpul mediu de rezolvare n-ar avea din ce să se calculeze.

main.py rulează apply_retention la fiecare 5 minute, odată cu reîncărcarea blocajelor.
"""

import logging
from datetime import datetime, timedelta

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app import config
from app.models import Report

log = logging.getLogger(__name__)

PHOTO_DAYS = timedelta(days=30)
HIDE_AFTER_RESOLVED = timedelta(days=3)


def delete_old_photos(db: Session, now: datetime) -> int:
    old = db.scalars(
        select(Report).where(Report.photo_path.is_not(None), Report.created_at < now - PHOTO_DAYS)
    ).all()
    for report in old:
        try:
            (config.UPLOAD_DIR / report.photo_path).unlink(missing_ok=True)
        except OSError:
            log.exception("Poza %s nu a putut fi ștearsă", report.photo_path)
            continue  # încercăm din nou la rularea următoare
        report.photo_path = None
    return len(old)


def hide_resolved(db: Session, now: datetime) -> int:
    result = db.execute(
        update(Report)
        .where(
            Report.status == "rezolvat",
            Report.hidden_at.is_(None),
            Report.resolved_at < now - HIDE_AFTER_RESOLVED,
        )
        .values(hidden_at=now)
    )
    return result.rowcount


def apply_retention(db: Session, now: datetime) -> tuple[int, int]:
    """Întoarce (poze șterse, rapoarte ascunse). Face commit."""
    photos, hidden = delete_old_photos(db, now), hide_resolved(db, now)
    db.commit()
    return photos, hidden
