"""Gradul de încredere (planul 20SOFT · Raportare, verificare și încredere).

    100%  Ridicat  rapoartele blochează rutarea imediat      nivelul de start al oricărui cont
     50%  Mediu    rapoartele au nevoie de o confirmare       primul raport marcat fals
      0%  Scăzut   nu poate trimite rapoarte 3 luni           al doilea raport marcat fals

Două reguli de revenire, decise la revizia din 17 octombrie:
- după cele 3 luni de suspendare, contul revine la 50%;
- 5 rapoarte confirmate ca reale de admin urcă utilizatorul cu un nivel.

Fiecare schimbare de nivel se scrie în trust_events, cu motivul și cine a făcut-o.
Funcțiile nu fac commit: îl face endpoint-ul care le cheamă.
"""

from datetime import datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Report, TrustEvent, User

SUSPENSION = timedelta(days=90)
CONFIRMED_TO_LEVEL_UP = 5
LOWER = {100: 50, 50: 0}


def set_level(
    db: Session,
    user: User,
    level: int,
    reason: str,
    now: datetime,
    actor: User | None = None,
    report: Report | None = None,
) -> None:
    """Schimbă nivelul și notează în istoric. La 0%, contul e suspendat 3 luni."""
    change = level - user.trust_level
    user.trust_level = level
    user.suspended_until = now + SUSPENSION if level == 0 else None
    db.add(
        TrustEvent(
            user_id=user.id,
            change=change,
            new_level=level,
            reason=reason,
            report_id=report.id if report else None,
            actor_id=actor.id if actor else None,
            created_at=now,
        )
    )


def _last_level_change(db: Session, user: User) -> datetime:
    last = db.scalar(
        select(func.max(TrustEvent.created_at)).where(
            TrustEvent.user_id == user.id, TrustEvent.new_level.is_not(None)
        )
    )
    return last or user.created_at


def report_marked_false(db: Session, report: Report, admin: User, now: datetime) -> None:
    """Adminul a respins raportul și l-a marcat fals: autorul coboară un nivel.
    O singură penalizare per raport, chiar dacă adminul schimbă statusul de mai multe ori."""
    author = report.user
    already = db.scalar(
        select(TrustEvent.id).where(
            TrustEvent.user_id == author.id,
            TrustEvent.report_id == report.id,
            TrustEvent.change < 0,
        )
    )
    if already or author.trust_level not in LOWER:
        return
    set_level(
        db,
        author,
        LOWER[author.trust_level],
        f"Raportul {report.public_code} a fost marcat fals",
        now,
        actor=admin,
        report=report,
    )


def recount_confirmed(db: Session, author: User, now: datetime) -> None:
    """Rapoartele rezolvate de admin de la ultima schimbare de nivel. La 5, urcă un nivel.
    Se recalculează din bază (nu se adună), deci schimbările repetate de status nu dublează."""
    since = _last_level_change(db, author)
    author.confirmed_reports_count = db.scalar(
        select(func.count()).where(
            Report.user_id == author.id,
            Report.status == "rezolvat",
            Report.is_false.is_(False),
            Report.resolved_at > since,
        )
    )
    if author.confirmed_reports_count >= CONFIRMED_TO_LEVEL_UP and author.trust_level == 50:
        set_level(db, author, 100, f"{CONFIRMED_TO_LEVEL_UP} rapoarte confirmate ca reale", now)
        author.confirmed_reports_count = 0


def end_suspension_if_due(db: Session, user: User, now: datetime) -> bool:
    """După 3 luni la 0%, contul revine la 50%. Întoarce True dacă s-a schimbat ceva."""
    if user.trust_level == 0 and user.suspended_until and user.suspended_until <= now:
        set_level(db, user, 50, "Suspendarea de 3 luni s-a încheiat", now)
        return True
    return False
