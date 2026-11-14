"""Pornește aplicația FastAPI, încarcă graful și blocajele active, montează /media.

Rulare (din backend/), cu un singur worker, pentru că graful stă în memorie:
    uv run uvicorn app.main:app --env-file ../.env --workers 1 --reload
Documentația interactivă: http://localhost:8000/docs
"""

import asyncio
import contextlib
import logging
from contextlib import asynccontextmanager
from datetime import UTC, datetime

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import func, select

from app import config
from app.database import SessionLocal
from app.models import GraphEdge
from app.routers import admin, auth, places, reports, routes, transit, users
from app.routing.graph import get_graph, load_blocked, load_graph, set_graph
from app.services import retention

log = logging.getLogger(__name__)
REFRESH_BLOCKS_SECONDS = 5 * 60


async def refresh_blocks_forever() -> None:
    """La 5 minute: recitește blocajele active (scoate pe cele expirate, adaugă lucrările care
    tocmai au început) și aplică regulile de păstrare a datelor (pozele după 30 de zile,
    rapoartele rezolvate ascunse după 3 zile). Blocajele noi din rapoarte intră imediat, în
    același request, nu aici."""
    while True:
        await asyncio.sleep(REFRESH_BLOCKS_SECONDS)
        try:
            with SessionLocal() as db:
                now = datetime.now(UTC)
                get_graph().blocked = load_blocked(db, now)
                photos, hidden = retention.apply_retention(db, now)
                if photos or hidden:
                    log.info(
                        "Păstrarea datelor: %d poze șterse, %d rapoarte ascunse", photos, hidden
                    )
        except Exception:
            log.exception("Sarcina periodică a eșuat")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Rulează o dată la pornire (înainte de yield) și o dată la oprire (după)."""
    with SessionLocal() as db:
        if not db.scalar(select(func.count()).select_from(GraphEdge)):
            raise RuntimeError("Graful de străzi e gol. Rulați scripts/import_osm.py")
        graph = load_graph(db, datetime.now(UTC))
    set_graph(graph)
    log.info("Graf încărcat: %d noduri, %d segmente", len(graph.nodes), len(graph.edges))
    task = asyncio.create_task(refresh_blocks_forever())
    yield
    task.cancel()
    with contextlib.suppress(asyncio.CancelledError):
        await task


app = FastAPI(
    title="Pas cu Pas API",
    description="Navigare accesibilă în zona Complexului Studențesc din Timișoara. © 2026 20SOFT",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS: browserul acceptă răspunsurile API-ului doar pe pagina frontendului.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[config.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pozele rapoartelor: salvate în UPLOAD_DIR, servite la /media/<uuid>.jpg.
config.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/media", StaticFiles(directory=config.UPLOAD_DIR), name="media")

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(places.router)
app.include_router(routes.router)
app.include_router(reports.router)
app.include_router(admin.router)
app.include_router(transit.router)

# Erorile de validare scrise de noi (PydanticCustomError) au deja mesaj în română; pentru
# celelalte punem un mesaj general, ca frontendul să nu afișeze text în engleză.
_CUSTOM_ERRORS = {"password", "password_mismatch", "work"}


def _message(error: dict) -> str:
    if error["type"] in _CUSTOM_ERRORS:
        return error["msg"]
    field = str(error["loc"][-1]) if error["loc"] else "câmp"
    if field == "email":
        return "Adresa de email nu pare completă. Exemplu: nume@exemplu.ro"
    if error["type"] == "missing":
        return f"Lipsește câmpul „{field}”."
    return f"Valoarea din câmpul „{field}” nu e validă."


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, exc: RequestValidationError):
    detail = [{"loc": e["loc"], "msg": _message(e), "type": e["type"]} for e in exc.errors()]
    return JSONResponse({"detail": detail}, status_code=status.HTTP_422_UNPROCESSABLE_CONTENT)
