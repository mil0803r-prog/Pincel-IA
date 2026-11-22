"""Base de datos SQLite de Pincel IA y operaciones sobre campañas e imágenes."""

from __future__ import annotations

import secrets
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from typing import Iterator

from . import config, archivos

ESQUEMA = """
CREATE TABLE IF NOT EXISTS campanas (
    id          TEXT PRIMARY KEY,
    nombre      TEXT NOT NULL,
    notas       TEXT NOT NULL DEFAULT '',
    origen      TEXT NOT NULL DEFAULT 'app',
    creado      TEXT NOT NULL,
    actualizado TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS prompts (
    campana_id TEXT NOT NULL REFERENCES campanas(id) ON DELETE CASCADE,
    n          INTEGER NOT NULL,
    texto      TEXT NOT NULL,
    imagen_id  TEXT REFERENCES imagenes(id) ON DELETE SET NULL,
    PRIMARY KEY (campana_id, n)
);
CREATE TABLE IF NOT EXISTS imagenes (
    id         TEXT PRIMARY KEY,
    campana_id TEXT NOT NULL REFERENCES campanas(id) ON DELETE CASCADE,
    n          INTEGER NOT NULL,
    archivo    TEXT NOT NULL,
    miniatura  TEXT NOT NULL,
    ancho      INTEGER NOT NULL,
    alto       INTEGER NOT NULL,
    bytes      INTEGER NOT NULL,
    origen     TEXT NOT NULL,
    creado     TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS referencias (
    id         TEXT PRIMARY KEY,
    campana_id TEXT NOT NULL REFERENCES campanas(id) ON DELETE CASCADE,
    archivo    TEXT NOT NULL,
    miniatura  TEXT NOT NULL,
    ancho      INTEGER NOT NULL,
    alto       INTEGER NOT NULL,
    creado     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_referencias_campana ON referencias(campana_id);
CREATE INDEX IF NOT EXISTS idx_imagenes_campana ON imagenes(campana_id);
CREATE INDEX IF NOT EXISTS idx_imagenes_creado ON imagenes(creado);
"""


def ahora() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def nuevo_id(largo: int = 10) -> str:
    return secrets.token_urlsafe(largo).replace("-", "x").replace("_", "y")[:largo + 2]


def _conectar() -> sqlite3.Connection:
    config.DATOS.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(config.DATOS / "pincel.db", timeout=30)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys = ON")
    con.execute("PRAGMA journal_mode = WAL")
    return con


@contextmanager
def conexion() -> Iterator[sqlite3.Connection]:
    con = _conectar()
    try:
        yield con
        con.commit()
    except Exception:
        con.rollback()
        raise
    finally:
        con.close()


def iniciar() -> None:
    with conexion() as con:
        con.executescript(ESQUEMA)


class NoEncontrado(Exception):
    pass


class Invalido(ValueError):
    pass


# ---------------------------------------------------------------- serialización

def _imagen_dict(r: sqlite3.Row | None) -> dict | None:
    if r is None:
        return None
    return {
        "id": r["id"],
        "campana_id": r["campana_id"],
        "n": r["n"],
        "url": f"{config.URL_PUBLICA}/i/{r['archivo']}",
        "miniatura": f"{config.URL_PUBLICA}/i/t/{r['miniatura']}",
        "ruta": f"/i/{r['archivo']}",
        "ruta_miniatura": f"/i/t/{r['miniatura']}",
        "ancho": r["ancho"],
        "alto": r["alto"],
        "bytes": r["bytes"],
        "origen": r["origen"],
        "creado": r["creado"],
    }


def _referencia_dict(r: sqlite3.Row) -> dict:
    return {
        "id": r["id"],
        "url": f"{config.URL_PUBLICA}/i/{r['archivo']}",
        "ruta": f"/i/{r['archivo']}",
        "ruta_miniatura": f"/i/t/{r['miniatura']}",
        "archivo": r["archivo"],
        "miniatura": r["miniatura"],
        "ancho": r["ancho"],
        "alto": r["alto"],
    }


def _campana_resumen(con: sqlite3.Connection, r: sqlite3.Row) -> dict:
    total, hechas = con.execute(
        "SELECT COUNT(*), COUNT(imagen_id) FROM prompts WHERE campana_id = ?", (r["id"],)
    ).fetchone()
    portadas = con.execute(
        "SELECT i.* FROM prompts p JOIN imagenes i ON i.id = p.imagen_id "
        "WHERE p.campana_id = ? ORDER BY p.n LIMIT 4", (r["id"],)
    ).fetchall()
    portada = portadas[0] if portadas else None
    return {
        "id": r["id"],
        "nombre": r["nombre"],
        "notas": r["notas"],
        "origen": r["origen"],
        "creado": r["creado"],
        "actualizado": r["actualizado"],
        "total": total,
        "hechas": hechas,
        "portada": _imagen_dict(portada),
        "miniaturas": [f"/i/t/{p['miniatura']}" for p in portadas],
    }


