"""get_current_user, require_role și alte dependențe FastAPI comune.

O dependență e o funcție pe care FastAPI o rulează înainte de endpoint și al cărei
rezultat îl primește endpoint-ul ca argument:

    @router.get("/users/me")
    def me(user: User = Depends(get_current_user)): ...

Dacă dependența aruncă HTTPException, endpoint-ul nu mai rulează deloc.
"""

from datetime import UTC, datetime

from fastapi import Depends, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.security import decode_token, password_stamp
from app.services import trust

# auto_error=False: când lipsește header-ul, dăm noi un 401 cu mesaj în română.
_bearer = HTTPBearer(auto_error=False)


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status.HTTP_401_UNAUTHORIZED, detail, headers={"WWW-Authenticate": "Bearer"}
    )


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    """Citește `Authorization: Bearer <jwt>` și întoarce utilizatorul din bază."""
    if credentials is None:
        raise _unauthorized("Autentifică-te ca să continui.")
    payload = decode_token(credentials.credentials, "access")
    user = db.get(User, int(payload["sub"])) if payload else None
    # După schimbarea parolei, sesiunile vechi se închid (pca nu mai corespunde).
    if user is None or payload.get("pca") != password_stamp(user.password_changed_at):
        raise _unauthorized("Sesiunea a expirat. Autentifică-te din nou.")
    # După 3 luni de suspendare, contul revine singur la 50% (verificăm la fiecare cerere).
    if trust.end_suspension_if_due(db, user, datetime.now(UTC)):
        db.commit()
    return user


# Ce roluri trec de fiecare nivel: superadminul poate tot ce poate un admin.
_ALLOWED = {"admin": {"admin", "superadmin"}, "superadmin": {"superadmin"}}


def require_role(role: str):
    """Fabrică de dependențe: Depends(require_role("admin")) lasă să treacă doar adminii."""

    def checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in _ALLOWED[role]:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Nu ai acces la această secțiune.")
        return user

    return checker


def bbox_param(
    bbox: str | None = Query(
        None,
        description="Zona vizibilă pe hartă: minLon,minLat,maxLon,maxLat",
        examples=["21.215,45.738,21.248,45.756"],
    ),
) -> tuple[float, float, float, float] | None:
    """Transformă ?bbox=... în patru numere. Ordinea e mereu minLon,minLat,maxLon,maxLat."""
    if bbox is None:
        return None
    try:
        min_lon, min_lat, max_lon, max_lat = (float(x) for x in bbox.split(","))
    except ValueError:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "bbox trebuie să fie minLon,minLat,maxLon,maxLat."
        ) from None
    if not (min_lon < max_lon and min_lat < max_lat):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "bbox are colțurile inversate.")
    return min_lon, min_lat, max_lon, max_lat
