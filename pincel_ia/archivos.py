"""Validación y guardado de archivos de imagen (original + miniatura).

Dónde se guardan los archivos:
  - SQLite (local, Render, Docker): en la carpeta de datos, en disco.
  - Postgres (Vercel): dentro de la base de datos, porque Vercel no tiene disco persistente.
"""

from __future__ import annotations

import io
import secrets
from pathlib import Path

from PIL import Image, ImageOps, UnidentifiedImageError

from . import config

FORMATOS = {"PNG": "png", "JPEG": "jpg", "WEBP": "webp", "GIF": "gif"}
MIME = {"png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg", "webp": "image/webp", "gif": "image/gif"}
LADO_MINIATURA = 640


# ---------------------------------------------------------------- almacenamiento

def dir_imagenes() -> Path:
    d = config.DATOS / "imagenes"
    d.mkdir(parents=True, exist_ok=True)
    return d


def dir_miniaturas() -> Path:
    d = config.DATOS / "miniaturas"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _seguro(nombre: str) -> bool:
    return bool(nombre) and "/" not in nombre and "\\" not in nombre and not nombre.startswith(".")


def _mime(nombre: str) -> str:
    return MIME.get(nombre.rsplit(".", 1)[-1].lower(), "application/octet-stream")


def _guardar(nombre: str, datos: bytes, miniatura: bool) -> None:
    if config.USA_POSTGRES:
        from .db import conexion

        clave = ("t/" if miniatura else "i/") + nombre
        with conexion() as con:
            con.execute(
                "INSERT INTO archivos_bin (clave, tipo, datos) VALUES (?, ?, ?) "
                "ON CONFLICT (clave) DO UPDATE SET datos = EXCLUDED.datos, tipo = EXCLUDED.tipo",
                (clave, _mime(nombre), datos),
            )
        return
    ((dir_miniaturas() if miniatura else dir_imagenes()) / nombre).write_bytes(datos)


def _leer(nombre: str, miniatura: bool) -> tuple[bytes, str] | None:
    if not _seguro(nombre):
        return None
    if config.USA_POSTGRES:
        from .db import conexion

        with conexion() as con:
            fila = con.execute(
                "SELECT datos, tipo FROM archivos_bin WHERE clave = ?", (("t/" if miniatura else "i/") + nombre,)
            ).fetchone()
        return (bytes(fila[0]), fila[1]) if fila else None
    p = (dir_miniaturas() if miniatura else dir_imagenes()) / nombre
    return (p.read_bytes(), _mime(nombre)) if p.is_file() else None


def leer_original(nombre: str) -> tuple[bytes, str] | None:
    return _leer(nombre, False)


def leer_miniatura(nombre: str) -> tuple[bytes, str] | None:
    return _leer(nombre, True)


def borrar(archivo: str | None, miniatura: str | None) -> None:
    if config.USA_POSTGRES:
        from .db import conexion

        claves = [c for c in ((f"i/{archivo}" if archivo else None), (f"t/{miniatura}" if miniatura else None)) if c]
        if claves:
            with conexion() as con:
                for c in claves:
                    con.execute("DELETE FROM archivos_bin WHERE clave = ?", (c,))
        return
    if archivo and _seguro(archivo):
        (dir_imagenes() / archivo).unlink(missing_ok=True)
    if miniatura and _seguro(miniatura):
        (dir_miniaturas() / miniatura).unlink(missing_ok=True)


# ---------------------------------------------------------------- proceso de una imagen nueva

def _aligerar(im: Image.Image, tope: int) -> tuple[bytes, str]:
    """Reduce una imagen hasta que pese menos de `tope` bytes (WebP; JPEG si no es posible)."""
    base = ImageOps.exif_transpose(im)
    con_alfa = base.mode in ("RGBA", "LA", "P")
    trabajo = base.convert("RGBA" if con_alfa else "RGB")
    escala = 1.0
    for _ in range(8):
        w, h = max(1, int(trabajo.width * escala)), max(1, int(trabajo.height * escala))
        candidato = trabajo if escala == 1.0 else trabajo.resize((w, h), Image.LANCZOS)
        for calidad in (92, 85, 75):
            buf = io.BytesIO()
            candidato.save(buf, "WEBP", quality=calidad, method=4)
            if buf.tell() <= tope:
                return buf.getvalue(), "webp"
        escala *= 0.8
    raise ValueError("No se pudo reducir la imagen al tamaño permitido.")


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

    ext = FORMATOS[fmt]
    # En Vercel una respuesta de función no puede pasar de ~4,5 MB: las imágenes más pesadas se aligeran al guardar.
    if config.LIMITE_SUBIDA and len(datos) > config.LIMITE_SUBIDA:
        try:
            datos, ext = _aligerar(im, config.LIMITE_SUBIDA)
        except ValueError as e:
            raise Invalido(str(e))
        im = Image.open(io.BytesIO(datos))

    iid = secrets.token_urlsafe(12).replace("-", "x").replace("_", "y")
    archivo = f"{iid}.{ext}"
    miniatura = f"{iid}.webp"
    _guardar(archivo, datos, False)

    im = ImageOps.exif_transpose(im)
    ancho, alto = im.size
    mini = im.convert("RGBA") if im.mode in ("P", "LA", "RGBA") else im.convert("RGB")
    mini.thumbnail((LADO_MINIATURA, LADO_MINIATURA))
    buf = io.BytesIO()
    mini.save(buf, "WEBP", quality=82, method=4)
    _guardar(miniatura, buf.getvalue(), True)

    return {"id": iid, "archivo": archivo, "miniatura": miniatura, "ancho": ancho, "alto": alto, "bytes": len(datos)}


def version_para_ia(nombre: str, lado: int = 1024) -> bytes | None:
    """Copia reducida (JPEG/PNG) de una imagen guardada, para enviarla dentro de una respuesta del conector."""
    leido = leer_original(nombre)
    if not leido:
        return None
    with Image.open(io.BytesIO(leido[0])) as im:
        im = ImageOps.exif_transpose(im)
        im.thumbnail((lado, lado))
        buf = io.BytesIO()
        if im.mode in ("RGBA", "LA", "P"):
            im.convert("RGBA").save(buf, "PNG", optimize=True)
        else:
            im.convert("RGB").save(buf, "JPEG", quality=88)
        return buf.getvalue()
