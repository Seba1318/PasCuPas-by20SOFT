"""Cum devin rapoartele și lucrările blocaje de rutare (planul 20SOFT · „Cum devin blocaje
rapoartele și lucrările”).

Un raport blochează segmentele de la cel mult 15 m dacă autorul are încredere 100% sau
raportul are cel puțin o confirmare. Un singur utilizator cu încredere 50% nu poate bloca
singur o stradă. Pentru un vehicul, dotarea defectă devine indisponibilă.

Blocajele se scriu în route_blocks și, în același request, în setul din memorie al grafului.
Când un blocaj se termină, primește active_until = acum; rândul rămâne pentru istoric.
"""

from datetime import datetime, time, timedelta

from sqlalchemy import and_, func, or_, select, update
from sqlalchemy.orm import Session

from app import config
from app.models import GraphEdge, Report, ReportConfirmation, RouteBlock, Vehicle, Work
from app.models.reports import VEHICLE_CATEGORY
from app.routing.graph import load_blocked, loaded_graph

BLOCK_RADIUS_M = 15
SUPPORT_KINDS = ("confirm", "inca_exista")


def support_count(db: Session, report: Report) -> int:
    """Câți utilizatori diferiți au confirmat că problema există."""
    return db.scalar(
        select(func.count(func.distinct(ReportConfirmation.user_id))).where(
            ReportConfirmation.report_id == report.id,
            ReportConfirmation.kind.in_(SUPPORT_KINDS),
        )
    )


def should_block(db: Session, report: Report) -> bool:
    return report.user.trust_level == 100 or support_count(db, report) >= 1


def _active_blocks(report: Report):
    return (
        RouteBlock.source_type == "report",
        RouteBlock.source_id == report.id,
        RouteBlock.active_until.is_(None),
    )


def _sync_memory(db: Session, now: datetime) -> None:
    """Setul de segmente blocate din memorie, recitit după schimbare (dacă graful e încărcat)."""
    graph = loaded_graph()
    if graph is not None:
        graph.blocked = load_blocked(db, now)


def apply_report(db: Session, report: Report, now: datetime) -> None:
    """Pune blocajele unui raport, dacă regulile de încredere o permit. Nu face commit."""
    if report.status != "in_lucru" or report.possibly_resolved or not should_block(db, report):
        return
    if report.category == VEHICLE_CATEGORY:
        vehicle = db.get(Vehicle, report.vehicle_id) if report.vehicle_id else None
        if vehicle and report.equipment == "ramp":
            vehicle.ramp_ok = False
        elif vehicle and report.equipment == "audio":
            vehicle.audio_ok = False
        return
    if db.scalar(select(RouteBlock.id).where(*_active_blocks(report)).limit(1)):
        return  # blocajele există deja
    # Punctul raportului, citit din rândul deja salvat (flush) în bază.
    report_point = select(Report.geom).where(Report.id == report.id).scalar_subquery()
    near = func.ST_DWithin(
        func.geography(GraphEdge.geom), func.geography(report_point), BLOCK_RADIUS_M
    )
    for edge_id in db.scalars(select(GraphEdge.id).where(near)):
        db.add(
            RouteBlock(edge_id=edge_id, source_type="report", source_id=report.id, active_from=now)
        )
    db.flush()
    _sync_memory(db, now)


def lift_report(db: Session, report: Report, now: datetime) -> None:
    """Ridică blocajele unui raport (rezolvat, respins sau 3 răspunsuri „rezolvat”)."""
    db.execute(update(RouteBlock).where(*_active_blocks(report)).values(active_until=now))
    db.flush()
    _sync_memory(db, now)


# --- Lucrări -------------------------------------------------------------------------------

WORK_LINE_RADIUS_M = 10


def work_period(work: Work) -> tuple[datetime, datetime]:
    """De la începutul zilei de start până la sfârșitul zilei de final, în ora României."""
    start = datetime.combine(work.start_date, time(), tzinfo=config.LOCAL_TIME)
    end = datetime.combine(work.end_date + timedelta(days=1), time(), tzinfo=config.LOCAL_TIME)
    return start, end


def apply_work(db: Session, work: Work, now: datetime) -> int:
    """Blochează segmentele atinse de o lucrare cu blocks_route: cele care intersectează
    poligonul sau sunt la cel mult 10 m de linie. Blocajul are perioada lucrării; o lucrare
    viitoare devine activă singură (main.py recitește blocajele la 5 minute)."""
    if not work.blocks_route:
        return 0
    shape = select(Work.geom).where(Work.id == work.id).scalar_subquery()
    is_area = func.ST_GeometryType(shape).in_(("ST_Polygon", "ST_MultiPolygon"))
    touches = func.ST_Intersects(GraphEdge.geom, shape)
    near_line = func.ST_DWithin(
        func.geography(GraphEdge.geom), func.geography(shape), WORK_LINE_RADIUS_M
    )
    start, end = work_period(work)
    edge_ids = db.scalars(
        select(GraphEdge.id).where(or_(and_(is_area, touches), and_(~is_area, near_line)))
    ).all()
    for edge_id in edge_ids:
        db.add(
            RouteBlock(
                edge_id=edge_id,
                source_type="work",
                source_id=work.id,
                active_from=start,
                active_until=end,
            )
        )
    db.flush()
    _sync_memory(db, now)
    return len(edge_ids)


def lift_work(db: Session, work: Work, now: datetime) -> None:
    """La modificarea sau ștergerea unei lucrări: blocajele ei se încheie acum. Cele care nu
    începuseră încă primesc tot active_until = acum, deci nu vor fi niciodată active."""
    db.execute(
        update(RouteBlock)
        .where(
            RouteBlock.source_type == "work",
            RouteBlock.source_id == work.id,
            RouteBlock.active_until > now,
        )
        .values(active_until=now)
    )
    db.flush()
    _sync_memory(db, now)