# ---------------------------------------------------------------- campañas

def crear_campana(nombre: str, prompts: list[str], notas: str = "", origen: str = "app") -> dict:
    prompts = [p.strip() for p in prompts if p and p.strip()]
    nombre = (nombre or "").strip()[:120]
    if not nombre:
        raise Invalido("La campaña necesita un nombre.")
    if not prompts:
        raise Invalido("La campaña necesita al menos un prompt.")
    cid, t = nuevo_id(), ahora()
    with conexion() as con:
        con.execute(
            "INSERT INTO campanas (id, nombre, notas, origen, creado, actualizado) VALUES (?,?,?,?,?,?)",
            (cid, nombre, (notas or "").strip(), origen, t, t),
        )
        con.executemany(
            "INSERT INTO prompts (campana_id, n, texto) VALUES (?,?,?)",
            [(cid, i, p) for i, p in enumerate(prompts, 1)],
        )
    return obtener_campana(cid)


def listar_campanas(buscar: str = "", limite: int = 100000) -> list[dict]:
    with conexion() as con:
        if buscar:
            filas = con.execute(
                "SELECT * FROM campanas WHERE nombre LIKE ? ORDER BY creado DESC LIMIT ?",
                (f"%{buscar}%", limite),
            ).fetchall()
        else:
            filas = con.execute("SELECT * FROM campanas ORDER BY creado DESC LIMIT ?", (limite,)).fetchall()
        return [_campana_resumen(con, r) for r in filas]


def obtener_campana(cid: str) -> dict:
    with conexion() as con:
        r = con.execute("SELECT * FROM campanas WHERE id = ?", (cid,)).fetchone()
        if r is None:
            raise NoEncontrado(f"No existe la campaña '{cid}'.")
        c = _campana_resumen(con, r)
        filas = con.execute(
            "SELECT p.n, p.texto, i.* FROM prompts p LEFT JOIN imagenes i ON i.id = p.imagen_id "
            "WHERE p.campana_id = ? ORDER BY p.n", (cid,)
        ).fetchall()
        c["prompts"] = [
            {"n": f["n"], "texto": f["texto"], "imagen": _imagen_dict(f) if f["id"] else None} for f in filas
        ]
        c["referencias"] = [_referencia_dict(r) for r in con.execute(
            "SELECT * FROM referencias WHERE campana_id = ? ORDER BY creado", (cid,)
        ).fetchall()]
        return c


def buscar_campana(ref: str | None) -> dict:
    """Por id exacto, por nombre (parcial, sin mayúsculas) o la más reciente si ref está vacío."""
    with conexion() as con:
        if not ref or not ref.strip():
            r = con.execute("SELECT id FROM campanas ORDER BY creado DESC LIMIT 1").fetchone()
            if r is None:
                raise NoEncontrado("Todavía no hay campañas. Créala primero desde Claude o desde la app.")
        else:
            ref = ref.strip()
            r = con.execute("SELECT id FROM campanas WHERE id = ?", (ref,)).fetchone() or con.execute(
                "SELECT id FROM campanas WHERE lower(nombre) = lower(?) ORDER BY creado DESC LIMIT 1", (ref,)
            ).fetchone() or con.execute(
                "SELECT id FROM campanas WHERE lower(nombre) LIKE lower(?) ORDER BY creado DESC LIMIT 1",
                (f"%{ref}%",),
            ).fetchone()
            if r is None:
                raise NoEncontrado(f"No encontré la campaña '{ref}'.")
    return obtener_campana(r["id"])


def actualizar_campana(cid: str, nombre: str | None = None, notas: str | None = None) -> dict:
    obtener_campana(cid)
    with conexion() as con:
        if nombre is not None:
            if not nombre.strip():
                raise Invalido("El nombre no puede quedar vacío.")
            con.execute("UPDATE campanas SET nombre = ? WHERE id = ?", (nombre.strip()[:120], cid))
        if notas is not None:
            con.execute("UPDATE campanas SET notas = ? WHERE id = ?", (notas.strip(), cid))
        con.execute("UPDATE campanas SET actualizado = ? WHERE id = ?", (ahora(), cid))
    return obtener_campana(cid)


def actualizar_prompt(cid: str, n: int, texto: str) -> dict:
    if not texto.strip():
        raise Invalido("El prompt no puede quedar vacío.")
    with conexion() as con:
        cur = con.execute("UPDATE prompts SET texto = ? WHERE campana_id = ? AND n = ?", (texto.strip(), cid, n))
        if cur.rowcount == 0:
            raise NoEncontrado(f"No existe el prompt {n}.")
        con.execute("UPDATE campanas SET actualizado = ? WHERE id = ?", (ahora(), cid))
    return obtener_campana(cid)


