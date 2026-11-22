"""Validación y guardado de archivos de imagen (original + miniatura)."""

from __future__ import annotations

import io
import secrets
from pathlib import Path

from PIL import Image, ImageOps, UnidentifiedImageError

from . import config

FORMATOS = {"PNG": "png", "JPEG": "jpg", "WEBP": "webp", "GIF": "gif"}
LADO_MINIATURA = 640


def dir_imagenes() -> Path:
    d = config.DATOS / "imagenes"
    d.mkdir(parents=True, exist_ok=True)
    return d


def dir_miniaturas() -> Path:
    d = config.DATOS / "miniaturas"
    d.mkdir(parents=True, exist_ok=True)
    return d


def procesar(datos: bytes) -> dict:
    """Valida que sea una imagen real, la guarda y crea su miniatura WEBP."""
    from .db import Invalido

    if not datos:
        raise Invalido("El archivo está vacío.")
    if len(datos) > config.MAX_BYTES:
        raise Invalido("La imagen pesa más de 25 MB.")
    try:
        with Image.open(io.BytesIO(datos)) as im:
            fmt = im.format
            im.verify()
        im = Image.open(io.BytesIO(datos))
    except (UnidentifiedImageError, OSError, SyntaxError):
        raise Invalido("El archivo no es una imagen válida (PNG, JPG, WEBP o GIF).")
    if fmt not in FORMATOS:
        raise Invalido("Formato no admitido. Usa PNG, JPG, WEBP o GIF.")

    iid = secrets.token_urlsafe(12).replace("-", "x").replace("_", "y")
    archivo = f"{iid}.{FORMATOS[fmt]}"
    miniatura = f"{iid}.webp"
    (dir_imagenes() / archivo).write_bytes(datos)

    im = ImageOps.exif_transpose(im)
    ancho, alto = im.size
    mini = im.convert("RGBA") if im.mode in ("P", "LA", "RGBA") else im.convert("RGB")
    mini.thumbnail((LADO_MINIATURA, LADO_MINIATURA))
    mini.save(dir_miniaturas() / miniatura, "WEBP", quality=82, method=4)

    return {"id": iid, "archivo": archivo, "miniatura": miniatura, "ancho": ancho, "alto": alto, "bytes": len(datos)}


def _seguro(nombre: str) -> bool:
    return bool(nombre) and "/" not in nombre and "\\" not in nombre and not nombre.startswith(".")


def ruta_original(nombre: str) -> Path | None:
    p = dir_imagenes() / nombre
    return p if _seguro(nombre) and p.is_file() else None


def ruta_miniatura(nombre: str) -> Path | None:
    p = dir_miniaturas() / nombre
    return p if _seguro(nombre) and p.is_file() else None


def borrar(archivo: str | None, miniatura: str | None) -> None:
    if archivo and _seguro(archivo):
        (dir_imagenes() / archivo).unlink(missing_ok=True)
    if miniatura and _seguro(miniatura):
        (dir_miniaturas() / miniatura).unlink(missing_ok=True)
