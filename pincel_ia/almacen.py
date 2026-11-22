"""Almacén de campañas en disco: prompts + imágenes subidas.

datos/
  campanas/<id>/campana.json
  campanas/<id>/03.png ...
"""

from __future__ import annotations

import io
import json
import os
import secrets
import zipfile
from datetime import datetime
from pathlib import Path

FIRMAS = {
    b"\x89PNG\r\n\x1a\n": "png",
    b"\xff\xd8\xff": "jpg",
    b"GIF87a": "gif",
    b"GIF89a": "gif",
}
MAX_BYTES = 25 * 1024 * 1024


def carpeta_datos() -> Path:
    return Path(os.environ.get("PINCEL_DATOS", "./datos")).expanduser().resolve()


def _dir(cid: str) -> Path:
    if not cid or not all(c.isalnum() or c in "-_" for c in cid):
        raise ValueError("Identificador de campaña inválido.")
    return carpeta_datos() / "campanas" / cid


def _guardar(c: dict) -> None:
    d = _dir(c["id"])
    d.mkdir(parents=True, exist_ok=True)
    tmp = d / "campana.json.tmp"
    tmp.write_text(json.dumps(c, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(d / "campana.json")


def tipo_imagen(datos: bytes) -> str:
    for firma, ext in FIRMAS.items():
        if datos.startswith(firma):
            return ext
    if datos[:4] == b"RIFF" and datos[8:12] == b"WEBP":
        return "webp"
    raise ValueError("El archivo no es una imagen PNG, JPG, WEBP o GIF.")


def crear(nombre: str, prompts: list[str], notas: str = "") -> dict:
    prompts = [p.strip() for p in prompts if p and p.strip()]
    if not prompts:
        raise ValueError("No llegó ningún prompt.")
    c = {
        "id": secrets.token_urlsafe(9).replace("-", "x").replace("_", "y"),
        "nombre": (nombre or "campaña").strip()[:80],
        "notas": notas.strip(),
        "creado": datetime.now().isoformat(timespec="seconds"),
        "prompts": [{"n": i, "prompt": p, "imagen": None} for i, p in enumerate(prompts, 1)],
    }
    _guardar(c)
    return c


def obtener(cid: str) -> dict:
    f = _dir(cid) / "campana.json"
    if not f.is_file():
        raise KeyError(f"No existe la campaña '{cid}'.")
    return json.loads(f.read_text(encoding="utf-8"))


def listar(limite: int = 20) -> list[dict]:
    base = carpeta_datos() / "campanas"
    if not base.is_dir():
        return []
    cs = [json.loads(f.read_text(encoding="utf-8")) for f in base.glob("*/campana.json")]
    cs.sort(key=lambda c: c["creado"], reverse=True)
    return cs[:limite]


def buscar(ref: str | None) -> dict:
    """Busca por id exacto o por nombre (sin distinguir mayúsculas). Sin ref: la más reciente."""
    cs = listar(1000)
    if not cs:
        raise KeyError("Todavía no hay campañas. Créala primero desde Claude.")
    if not ref:
        return cs[0]
    ref_l = ref.strip().lower()
    for c in cs:
        if c["id"] == ref.strip():
            return c
    for c in cs:  # la más reciente con ese nombre
        if c["nombre"].lower() == ref_l or ref_l in c["nombre"].lower():
            return c
    raise KeyError(f"No encontré la campaña '{ref}'.")


def guardar_imagen(cid: str, n: int | None, datos: bytes) -> dict:
    """Guarda la imagen en el puesto `n`. Si n es None, usa el primer puesto vacío."""
    if len(datos) > MAX_BYTES:
        raise ValueError("La imagen pesa más de 25 MB.")
    ext = tipo_imagen(datos)
    c = obtener(cid)
    if n is None:
        libres = [p["n"] for p in c["prompts"] if not p["imagen"]]
        if not libres:
            raise ValueError("Todas las imágenes de la campaña ya están cargadas; indica el número a reemplazar.")
        n = libres[0]
    puesto = next((p for p in c["prompts"] if p["n"] == n), None)
    if puesto is None:
        raise ValueError(f"La campaña tiene {len(c['prompts'])} prompts; el número {n} no existe.")
    d = _dir(cid)
    if puesto["imagen"]:
        (d / puesto["imagen"]).unlink(missing_ok=True)
    nombre = f"{n:02d}-{secrets.token_hex(3)}.{ext}"
    (d / nombre).write_bytes(datos)
    puesto["imagen"] = nombre
    _guardar(c)
    return c


def ruta_imagen(cid: str, archivo: str) -> Path:
    if "/" in archivo or "\\" in archivo or archivo.startswith("."):
        raise KeyError(archivo)
    p = _dir(cid) / archivo
    if not p.is_file() or p.name == "campana.json":
        raise KeyError(archivo)
    return p


def zip_campana(cid: str) -> bytes:
    c = obtener(cid)
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_STORED) as z:
        for p in c["prompts"]:
            if p["imagen"]:
                z.write(_dir(cid) / p["imagen"], p["imagen"])
        z.writestr("prompts.txt", "\n\n".join(f"#{p['n']}\n{p['prompt']}" for p in c["prompts"]))
    return buf.getvalue()