def agregar_prompts(cid: str, prompts: list[str]) -> dict:
    prompts = [p.strip() for p in prompts if p and p.strip()]
    if not prompts:
        raise Invalido("No llegó ningún prompt.")
    obtener_campana(cid)
    with conexion() as con:
        ultimo = con.execute("SELECT COALESCE(MAX(n), 0) FROM prompts WHERE campana_id = ?", (cid,)).fetchone()[0]
        con.executemany(
            "INSERT INTO prompts (campana_id, n, texto) VALUES (?,?,?)",
            [(cid, ultimo + i, p) for i, p in enumerate(prompts, 1)],
        )
        con.execute("UPDATE campanas SET actualizado = ? WHERE id = ?", (ahora(), cid))
    return obtener_campana(cid)


def eliminar_campana(cid: str) -> None:
    with conexion() as con:
        imgs = con.execute(
            "SELECT archivo, miniatura FROM imagenes WHERE campana_id = ? "
            "UNION ALL SELECT archivo, miniatura FROM referencias WHERE campana_id = ?", (cid, cid)
        ).fetchall()
        cur = con.execute("DELETE FROM campanas WHERE id = ?", (cid,))
        if cur.rowcount == 0:
            raise NoEncontrado(f"No existe la campaña '{cid}'.")
    for i in imgs:
        archivos.borrar(i["archivo"], i["miniatura"])


# ---------------------------------------------------------------- imágenes

def guardar_imagen(cid: str, n: int | None, datos: bytes, origen: str) -> dict:
    """Guarda la imagen en el puesto `n` (o en el primer puesto vacío) y devuelve la imagen."""
    info = archivos.procesar(datos)  # valida antes de tocar la base
    try:
        with conexion() as con:
            if con.execute("SELECT 1 FROM campanas WHERE id = ?", (cid,)).fetchone() is None:
                raise NoEncontrado(f"No existe la campaña '{cid}'.")
            if n is None:
                fila = con.execute(
                    "SELECT n FROM prompts WHERE campana_id = ? AND imagen_id IS NULL ORDER BY n LIMIT 1", (cid,)
                ).fetchone()
                if fila is None:
                    raise Invalido("Todas las imágenes ya están cargadas; indica qué número reemplazar.")
                n = fila["n"]
            puesto = con.execute(
                "SELECT p.imagen_id, i.archivo, i.miniatura FROM prompts p LEFT JOIN imagenes i ON i.id = p.imagen_id "
                "WHERE p.campana_id = ? AND p.n = ?", (cid, n)
            ).fetchone()
            if puesto is None:
                total = con.execute("SELECT COUNT(*) FROM prompts WHERE campana_id = ?", (cid,)).fetchone()[0]
                raise Invalido(f"La campaña tiene {total} prompts; el número {n} no existe.")
            iid = info["id"]
            con.execute(
                "INSERT INTO imagenes (id, campana_id, n, archivo, miniatura, ancho, alto, bytes, origen, creado) "
                "VALUES (?,?,?,?,?,?,?,?,?,?)",
                (iid, cid, n, info["archivo"], info["miniatura"], info["ancho"], info["alto"], info["bytes"], origen, ahora()),
            )
            con.execute("UPDATE prompts SET imagen_id = ? WHERE campana_id = ? AND n = ?", (iid, cid, n))
            if puesto["imagen_id"]:
                con.execute("DELETE FROM imagenes WHERE id = ?", (puesto["imagen_id"],))
            con.execute("UPDATE campanas SET actualizado = ? WHERE id = ?", (ahora(), cid))
            nueva = con.execute("SELECT * FROM imagenes WHERE id = ?", (iid,)).fetchone()
    except Exception:
        archivos.borrar(info["archivo"], info["miniatura"])
        raise
    if puesto["imagen_id"]:
        archivos.borrar(puesto["archivo"], puesto["miniatura"])
    return _imagen_dict(nueva)


def quitar_imagen(cid: str, n: int) -> dict:
    with conexion() as con:
        fila = con.execute(
            "SELECT i.id, i.archivo, i.miniatura FROM prompts p JOIN imagenes i ON i.id = p.imagen_id "
            "WHERE p.campana_id = ? AND p.n = ?", (cid, n)
        ).fetchone()
        if fila is None:
            raise NoEncontrado("Ese puesto no tiene imagen.")
        con.execute("UPDATE prompts SET imagen_id = NULL WHERE campana_id = ? AND n = ?", (cid, n))
        con.execute("DELETE FROM imagenes WHERE id = ?", (fila["id"],))
    archivos.borrar(fila["archivo"], fila["miniatura"])
    return obtener_campana(cid)


