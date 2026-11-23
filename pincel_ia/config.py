"""Configuración por variables de entorno."""

from __future__ import annotations

import os
import secrets
import sys
from pathlib import Path


def _aviso(msg: str) -> None:
    print(f"[pincel-ia] AVISO: {msg}", file=sys.stderr)


# Vercel (u otro hosting sin disco persistente): las funciones son temporales y limitan el tamaño de las peticiones.
VERCEL = bool(os.environ.get("VERCEL"))

TOKEN = os.environ.get("PINCEL_TOKEN", "")
CLAVE = os.environ.get("PINCEL_CLAVE", "")

# Base de datos: Postgres si hay una URL (Vercel + Neon); si no, SQLite en disco (local, Render, Docker).
_PREFIJOS_PG = ("postgres://", "postgresql://")


def _buscar_bd() -> str:
    for nombre in ("PINCEL_DATABASE_URL", "DATABASE_URL", "POSTGRES_URL"):
        valor = os.environ.get(nombre, "").strip()
        if valor.startswith(_PREFIJOS_PG):
            return valor
    # Vercel puede agregar un prefijo al nombre (p. ej. STORAGE_URL): se acepta cualquier variable con una URL de Postgres,
    # prefiriendo la conexión con pooler y dejando para el final las "sin pooler".
    candidatas = [(n, v.strip()) for n, v in os.environ.items() if v.strip().startswith(_PREFIJOS_PG)]
    candidatas.sort(key=lambda nv: (("UNPOOLED" in nv[0] or "NON_POOLING" in nv[0]), nv[0]))
    return candidatas[0][1] if candidatas else ""


DATABASE_URL = _buscar_bd()
USA_POSTGRES = DATABASE_URL.startswith(_PREFIJOS_PG)

# Variables que sí o sí deben estar definidas cuando corre en Vercel.
FALTAN: list[str] = []
if VERCEL:
    if not TOKEN:
        FALTAN.append("PINCEL_TOKEN")
    if not CLAVE:
        FALTAN.append("PINCEL_CLAVE")
    if not USA_POSTGRES:
        FALTAN.append("DATABASE_URL (conecta una base de datos Neon en Storage)")
else:
    if not TOKEN:
        TOKEN = secrets.token_urlsafe(16)
        _aviso(f"PINCEL_TOKEN no definido; uso uno temporal (cambia en cada reinicio): {TOKEN}")
    if not CLAVE:
        CLAVE = "pincel"
        _aviso("PINCEL_CLAVE no definida; la contraseña de acceso es 'pincel'. Cámbiala en producción.")
TOKEN = TOKEN or "sin-configurar"
CLAVE = CLAVE or "sin-configurar"


def _url_publica() -> str:
    explicita = os.environ.get("PINCEL_URL_PUBLICA", "").strip()
    if explicita:
        return explicita.rstrip("/")
    # Vercel expone la dirección del proyecto en variables de sistema.
    for var in ("VERCEL_PROJECT_PRODUCTION_URL", "VERCEL_URL"):
        host = os.environ.get(var, "").strip()
        if host:
            return f"https://{host}"
    return "http://localhost:8000"


URL_PUBLICA = _url_publica()
DATOS = Path(os.environ.get("PINCEL_DATOS", "./datos")).expanduser().resolve()
PORT = int(os.environ.get("PORT", "8000"))
ESTATICOS = Path(__file__).resolve().parent.parent / "dist"
MAX_BYTES = 25 * 1024 * 1024

# Tope de tamaño de una petición/respuesta de función. Vercel permite ~4,5 MB; dejamos margen.
LIMITE_SUBIDA = int(os.environ.get("PINCEL_LIMITE_SUBIDA", 4_000_000 if VERCEL else 0))

# Solo para pruebas locales: permite importar landings desde direcciones de la red interna (por defecto se bloquean).
PERMITIR_REDES_PRIVADAS = os.environ.get("PINCEL_PERMITIR_REDES_PRIVADAS") == "1"

URL_MCP = f"{URL_PUBLICA}/{TOKEN}/mcp"
