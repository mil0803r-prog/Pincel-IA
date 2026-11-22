"""Inicio de sesión con contraseña y cookie firmada."""

from __future__ import annotations

import asyncio
import hashlib
import hmac
from functools import wraps
from typing import Awaitable, Callable

from itsdangerous import BadSignature, SignatureExpired, TimestampSigner
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from . import config

COOKIE = "pincel_sesion"
DURACION = 60 * 60 * 24 * 30  # 30 días

_firmador = TimestampSigner(
    hashlib.sha256(f"pincel::{config.TOKEN}::{config.CLAVE}".encode()).hexdigest(), salt="sesion"
)


def clave_correcta(clave: str) -> bool:
    return hmac.compare_digest(clave.encode(), config.CLAVE.encode())


def iniciar_sesion(resp: Response) -> None:
    valor = _firmador.sign(b"admin").decode()
    resp.set_cookie(
        COOKIE, valor, max_age=DURACION, httponly=True, samesite="lax",
        secure=config.URL_PUBLICA.startswith("https://"), path="/",
    )


def cerrar_sesion(resp: Response) -> None:
    resp.delete_cookie(COOKIE, path="/")


def autenticado(request: Request) -> bool:
    valor = request.cookies.get(COOKIE)
    if not valor:
        return False
    try:
        _firmador.unsign(valor, max_age=DURACION)
        return True
    except (BadSignature, SignatureExpired):
        return False


def requiere_sesion(fn: Callable[[Request], Awaitable[Response]]):
    @wraps(fn)
    async def envoltura(request: Request) -> Response:
        if not autenticado(request):
            return JSONResponse({"error": "Inicia sesión."}, status_code=401)
        return await fn(request)
    return envoltura


async def pausa_fallo() -> None:
    await asyncio.sleep(1.0)  # frena ataques de fuerza bruta
