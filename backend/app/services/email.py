"""Emailuri trimise cu fastapi-mail: confirmarea contului și resetarea parolei.

Local, emailurile ajung în Mailpit (http://localhost:8025), nu la adrese reale.
Routerele le trimit prin BackgroundTasks: răspunsul pleacă imediat, iar emailul se
trimite după, ca un server SMTP lent să nu întârzie înregistrarea.
"""

import logging
from html import escape

from fastapi_mail import ConnectionConfig, FastMail, MessageSchema, MessageType

from app import config

log = logging.getLogger(__name__)

_mail_config = ConnectionConfig(
    MAIL_USERNAME=config.SMTP_USER,
    MAIL_PASSWORD=config.SMTP_PASSWORD,
    MAIL_SERVER=config.SMTP_HOST,
    MAIL_PORT=config.SMTP_PORT,
    MAIL_FROM=config.MAIL_FROM,
    MAIL_FROM_NAME="Pas cu Pas",
    # Mailpit nu are parolă și nici TLS; un SMTP real (la demo) folosește portul 587 cu STARTTLS.
    MAIL_STARTTLS=config.SMTP_PORT == 587,
    MAIL_SSL_TLS=config.SMTP_PORT == 465,
    USE_CREDENTIALS=bool(config.SMTP_USER),
    VALIDATE_CERTS=bool(config.SMTP_USER),
)


async def _send(to: str, subject: str, html: str) -> None:
    message = MessageSchema(recipients=[to], subject=subject, body=html, subtype=MessageType.html)
    try:
        await FastMail(_mail_config).send_message(message)
    except Exception:
        # Contul e deja creat; utilizatorul poate cere alt link din aplicație.
        log.exception("Emailul către %s nu a putut fi trimis", to)


def _layout(title: str, text: str, link: str, button: str, note: str) -> str:
    return f"""<!doctype html>
<html lang="ro"><body style="font-family: system-ui, sans-serif; font-size: 16px;
 color: #1E293B; max-width: 560px; margin: 0 auto; padding: 24px;">
  <h1 style="font-size: 24px;">{title}</h1>
  <p>{text}</p>
  <p><a href="{link}" style="display: inline-block; background: #FF7A59; color: #1E293B;
     padding: 14px 24px; border-radius: 12px; font-weight: 700; text-decoration: none;">
     {button}</a></p>
  <p style="color: #475569;">{note}</p>
  <p style="color: #475569;">Dacă butonul nu merge, copiază adresa: {link}</p>
  <p style="color: #475569;">© 2026 20SOFT</p>
</body></html>"""


async def send_verification_email(to: str, token: str) -> None:
    link = f"{config.FRONTEND_URL}/confirmare?token={token}"
    html = _layout(
        "Confirmă-ți contul",
        "Ți-ai făcut cont în Pas cu Pas. Apasă butonul ca să confirmi adresa de email.",
        link,
        "Confirmă contul",
        "Linkul e valabil 24 de ore și merge o singură dată. "
        "Dacă nu tu ți-ai făcut contul, ignoră acest email.",
    )
    await _send(to, "Confirmă-ți contul Pas cu Pas", html)


async def send_reset_email(to: str, token: str) -> None:
    link = f"{config.FRONTEND_URL}/parola-noua?token={token}"
    html = _layout(
        "Alege o parolă nouă",
        "Cineva a cerut schimbarea parolei pentru contul tău Pas cu Pas.",
        link,
        "Alege parola nouă",
        "Linkul e valabil 30 de minute și merge o singură dată. "
        "Dacă nu tu ai cerut asta, ignoră emailul: parola rămâne aceeași.",
    )
    await _send(to, "Resetarea parolei Pas cu Pas", html)


async def send_report_created(to: str, public_code: str) -> None:
    link = f"{config.FRONTEND_URL}/raport/{public_code}"
    html = _layout(
        f"Am primit raportul {public_code}",
        "Mulțumim! Raportul tău e în lucru. Te anunțăm pe email când i se schimbă statusul.",
        link,
        "Vezi raportul",
        "Păstrează codul raportului dacă vrei să întrebi de el.",
    )
    await _send(to, f"Raportul {public_code} a fost primit", html)


STATUS_TEXT = {
    "rezolvat": (
        "Problema a fost rezolvată",
        "Mulțumim! Problema raportată de tine a fost rezolvată.",
    ),
    "respins": ("Raportul a fost respins", "Am verificat raportul tău și nu l-am putut confirma."),
    "in_lucru": ("Raportul e din nou în lucru", "Am redeschis raportul tău și ne ocupăm de el."),
}


async def send_report_status(
    to: str, public_code: str, status: str, reason: str | None, message: str | None
) -> None:
    title, text = STATUS_TEXT[status]
    if reason:
        text += f" Motivul: {escape(reason)}."
    if message:
        text += f"<br><br>Mesaj de la instituție: „{escape(message)}”"
    html = _layout(
        title,
        text,
        f"{config.FRONTEND_URL}/raport/{public_code}",
        "Vezi raportul",
        f"Codul raportului: {public_code}.",
    )
    await _send(to, f"{title}: {public_code}", html)


async def send_invitation(to: str, institution: str, token: str) -> None:
    link = f"{config.FRONTEND_URL}/parola-noua?token={token}"
    html = _layout(
        "Te invităm în panoul Pas cu Pas",
        f"Ți-am făcut un cont de administrator pentru {escape(institution)}. "
        "Alege-ți parola ca să intri în panou.",
        link,
        "Alege parola",
        "Linkul e valabil 7 zile și merge o singură dată.",
    )
    await _send(to, "Invitație în panoul de administrare Pas cu Pas", html)
