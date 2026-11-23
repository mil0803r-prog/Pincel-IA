"""Base de datos de Pincel IA (SQLite en disco o Postgres en Vercel) y operaciones sobre campañas e imágenes."""

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
CREATE TABLE IF NOT EXISTS prompts (
    campana_id TEXT NOT NULL REFERENCES campanas(id) ON DELETE CASCADE,
    n          INTEGER NOT NULL,
    texto      TEXT NOT NULL,
    imagen_id  TEXT REFERENCES imagenes(id) ON DELETE SET NULL,
    PRIMARY KEY (campana_id, n)
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
CREATE TABLE IF NOT EXISTS notificaciones (
    id             TEXT PRIMARY KEY,
    tipo           TEXT NOT NULL,
    origen         TEXT NOT NULL,
    campana_id     TEXT REFERENCES campanas(id) ON DELETE CASCADE,
    campana_nombre TEXT NOT NULL DEFAULT '',
    cantidad       INTEGER NOT NULL DEFAULT 1,
    detalle        TEXT NOT NULL DEFAULT '',
    leida          INTEGER NOT NULL DEFAULT 0,
    creado         TEXT NOT NULL,
    landing_id     TEXT
);
CREATE INDEX IF NOT EXISTS idx_notificaciones_creado ON notificaciones(creado);
CREATE TABLE IF NOT EXISTS conector_log (
    id         TEXT PRIMARY KEY,
    creado     TEXT NOT NULL,
    cliente    TEXT NOT NULL,
    metodo     TEXT NOT NULL DEFAULT '',
    mcp_metodo TEXT NOT NULL DEFAULT '',
    agente     TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_conector_log_creado ON conector_log(creado);
CREATE TABLE IF NOT EXISTS mercado (
    id                INTEGER PRIMARY KEY,
    pais              TEXT,
    moneda            TEXT,
    idioma            TEXT,
    tienda            TEXT,
    transportadoras   TEXT,
    medios_pago       TEXT,
    condiciones_envio TEXT,
    garantia          TEXT NOT NULL DEFAULT 'conservar',
    actualizado       TEXT
);
CREATE TABLE IF NOT EXISTS landings (
    id                 TEXT PRIMARY KEY,
    nombre             TEXT NOT NULL,
    url                TEXT NOT NULL DEFAULT '',
    tipo               TEXT,
    precios_decision   TEXT,
    precios_nuevos     TEXT NOT NULL DEFAULT '',
    precios_encontrados TEXT NOT NULL DEFAULT '',
    transportadoras_ok TEXT NOT NULL DEFAULT '',
    notas              TEXT NOT NULL DEFAULT '',
    creado             TEXT NOT NULL,
    actualizado        TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS landing_imagenes (
    id             TEXT PRIMARY KEY,
    landing_id     TEXT NOT NULL REFERENCES landings(id) ON DELETE CASCADE,
    n              INTEGER NOT NULL,
    origen_url     TEXT NOT NULL DEFAULT '',
    archivo        TEXT NOT NULL,
    miniatura      TEXT NOT NULL,
    ancho          INTEGER NOT NULL,
    alto           INTEGER NOT NULL,
    bytes          INTEGER NOT NULL,
    rol            TEXT NOT NULL DEFAULT 'banner',
    accion         TEXT,
    instruccion    TEXT NOT NULL DEFAULT '',
    hallazgos      TEXT NOT NULL DEFAULT '',
    final_archivo  TEXT,
    final_miniatura TEXT,
    final_ancho    INTEGER,
    final_alto     INTEGER,
    final_bytes    INTEGER,
    final_estado   TEXT,
    final_nota     TEXT NOT NULL DEFAULT '',
    creado         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_landing_imagenes ON landing_imagenes(landing_id, n);
CREATE TABLE IF NOT EXISTS contactos (
    cliente TEXT PRIMARY KEY,
    nombre  TEXT NOT NULL DEFAULT '',
    ultimo  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_referencias_campana ON referencias(campana_id);
CREATE INDEX IF NOT EXISTS idx_imagenes_campana ON imagenes(campana_id);
CREATE INDEX IF NOT EXISTS idx_imagenes_creado ON imagenes(creado);
"""

# Con Postgres (sin disco persistente) los archivos de imagen viven en la propia base de datos.
ESQUEMA_ARCHIVOS_PG = """
CREATE TABLE IF NOT EXISTS archivos_bin (
    clave TEXT PRIMARY KEY,
    tipo  TEXT NOT NULL,
    datos BYTEA NOT NULL
);
"""


def ahora() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def nuevo_id(largo: int = 10) -> str:
    return secrets.token_urlsafe(largo).replace("-", "x").replace("_", "y")[:largo + 2]


class Fila(tuple):
    """Fila de resultados: se lee por posición (fila[0]) o por nombre (fila["id"]), igual que sqlite3.Row."""

    _nombres: dict

    def __new__(cls, valores, nombres):
        f = super().__new__(cls, valores)
        indice: dict = {}
        for i, n in enumerate(nombres):
            indice.setdefault(n, i)  # con columnas repetidas (p.n, i.n) gana la primera, como en SQLite
        f._nombres = indice
        return f

    def __getitem__(self, k):
        if isinstance(k, str):
            return tuple.__getitem__(self, self._nombres[k])
        return tuple.__getitem__(self, k)

    def keys(self):
        return list(self._nombres)


class _ConexionPG:
    """Envoltorio de psycopg con la misma interfaz que usa el resto del módulo (placeholders '?')."""

    def __init__(self, con):
        self._con = con

    def _sql(self, sql: str) -> str:
        return sql.replace("?", "%s")

    def execute(self, sql: str, params=()):
        cur = self._con.cursor()
        cur.execute(self._sql(sql), params)
        return cur

    def executemany(self, sql: str, filas):
        cur = self._con.cursor()
        cur.executemany(self._sql(sql), filas)
        return cur

    def commit(self):
        self._con.commit()

    def rollback(self):
        self._con.rollback()

    def close(self):
        self._con.close()


def _fabrica_filas(cursor):
    nombres = [d.name for d in cursor.description] if cursor.description else []
    return lambda valores: Fila(valores, nombres)


def _conectar():
    if config.USA_POSTGRES:
        import psycopg

        # prepare_threshold=None: compatible con el pooler de Neon (PgBouncer en modo transacción)
        con = psycopg.connect(config.DATABASE_URL, row_factory=_fabrica_filas, prepare_threshold=None, connect_timeout=15)
        return _ConexionPG(con)
    config.DATOS.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(config.DATOS / "pincel.db", timeout=30)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys = ON")
    con.execute("PRAGMA journal_mode = WAL")
    return con


@contextmanager
def conexion() -> Iterator:
    con = _conectar()
    try:
        yield con
        con.commit()
    except Exception:
        con.rollback()
        raise
    finally:
        con.close()


def _migrar(con) -> None:
    """Cambios para bases creadas antes de una versión (se pueden repetir sin problema)."""
    if config.USA_POSTGRES:
        con.execute("ALTER TABLE notificaciones ADD COLUMN IF NOT EXISTS landing_id TEXT")
    else:
        columnas = [f[1] for f in con.execute("PRAGMA table_info(notificaciones)").fetchall()]
        if "landing_id" not in columnas:
            con.execute("ALTER TABLE notificaciones ADD COLUMN landing_id TEXT")
    con.execute("INSERT INTO mercado (id) VALUES (1) ON CONFLICT (id) DO NOTHING")


def iniciar() -> None:
    if config.USA_POSTGRES:
        with conexion() as con:
            # candado para que dos arranques simultáneos no choquen al crear las tablas
            con.execute("SELECT pg_advisory_xact_lock(7345001)")
            for sentencia in (ESQUEMA + ESQUEMA_ARCHIVOS_PG).split(";"):
                if sentencia.strip():
                    con.execute(sentencia)
            _migrar(con)
        return
    with conexion() as con:
        con.executescript(ESQUEMA)
        _migrar(con)


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
        if origen == "claude":
            _notificar(con, "campana_creada", "claude", cid, nombre, f"{nombre} · {len(prompts)} prompts", len(prompts))
    return obtener_campana(cid)


def listar_campanas(buscar: str = "", limite: int = 100000) -> list[dict]:
    with conexion() as con:
        if buscar:
            filas = con.execute(
                "SELECT * FROM campanas WHERE lower(nombre) LIKE lower(?) ORDER BY creado DESC LIMIT ?",
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


def agregar_prompts(cid: str, prompts: list[str], origen: str = "app") -> dict:
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
        if origen == "claude":
            nombre = con.execute("SELECT nombre FROM campanas WHERE id = ?", (cid,)).fetchone()[0]
            _notificar(con, "prompts", "claude", cid, nombre, f"{nombre} · hasta el #{ultimo + len(prompts)}", len(prompts))
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
            camp = con.execute("SELECT nombre FROM campanas WHERE id = ?", (cid,)).fetchone()
            if camp is None:
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
            if origen == "chatgpt":
                total, hechas = con.execute(
                    "SELECT COUNT(*), COUNT(imagen_id) FROM prompts WHERE campana_id = ?", (cid,)
                ).fetchone()
                _notificar(con, "imagenes", "chatgpt", cid, camp["nombre"], f"{camp['nombre']} · {hechas}/{total}", 1, agrupar=True)
                if hechas == total:
                    _notificar(con, "completa", "chatgpt", cid, camp["nombre"], f"{camp['nombre']} · {total} imágenes listas", total)
    except Exception:
        archivos.borrar(info["archivo"], info["miniatura"])
        raise
    if puesto["imagen_id"]:
        archivos.borrar(puesto["archivo"], puesto["miniatura"])
    return _imagen_dict(nueva)


# ---------------------------------------------------------------- notificaciones

def _notificar(con, tipo: str, origen: str, cid: str | None, nombre: str, detalle: str = "", cantidad: int = 1, agrupar: bool = False, landing_id: str | None = None) -> None:
    """Crea un aviso. Con `agrupar`, si ya hay uno igual sin leer de hace pocos minutos, lo actualiza (suma la cantidad)."""
    ahora_dt = datetime.now(timezone.utc)
    t = ahora_dt.isoformat(timespec="seconds")
    if agrupar and (cid or landing_id):
        corte = (ahora_dt - timedelta(minutes=15)).isoformat(timespec="seconds")
        columna, valor = ("landing_id", landing_id) if landing_id else ("campana_id", cid)
        previo = con.execute(
            f"SELECT id, cantidad FROM notificaciones WHERE tipo = ? AND {columna} = ? AND leida = 0 AND creado >= ? "
            "ORDER BY creado DESC LIMIT 1", (tipo, valor, corte),
        ).fetchone()
        if previo:
            con.execute(
                "UPDATE notificaciones SET cantidad = ?, detalle = ?, creado = ? WHERE id = ?",
                (previo["cantidad"] + cantidad, detalle, t, previo["id"]),
            )
            return
    con.execute(
        "INSERT INTO notificaciones (id, tipo, origen, campana_id, campana_nombre, cantidad, detalle, leida, creado, landing_id) "
        "VALUES (?,?,?,?,?,?,?,0,?,?)",
        (nuevo_id(), tipo, origen, cid, nombre, cantidad, detalle, t, landing_id),
    )
    # los avisos de más de 30 días se limpian solos
    con.execute("DELETE FROM notificaciones WHERE creado < ?", ((ahora_dt - timedelta(days=30)).isoformat(timespec="seconds"),))


def avisar(tipo: str, origen: str, cid: str | None, detalle: str = "", cantidad: int = 1, agrupar: bool = False, landing_id: str | None = None) -> None:
    """Aviso desde fuera de una transacción (p. ej. el conector). Nunca interrumpe la operación principal."""
    try:
        with conexion() as con:
            fila = con.execute("SELECT nombre FROM campanas WHERE id = ?", (cid,)).fetchone() if cid else None
            _notificar(con, tipo, origen, cid if fila else None, fila["nombre"] if fila else "", detalle, cantidad, agrupar, landing_id=landing_id)
    except Exception as e:  # un aviso fallido no debe romper el envío de imágenes
        import sys
        print(f"[pincel-ia] No se pudo crear el aviso: {e!r}", file=sys.stderr)


def _titulo_aviso(tipo: str, origen: str, cantidad: int) -> str:
    quien = {"chatgpt": "ChatGPT", "claude": "Claude", "otro": "Un cliente"}.get(origen, "Pincel IA")
    plural = "imagen" if cantidad == 1 else "imágenes"
    return {
        "imagenes": f"{quien} envió {cantidad} {plural}",
        "trabajando": f"{quien} está creando imágenes",
        "campana_creada": f"{quien} creó una campaña",
        "prompts": f"{quien} agregó {cantidad} {'prompt' if cantidad == 1 else 'prompts'}",
        "conectado": f"{quien} se conectó",
        "edicion": f"{quien} envió {cantidad} {'edición' if cantidad == 1 else 'ediciones'} de landing",
        "auditoria": f"{quien} registró la revisión de una landing",
        "landing_lista": "Landing lista para entregar",
        "landing_error": f"{quien} envió una edición con otra medida",
        "completa": "Campaña completa",
        "error": f"{quien} no pudo enviar una imagen",
    }.get(tipo, "Novedad")


def listar_notificaciones(limite: int = 30) -> dict:
    with conexion() as con:
        filas = con.execute("SELECT * FROM notificaciones ORDER BY creado DESC, id LIMIT ?", (limite,)).fetchall()
        no_leidas = con.execute("SELECT COUNT(*) FROM notificaciones WHERE leida = 0").fetchone()[0]
    return {
        "no_leidas": no_leidas,
        "items": [
            {
                "id": f["id"], "tipo": f["tipo"], "origen": f["origen"], "titulo": _titulo_aviso(f["tipo"], f["origen"], f["cantidad"]),
                "detalle": f["detalle"], "cantidad": f["cantidad"], "campana_id": f["campana_id"],
                "campana_nombre": f["campana_nombre"], "leida": bool(f["leida"]), "creado": f["creado"],
                "landing_id": f["landing_id"],
            }
            for f in filas
        ],
    }


def marcar_leidas(ids: list[str] | None = None) -> dict:
    with conexion() as con:
        if ids is None:
            con.execute("UPDATE notificaciones SET leida = 1 WHERE leida = 0")
        else:
            for i in ids[:200]:
                con.execute("UPDATE notificaciones SET leida = 1 WHERE id = ?", (i,))
    return listar_notificaciones()


def registrar_contacto(cliente: str, nombre: str = "", metodo: str = "", agente: str = "", mcp_metodo: str = "") -> bool:
    """Anota que un cliente del conector (chatgpt, claude u otro) se comunicó con la plataforma.

    Si es la primera vez, o pasaron más de 10 minutos desde el último contacto, crea el aviso "se conectó".
    Devuelve True cuando fue una conexión nueva."""
    try:
        ahora_dt = datetime.now(timezone.utc)
        t = ahora_dt.isoformat(timespec="seconds")
        with conexion() as con:
            previo = con.execute("SELECT ultimo FROM contactos WHERE cliente = ?", (cliente,)).fetchone()
            con.execute(
                "INSERT INTO contactos (cliente, nombre, ultimo) VALUES (?,?,?) "
                "ON CONFLICT (cliente) DO UPDATE SET ultimo = EXCLUDED.ultimo, nombre = EXCLUDED.nombre",
                (cliente, nombre[:80], t),
            )
            con.execute(
                "INSERT INTO conector_log (id, creado, cliente, metodo, mcp_metodo, agente) VALUES (?,?,?,?,?,?)",
                (nuevo_id(), t, cliente, metodo[:12], mcp_metodo[:60], agente[:120]),
            )
            con.execute("DELETE FROM conector_log WHERE creado < ?", ((ahora_dt - timedelta(days=7)).isoformat(timespec="seconds"),))
            corte = (ahora_dt - timedelta(minutes=10)).isoformat(timespec="seconds")
            es_nueva = previo is None or previo["ultimo"] < corte
            if es_nueva:
                _notificar(con, "conectado", cliente, None, "", "Ya puede crear y enviar imágenes", 1)
            return es_nueva
    except Exception as e:  # llevar la cuenta nunca debe romper una llamada del conector
        import sys
        print(f"[pincel-ia] No se pudo registrar el contacto: {e!r}", file=sys.stderr)
        return False


def listar_registro(limite: int = 8) -> list[dict]:
    """Lo último que llegó al conector (sirve para ver qué envía ChatGPT cuando algo no conecta)."""
    with conexion() as con:
        filas = con.execute("SELECT * FROM conector_log ORDER BY creado DESC, id LIMIT ?", (limite,)).fetchall()
    return [
        {"creado": f["creado"], "cliente": f["cliente"], "metodo": f["metodo"], "mcp_metodo": f["mcp_metodo"], "agente": f["agente"]}
        for f in filas
    ]


def ultimo_contacto() -> dict:
    """Cuándo se comunicó por última vez cada asistente (sirve para saber si el conector está conectado).

    Cuenta tanto el simple contacto con el conector (al conectarlo) como la actividad real (avisos)."""
    with conexion() as con:
        def ultimo(origen: str):
            a = con.execute("SELECT MAX(creado) FROM notificaciones WHERE origen = ?", (origen,)).fetchone()[0]
            b = con.execute("SELECT ultimo FROM contactos WHERE cliente = ?", (origen,)).fetchone()
            candidatos = [x for x in (a, b[0] if b else None) if x]
            return max(candidatos) if candidatos else None
        otro = con.execute("SELECT nombre, ultimo FROM contactos WHERE cliente = 'otro'").fetchone()
        return {
            "chatgpt": ultimo("chatgpt"),
            "claude": ultimo("claude"),
            "otro": otro["ultimo"] if otro else None,
            "otro_nombre": otro["nombre"] if otro else "",
        }


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
        hoy = datetime.now(timezone.utc).date()
        semana = con.execute(
            "SELECT COUNT(*) FROM imagenes WHERE creado >= ?",
            ((datetime.now(timezone.utc) - timedelta(days=7)).isoformat(timespec="seconds"),),
        ).fetchone()[0]
        por_dia = dict(con.execute(
            "SELECT substr(creado, 1, 10), COUNT(*) FROM imagenes WHERE creado >= ? GROUP BY 1",
            ((hoy - timedelta(days=13)).isoformat(),),
        ).fetchall())
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
