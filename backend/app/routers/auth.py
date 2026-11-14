"""Router: auth. Cont nou, confirmare pe email, login, retrimitere, resetarea parolei.

Reguli din plan (Rulare și securitate):
- mesajele nu dezvăluie ce conturi există: login greșit → mereu „Email sau parolă greșite”,
  iar forgot-password și resend-verification răspund la fel indiferent de email;
- cont neconfirmat → 403, cu opțiunea de a retrimite emailul;
- linkurile din emailuri sunt JWT cu `purpose`: confirmarea 24 h, resetarea 30 min.
"""

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import config
from app.database import get_db
from app.models import User
from app.schemas.auth import EmailIn, LoginIn, MessageOut, RegisterIn, ResetPasswordIn, TokenOut
from app.security import (
    create_token,
    decode_token,
    hash_password,
    password_stamp,
    verify_password,
)
from app.services import email

router = APIRouter(prefix="/auth", tags=["auth"])

LINK_INVALID = "Linkul a expirat sau a fost deja folosit."
EMAIL_TAKEN = "Există deja un cont cu acest email."


def _user_by_email(db: Session, address: str) -> User | None:
    return db.scalar(select(User).where(User.email == address))


def _verify_token(user: User) -> str:
    return create_token(user.id, "verify", timedelta(hours=config.VERIFY_TOKEN_HOURS))


def _reset_token(user: User) -> str:
    return create_token(
        user.id,
        "reset",
        timedelta(minutes=config.RESET_TOKEN_MINUTES),
        pca=password_stamp(user.password_changed_at),
    )


@router.post("/register", status_code=status.HTTP_201_CREATED, response_model=MessageOut)
def register(data: RegisterIn, background: BackgroundTasks, db: Session = Depends(get_db)):
    """Cont nou. Trimite emailul de confirmare; contul nu se poate folosi până la confirmare."""
    if _user_by_email(db, data.email):
        raise HTTPException(status.HTTP_409_CONFLICT, EMAIL_TAKEN)
    user = User(email=data.email, password_hash=hash_password(data.password))
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        # Două cereri cu același email în același moment (de exemplu dublu-clic): ambele trec de
        # verificarea de mai sus, dar indexul unic din bază o refuză pe a doua.
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, EMAIL_TAKEN) from None
    background.add_task(email.send_verification_email, user.email, _verify_token(user))
    return {"detail": "Ți-am trimis un email de confirmare."}


@router.get("/verify", response_model=MessageOut)
def verify(token: str, db: Session = Depends(get_db)):
    """Activează contul din linkul primit pe email. Merge o singură dată."""
    payload = decode_token(token, "verify")
    user = db.get(User, int(payload["sub"])) if payload else None
    # Un cont deja confirmat înseamnă că linkul a mai fost folosit.
    if user is None or user.is_verified:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, LINK_INVALID)
    user.is_verified = True
    db.commit()
    return {"detail": "Contul e confirmat."}


@router.post("/login", response_model=TokenOut)
def login(data: LoginIn, db: Session = Depends(get_db)):
    """Întoarce token-ul JWT pe care frontendul îl trimite apoi în header-ul Authorization."""
    user = _user_by_email(db, data.email)
    # verify_password rulează și când contul nu există, ca timpul de răspuns să fie același.
    if not verify_password(data.password, user.password_hash if user else None):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Email sau parolă greșite")
    if not user.is_verified:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Contul nu e confirmat încă. Verifică emailul sau cere un link nou.",
        )
    token = create_token(
        user.id,
        "access",
        timedelta(minutes=config.JWT_EXPIRE_MINUTES),
        pca=password_stamp(user.password_changed_at),
    )
    return {"access_token": token, "token_type": "bearer"}


@router.post("/resend-verification", response_model=MessageOut)
def resend_verification(data: EmailIn, background: BackgroundTasks, db: Session = Depends(get_db)):
    """Retrimite emailul de confirmare. Același răspuns dacă emailul există sau nu."""
    user = _user_by_email(db, data.email)
    if user and not user.is_verified:
        background.add_task(email.send_verification_email, user.email, _verify_token(user))
    return {"detail": "Dacă adresa are un cont neconfirmat, îți trimitem un link nou."}


@router.post("/forgot-password", response_model=MessageOut)
def forgot_password(data: EmailIn, background: BackgroundTasks, db: Session = Depends(get_db)):
    """Trimite linkul de resetare (30 min). Același răspuns dacă emailul există sau nu."""
    user = _user_by_email(db, data.email)
    if user:
        background.add_task(email.send_reset_email, user.email, _reset_token(user))
    return {"detail": "Dacă adresa are cont, îți trimitem un link de resetare."}


@router.post("/reset-password", response_model=MessageOut)
def reset_password(data: ResetPasswordIn, db: Session = Depends(get_db)):
    """Schimbă parola. Actualizează password_changed_at, deci linkul nu mai merge a doua oară
    și toate sesiunile vechi se închid."""
    payload = decode_token(data.token, "reset")
    user = db.get(User, int(payload["sub"])) if payload else None
    if user is None or payload.get("pca") != password_stamp(user.password_changed_at):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, LINK_INVALID)
    user.password_hash = hash_password(data.password)
    user.password_changed_at = datetime.now(UTC)
    # Linkul a ajuns în căsuța de email, deci adresa e confirmată.
    user.is_verified = True
    db.commit()
    return {"detail": "Parola a fost schimbată."}