def agregar_referencia(cid: str, datos: bytes) -> dict:
    """Guarda una imagen de referencia del producto (mockup, foto real, logo) para la campaña."""
    info = archivos.procesar(datos)
    try:
        with conexion() as con:
            if con.execute("SELECT 1 FROM campanas WHERE id = ?", (cid,)).fetchone() is None:
                raise NoEncontrado(f"No existe la campaña '{cid}'.")
            if con.execute("SELECT COUNT(*) FROM referencias WHERE campana_id = ?", (cid,)).fetchone()[0] >= 6:
                raise Invalido("Máximo 6 imágenes de referencia por campaña.")
            con.execute(
                "INSERT INTO referencias (id, campana_id, archivo, miniatura, ancho, alto, creado) VALUES (?,?,?,?,?,?,?)",
                (info["id"], cid, info["archivo"], info["miniatura"], info["ancho"], info["alto"], ahora()),
            )
            con.execute("UPDATE campanas SET actualizado = ? WHERE id = ?", (ahora(), cid))
            r = con.execute("SELECT * FROM referencias WHERE id = ?", (info["id"],)).fetchone()
    except Exception:
        archivos.borrar(info["archivo"], info["miniatura"])
        raise
    return _referencia_dict(r)


def quitar_referencia(cid: str, rid: str) -> dict:
    with conexion() as con:
        r = con.execute("SELECT * FROM referencias WHERE id = ? AND campana_id = ?", (rid, cid)).fetchone()
        if r is None:
            raise NoEncontrado("Esa referencia no existe.")
        con.execute("DELETE FROM referencias WHERE id = ?", (rid,))
    archivos.borrar(r["archivo"], r["miniatura"])
    return obtener_campana(cid)


def listar_imagenes(cid: str | None = None, limite: int = 60, desde: int = 0) -> list[dict]:
    with conexion() as con:
        sql = ("SELECT i.*, c.nombre AS campana_nombre, p.texto AS prompt FROM imagenes i "
               "JOIN campanas c ON c.id = i.campana_id "
               "JOIN prompts p ON p.campana_id = i.campana_id AND p.n = i.n ")
        args: tuple = ()
        if cid:
            sql += "WHERE i.campana_id = ? "
            args = (cid,)
        filas = con.execute(sql + "ORDER BY i.creado DESC, i.id LIMIT ? OFFSET ?", (*args, limite, max(0, desde))).fetchall()
        return [{**_imagen_dict(f), "campana_nombre": f["campana_nombre"], "prompt": f["prompt"]} for f in filas]


def prompts_pendientes(cid: str, cantidad: int) -> tuple[list[dict], int]:
    """Los siguientes `cantidad` prompts sin imagen (en orden) y cuántos faltan en total."""
    with conexion() as con:
        faltan = con.execute(
            "SELECT COUNT(*) FROM prompts WHERE campana_id = ? AND imagen_id IS NULL", (cid,)
        ).fetchone()[0]
        filas = con.execute(
            "SELECT n, texto FROM prompts WHERE campana_id = ? AND imagen_id IS NULL ORDER BY n LIMIT ?",
            (cid, max(1, cantidad)),
        ).fetchall()
    return [{"n": f["n"], "texto": f["texto"]} for f in filas], faltan


def contar_imagenes(cid: str | None = None) -> int:
    with conexion() as con:
        if cid:
            return con.execute("SELECT COUNT(*) FROM imagenes WHERE campana_id = ?", (cid,)).fetchone()[0]
        return con.execute("SELECT COUNT(*) FROM imagenes").fetchone()[0]


def resumen_general() -> dict:
    with conexion() as con:
        campanas = con.execute("SELECT COUNT(*) FROM campanas").fetchone()[0]
        total, hechas = con.execute("SELECT COUNT(*), COUNT(imagen_id) FROM prompts").fetchone()
        peso = con.execute("SELECT COALESCE(SUM(bytes), 0) FROM imagenes").fetchone()[0]
        semana = con.execute(
            "SELECT COUNT(*) FROM imagenes WHERE creado >= datetime('now', '-7 days')"
        ).fetchone()[0]
        por_dia = dict(con.execute(
            "SELECT substr(creado, 1, 10), COUNT(*) FROM imagenes "
            "WHERE creado >= date('now', '-13 days') GROUP BY 1"
        ).fetchall())
    hoy = datetime.now(timezone.utc).date()
    actividad = []
    for i in range(13, -1, -1):
        d = (hoy - timedelta(days=i)).isoformat()
        actividad.append({"dia": d, "imagenes": por_dia.get(d, 0)})
    return {
        "actividad": actividad,
        "ultimas": listar_imagenes(limite=10),
        "campanas": campanas,
        "imagenes": hechas,
        "pendientes": total - hechas,
        "imagenes_semana": semana,
        "bytes": peso,
        "recientes": listar_campanas(limite=6),
    }
