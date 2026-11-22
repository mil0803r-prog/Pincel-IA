"""Configuración por variables de entorno."""

from __future__ import annotations

import os
import secrets
import sys
from pathlib import Path


def _aviso(msg: str) -> None:
    print(f"[pincel-ia] AVISO: {msg}", file=sys.stderr)


TOKEN = os.environ.get("PINCEL_TOKEN", "")
if not TOKEN:
    TOKEN = secrets.token_urlsafe(16)
    _aviso(f"PINCEL_TOKEN no definido; uso uno temporal (cambia en cada reinicio): {TOKEN}")

CLAVE = os.environ.get("PINCEL_CLAVE", "")
if not CLAVE:
    CLAVE = "pincel"
    _aviso("PINCEL_CLAVE no definida; la contraseña de acceso es 'pincel'. Cámbiala en producción.")

URL_PUBLICA = os.environ.get("PINCEL_URL_PUBLICA", "http://localhost:8000").rstrip("/")
DATOS = Path(os.environ.get("PINCEL_DATOS", "./datos")).expanduser().resolve()
PORT = int(os.environ.get("PORT", "8000"))
ESTATICOS = Path(__file__).parent / "static"
MAX_BYTES = 25 * 1024 * 1024

URL_MCP = f"{URL_PUBLICA}/{TOKEN}/mcp"
