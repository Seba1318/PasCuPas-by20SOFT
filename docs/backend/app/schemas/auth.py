"""Datele primite și trimise de routerul auth."""

from pydantic import BaseModel, EmailStr, field_validator, model_validator
from pydantic_core import PydanticCustomError


def check_password(password: str) -> str:
    """Aceleași reguli ca în frontend (src/auth/validation.js): minim 8 caractere și o cifră.

    bcrypt folosește doar primii 72 de bytes; o literă cu diacritice ocupă 2 bytes, deci
    limita e în bytes, nu în caractere.
    """
    if len(password) < 8:
        raise PydanticCustomError("password", "Parola are nevoie de cel puțin 8 caractere.")
    if not any(ch.isdigit() for ch in password):
        raise PydanticCustomError("password", "Parola are nevoie de cel puțin o cifră.")
    if len(password.encode()) > 72:
        raise PydanticCustomError("password", "Parola e prea lungă (maxim 72 de caractere).")
    return password


class EmailIn(BaseModel):
    email: EmailStr

    @field_validator("email")
    @classmethod
    def lowercase(cls, value: str) -> str:
        # Salvăm și căutăm emailul mereu cu litere mici:
        # Ana@exemplu.ro și ana@exemplu.ro sunt același cont.
        return value.strip().lower()


class RegisterIn(EmailIn):
    password: str
    password_confirm: str

    _check_password = field_validator("password")(check_password)

    @model_validator(mode="after")
    def passwords_match(self):
        if self.password != self.password_confirm:
            raise PydanticCustomError(
                "password_mismatch", "Parolele nu sunt la fel. Mai scrie-o o dată."
            )
        return self


class LoginIn(EmailIn):
    password: str


class ResetPasswordIn(BaseModel):
    token: str
    password: str

    _check_password = field_validator("password")(check_password)


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class MessageOut(BaseModel):
    detail: str
