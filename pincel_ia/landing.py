"""Sección Landing: adaptar landings a un mercado.

Flujo (según la plantilla de trabajo del proyecto):
  1. Configurar el mercado (país, moneda e idioma son obligatorios; el resto se completa cuando hace falta).
  2. Traer las imágenes de la landing, en orden, con sus medidas reales.
  3. Clasificar la landing y decidir, imagen por imagen, qué queda intacto y qué se edita.
  4. Preguntar SIEMPRE por los precios (conservar o cambiar) en cada landing.
  5. Editar solo lo necesario conservando exactamente ancho y alto, y entregar todo numerado en orden.
"""

from __future__ import annotations

import io
import ipaddress
import json
import re
import socket
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from html.parser import HTMLParser
from time import monotonic

from PIL import Image

from . import archivos, config, db
from .db import Invalido, NoEncontrado, _notificar, ahora, conexion, nuevo_id

TIPOS = {"imagenes": "Landing de imágenes", "ficha": "Ficha de producto", "hibrida": "Híbrida"}
ACCIONES = ("intacta", "editar")
ROLES = ("banner", "carrusel")
DECISIONES = ("conservar", "cambiar")
CAMPOS_MERCADO = ("pais", "moneda", "idioma", "tienda", "transportadoras", "medios_pago", "condiciones_envio", "garantia")
OBLIGATORIOS_MERCADO = ("pais", "moneda", "idioma")
UA_MOVIL = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 "
    "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
)


# ---------------------------------------------------------------- mercado

def obtener_mercado() -> dict:
    with conexion() as con:
        f = con.execute("SELECT * FROM mercado WHERE id = 1").fetchone()
    m = {c: (f[c] if f else None) for c in CAMPOS_MERCADO}
    m["garantia"] = m["garantia"] or "conservar"
    m["actualizado"] = f["actualizado"] if f else None
    m["faltan"] = [c for c in OBLIGATORIOS_MERCADO if not (m[c] or "").strip()]
    m["configurado"] = not m["faltan"]
    return m


def guardar_mercado(datos: dict) -> dict:
    sets, valores = [], []
    for c in CAMPOS_MERCADO:
        if c in datos:
            v = (str(datos[c]) if datos[c] is not None else "").strip()[:600]
            sets.append(f"{c} = ?")
            valores.append(v or ("conservar" if c == "garantia" else None))  # None = desconocido
    if sets:
        with conexion() as con:
            con.execute(f"UPDATE mercado SET {', '.join(sets)}, actualizado = ? WHERE id = 1", (*valores, ahora()))
    return obtener_mercado()


# ---------------------------------------------------------------- landings

def _url_limpia(url: str) -> str:
    url = (url or "").strip()
    if not url:
        return ""
    if not re.match(r"^https?://", url, re.I):
        url = "https://" + url
    p = urllib.parse.urlparse(url)
    if not p.netloc or " " in url:
        raise Invalido("La dirección de la landing no es válida.")
    return url[:1000]


def _estado_item(f) -> str:
    if not f["accion"]:
        return "sin_decidir"
    if f["accion"] == "intacta":
        return "intacta"
    if not f["final_archivo"]:
        return "por_editar"
    return "editada" if f["final_estado"] == "ok" else "dimension"


def _img_dict(f) -> dict:
    final = None
    if f["final_archivo"]:
        final = {
            "ruta": f"/i/{f['final_archivo']}", "ruta_miniatura": f"/i/t/{f['final_miniatura']}",
            "url": f"{config.URL_PUBLICA}/i/{f['final_archivo']}", "archivo": f["final_archivo"],
            "ancho": f["final_ancho"], "alto": f["final_alto"], "bytes": f["final_bytes"],
            "estado": f["final_estado"], "nota": f["final_nota"],
        }
    return {
        "id": f["id"], "n": f["n"], "origen_url": f["origen_url"],
        "ruta": f"/i/{f['archivo']}", "ruta_miniatura": f"/i/t/{f['miniatura']}",
        "url": f"{config.URL_PUBLICA}/i/{f['archivo']}", "archivo": f["archivo"],
        "ancho": f["ancho"], "alto": f["alto"], "bytes": f["bytes"],
        "formato": f["archivo"].rsplit(".", 1)[-1].lower(),
        "rol": f["rol"], "accion": f["accion"], "instruccion": f["instruccion"], "hallazgos": f["hallazgos"],
        "final": final, "estado": _estado_item(f),
    }


def _pendientes(l: dict, mercado: dict) -> list[dict]:
    """Lo que falta para poder cerrar la entrega. Una landing está lista cuando no queda nada aquí."""
    p: list[dict] = []
    imgs = l["imagenes"]
    if not imgs:
        p.append({"clave": "imagenes", "texto": "Traer las imágenes de la landing, en orden."})
    if not mercado["configurado"]:
        p.append({"clave": "mercado", "texto": "Configurar el mercado: " + ", ".join(mercado["faltan"]) + "."})
    if not l["tipo"]:
        p.append({"clave": "tipo", "texto": "Clasificar la landing (imágenes, ficha de producto o híbrida)."})
    if not l["precios_decision"]:
        p.append({"clave": "precios", "texto": "Decidir si conservas o cambias los precios (se pregunta en cada landing)."})
    elif l["precios_decision"] == "cambiar" and not l["precios_nuevos"].strip():
        p.append({"clave": "precios_importes", "texto": "Escribir los importes nuevos: elegiste cambiar los precios."})
    sin = [i for i in imgs if i["estado"] == "sin_decidir"]
    if sin:
        p.append({"clave": "sin_decidir", "texto": f"{len(sin)} {'imagen' if len(sin) == 1 else 'imágenes'} sin decidir (intacta o editar)."})
    sin_instr = [i for i in imgs if i["accion"] == "editar" and not i["instruccion"].strip()]
    if sin_instr:
        p.append({"clave": "sin_instruccion", "texto": f"{len(sin_instr)} para editar sin indicar qué cambiar."})
    por = [i for i in imgs if i["estado"] == "por_editar"]
    if por:
        p.append({"clave": "por_editar", "texto": f"{len(por)} {'edición pendiente' if len(por) == 1 else 'ediciones pendientes'}."})
    dim = [i for i in imgs if i["estado"] == "dimension"]
    if dim:
        p.append({"clave": "dimension", "texto": f"{len(dim)} con medidas distintas al original: hay que rehacerlas con la medida exacta."})
    return p


def _resumen(con, f) -> dict:
    imgs = con.execute("SELECT * FROM landing_imagenes WHERE landing_id = ?", (f["id"],)).fetchall()
    estados = [_estado_item(i) for i in imgs]
    total = len(imgs)
    listas = sum(1 for e in estados if e in ("intacta", "editada"))
    return {
        "id": f["id"], "nombre": f["nombre"], "url": f["url"], "tipo": f["tipo"],
        "precios_decision": f["precios_decision"], "creado": f["creado"], "actualizado": f["actualizado"],
        "total": total, "listas": listas, "a_editar": sum(1 for i in imgs if i["accion"] == "editar"),
        "sin_decidir": sum(1 for e in estados if e == "sin_decidir"),
        "portada": f"/i/t/{imgs[0]['miniatura']}" if imgs else None,
        "miniaturas": [f"/i/t/{i['miniatura']}" for i in sorted(imgs, key=lambda x: x["n"])[:4]],
    }


def obtener_landing(lid: str) -> dict:
    with conexion() as con:
        f = con.execute("SELECT * FROM landings WHERE id = ?", (lid,)).fetchone()
        if f is None:
            raise NoEncontrado(f"No existe la landing '{lid}'.")
        filas = con.execute("SELECT * FROM landing_imagenes WHERE landing_id = ? ORDER BY n", (lid,)).fetchall()
        l = _resumen(con, f)
    l.update({
        "precios_nuevos": f["precios_nuevos"], "precios_encontrados": f["precios_encontrados"],
        "transportadoras_ok": f["transportadoras_ok"], "notas": f["notas"],
        "imagenes": [_img_dict(i) for i in filas],
    })
    m = obtener_mercado()
    l["mercado"] = m
    l["pendientes"] = _pendientes(l, m)
    l["lista"] = not l["pendientes"]
    return l


def listar_landings() -> list[dict]:
    with conexion() as con:
        return [_resumen(con, f) for f in con.execute("SELECT * FROM landings ORDER BY creado DESC").fetchall()]


def buscar_landing(ref: str | None) -> dict:
    """Por id exacto, por nombre (parcial, sin mayúsculas) o la más reciente si ref está vacío."""
    with conexion() as con:
        if not ref or not ref.strip():
            r = con.execute("SELECT id FROM landings ORDER BY creado DESC LIMIT 1").fetchone()
            if r is None:
                raise NoEncontrado("Todavía no hay landings. Crea una primero.")
        else:
            ref = ref.strip()
            r = con.execute("SELECT id FROM landings WHERE id = ?", (ref,)).fetchone() or con.execute(
                "SELECT id FROM landings WHERE lower(nombre) LIKE lower(?) ORDER BY creado DESC LIMIT 1", (f"%{ref}%",)
            ).fetchone()
            if r is None:
                raise NoEncontrado(f"No encontré la landing '{ref}'.")
    return obtener_landing(r["id"])


def crear_landing(nombre: str, url: str = "", notas: str = "", origen: str = "app") -> dict:
    nombre = (nombre or "").strip()[:120]
    if not nombre:
        raise Invalido("La landing necesita un nombre.")
    lid, t = nuevo_id(), ahora()
    with conexion() as con:
        con.execute(
            "INSERT INTO landings (id, nombre, url, notas, creado, actualizado) VALUES (?,?,?,?,?,?)",
            (lid, nombre, _url_limpia(url), (notas or "").strip(), t, t),
        )
    return obtener_landing(lid)


def actualizar_landing(lid: str, datos: dict) -> dict:
    obtener_landing(lid)
    sets, valores = [], []
    if "nombre" in datos:
        nombre = str(datos["nombre"] or "").strip()[:120]
        if not nombre:
            raise Invalido("El nombre no puede quedar vacío.")
        sets.append("nombre = ?"); valores.append(nombre)
    if "url" in datos:
        sets.append("url = ?"); valores.append(_url_limpia(str(datos["url"] or "")))
    if "tipo" in datos:
        t = datos["tipo"] or None
        if t is not None and t not in TIPOS:
            raise Invalido("Tipo de landing no válido (imagenes, ficha o hibrida).")
        sets.append("tipo = ?"); valores.append(t)
    if "precios_decision" in datos:
        d = datos["precios_decision"] or None
        if d is not None and d not in DECISIONES:
            raise Invalido("La decisión de precios debe ser 'conservar' o 'cambiar'.")
        sets.append("precios_decision = ?"); valores.append(d)
    for c in ("precios_nuevos", "precios_encontrados", "transportadoras_ok", "notas"):
        if c in datos:
            sets.append(f"{c} = ?"); valores.append(str(datos[c] or "").strip()[:4000])
    if sets:
        with conexion() as con:
            con.execute(f"UPDATE landings SET {', '.join(sets)}, actualizado = ? WHERE id = ?", (*valores, ahora(), lid))
    return obtener_landing(lid)


def eliminar_landing(lid: str) -> None:
    with conexion() as con:
        arch = con.execute("SELECT archivo, miniatura, final_archivo, final_miniatura FROM landing_imagenes WHERE landing_id = ?", (lid,)).fetchall()
        cur = con.execute("DELETE FROM landings WHERE id = ?", (lid,))
        if cur.rowcount == 0:
            raise NoEncontrado(f"No existe la landing '{lid}'.")
        con.execute("DELETE FROM notificaciones WHERE landing_id = ?", (lid,))
    for a in arch:
        archivos.borrar(a["archivo"], a["miniatura"])
        archivos.borrar(a["final_archivo"], a["final_miniatura"])


# ---------------------------------------------------------------- imágenes

def agregar_originales(lid: str, items: list[tuple[bytes, str]]) -> dict:
    """Agrega imágenes originales al final (en el orden recibido). Devuelve cuántas entraron y qué falló."""
    obtener_landing(lid)
    entradas, errores = 0, []
    for datos, origen_url in items:
        try:
            info = archivos.procesar(datos, conservar=True)
        except Invalido as e:
            errores.append({"origen": origen_url[:200], "error": str(e)})
            continue
        try:
            with conexion() as con:
                n = con.execute("SELECT COALESCE(MAX(n), 0) FROM landing_imagenes WHERE landing_id = ?", (lid,)).fetchone()[0] + 1
                con.execute(
                    "INSERT INTO landing_imagenes (id, landing_id, n, origen_url, archivo, miniatura, ancho, alto, bytes, creado) "
                    "VALUES (?,?,?,?,?,?,?,?,?,?)",
                    (info["id"], lid, n, origen_url[:1000], info["archivo"], info["miniatura"], info["ancho"], info["alto"], info["bytes"], ahora()),
                )
                con.execute("UPDATE landings SET actualizado = ? WHERE id = ?", (ahora(), lid))
            entradas += 1
        except Exception:
            archivos.borrar(info["archivo"], info["miniatura"])
            raise
    return {"importadas": entradas, "errores": errores}


def _fila_imagen(con, lid: str, n: int):
    f = con.execute("SELECT * FROM landing_imagenes WHERE landing_id = ? AND n = ?", (lid, n)).fetchone()
    if f is None:
        raise NoEncontrado(f"La landing no tiene la imagen {n}.")
    return f


def actualizar_imagen(lid: str, n: int, datos: dict) -> dict:
    sets, valores = [], []
    if "accion" in datos:
        a = datos["accion"] or None
        if a is not None and a not in ACCIONES:
            raise Invalido("La acción debe ser 'intacta' o 'editar'.")
        sets.append("accion = ?"); valores.append(a)
    if "rol" in datos:
        if datos["rol"] not in ROLES:
            raise Invalido("El rol debe ser 'banner' o 'carrusel'.")
        sets.append("rol = ?"); valores.append(datos["rol"])
    for c in ("instruccion", "hallazgos"):
        if c in datos:
            sets.append(f"{c} = ?"); valores.append(str(datos[c] or "").strip()[:2000])
    with conexion() as con:
        _fila_imagen(con, lid, n)
        if sets:
            con.execute(f"UPDATE landing_imagenes SET {', '.join(sets)} WHERE landing_id = ? AND n = ?", (*valores, lid, n))
            con.execute("UPDATE landings SET actualizado = ? WHERE id = ?", (ahora(), lid))
    return obtener_landing(lid)


def quitar_imagen(lid: str, n: int) -> dict:
    """Quita una imagen de la secuencia (p. ej. un ícono) y renumera el resto para que siga el orden real."""
    with conexion() as con:
        f = _fila_imagen(con, lid, n)
        con.execute("DELETE FROM landing_imagenes WHERE id = ?", (f["id"],))
        con.execute("UPDATE landing_imagenes SET n = n - 1 WHERE landing_id = ? AND n > ?", (lid, n))
        con.execute("UPDATE landings SET actualizado = ? WHERE id = ?", (ahora(), lid))
    archivos.borrar(f["archivo"], f["miniatura"])
    archivos.borrar(f["final_archivo"], f["final_miniatura"])
    return obtener_landing(lid)


def ajustar_a_original(datos: bytes, ao: int, ho: int) -> tuple[bytes, str, str]:
    """Compara la edición con el original. Misma medida o misma proporción → 'ok'; otra proporción → 'dimension'.

    Nunca se recorta, se agregan márgenes ni se deforma: si la proporción no coincide, hay que rehacerla."""
    with Image.open(io.BytesIO(datos)) as im:
        fmt = im.format or "PNG"
        w, h = im.size
        if (w, h) == (ao, ho):
            return datos, "ok", "Mismas dimensiones que el original."
        if abs((w / h) / (ao / ho) - 1) <= 0.005:
            base = im.convert("RGBA") if im.mode in ("RGBA", "LA", "P") else im.convert("RGB")
            salida = base.resize((ao, ho), Image.LANCZOS)
            buf = io.BytesIO()
            if fmt == "JPEG":
                salida.convert("RGB").save(buf, "JPEG", quality=95, subsampling=0)
            elif fmt == "WEBP":
                salida.save(buf, "WEBP", quality=95, method=4)
            else:
                salida.save(buf, "PNG", optimize=True)
            return buf.getvalue(), "ok", f"Reescalada de {w}×{h} a {ao}×{ho} px (misma proporción, sin deformar)."
        return datos, "dimension", (
            f"Llegó con {w}×{h} px y el original mide {ao}×{ho} px: la proporción no coincide. "
            f"Pídele que la rehaga con la medida exacta {ao}×{ho} px."
        )


def guardar_final(lid: str, n: int, datos: bytes, origen: str = "app") -> dict:
    """Guarda la imagen editada de la posición n y verifica sus medidas contra el original."""
    with conexion() as con:
        f = _fila_imagen(con, lid, n)
        nombre = con.execute("SELECT nombre FROM landings WHERE id = ?", (lid,)).fetchone()["nombre"]
    antes = obtener_landing(lid)
    ajustada, estado, nota = ajustar_a_original(datos, f["ancho"], f["alto"])
    info = archivos.procesar(ajustada, conservar=True)
    try:
        with conexion() as con:
            con.execute(
                "UPDATE landing_imagenes SET final_archivo = ?, final_miniatura = ?, final_ancho = ?, final_alto = ?, "
                "final_bytes = ?, final_estado = ?, final_nota = ?, accion = COALESCE(accion, 'editar') "
                "WHERE landing_id = ? AND n = ?",
                (info["archivo"], info["miniatura"], info["ancho"], info["alto"], info["bytes"], estado, nota, lid, n),
            )
            con.execute("UPDATE landings SET actualizado = ? WHERE id = ?", (ahora(), lid))
            if origen == "chatgpt":
                if estado == "ok":
                    _notificar(con, "edicion", "chatgpt", None, nombre, f"{nombre} · imagen #{n}", 1, agrupar=True, landing_id=lid)
                else:
                    _notificar(con, "landing_error", "chatgpt", None, nombre, f"{nombre} · imagen #{n}: {nota}", 1, landing_id=lid)
    except Exception:
        archivos.borrar(info["archivo"], info["miniatura"])
        raise
    archivos.borrar(f["final_archivo"], f["final_miniatura"])  # la edición anterior de esa posición
    despues = obtener_landing(lid)
    if despues["lista"] and not antes["lista"]:
        with conexion() as con:
            _notificar(con, "landing_lista", origen, None, nombre, f"{nombre} · {despues['total']} imágenes", despues["total"], landing_id=lid)
    return despues


def quitar_final(lid: str, n: int) -> dict:
    with conexion() as con:
        f = _fila_imagen(con, lid, n)
        con.execute(
            "UPDATE landing_imagenes SET final_archivo = NULL, final_miniatura = NULL, final_ancho = NULL, final_alto = NULL, "
            "final_bytes = NULL, final_estado = NULL, final_nota = '' WHERE landing_id = ? AND n = ?", (lid, n),
        )
    archivos.borrar(f["final_archivo"], f["final_miniatura"])
    return obtener_landing(lid)


def ediciones_pendientes(lid: str, cantidad: int = 3) -> tuple[list[dict], int]:
    """Las siguientes imágenes marcadas para editar que aún no tienen edición válida, y cuántas quedan en total."""
    l = obtener_landing(lid)
    cola = [i for i in l["imagenes"] if i["accion"] == "editar" and i["estado"] in ("por_editar", "dimension")]
    return cola[: max(1, cantidad)], len(cola)


# ---------------------------------------------------------------- importar desde una URL

def _validar_url(url: str) -> None:
    p = urllib.parse.urlparse(url)
    if p.scheme not in ("http", "https") or not p.hostname:
        raise ValueError("Solo se aceptan direcciones http o https.")
    if config.PERMITIR_REDES_PRIVADAS:
        return
    try:
        direcciones = {ai[4][0] for ai in socket.getaddrinfo(p.hostname, p.port or (443 if p.scheme == "https" else 80))}
    except socket.gaierror:
        raise ValueError("No se encontró ese sitio.")
    if not direcciones or any(not ipaddress.ip_address(d).is_global for d in direcciones):
        raise ValueError("Esa dirección no está permitida (apunta a una red interna).")


class _Redirigir(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        _validar_url(urllib.parse.urljoin(req.full_url, newurl))
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def _descargar(url: str, maximo: int, timeout: float = 20) -> tuple[bytes, str, str]:
    _validar_url(url)
    req = urllib.request.Request(url, headers={"User-Agent": UA_MOVIL, "Accept": "*/*", "Accept-Language": "es,en;q=0.8"})
    with urllib.request.build_opener(_Redirigir).open(req, timeout=timeout) as r:
        datos = r.read(maximo + 1)
        if len(datos) > maximo:
            raise ValueError("El archivo es demasiado grande.")
        return datos, r.headers.get("Content-Type", ""), r.geturl()


def _mejor_de_srcset(valor: str) -> str | None:
    mejor, peso = None, -1.0
    for trozo in (valor or "").split(","):
        partes = trozo.strip().split()
        if not partes:
            continue
        p = 0.0
        if len(partes) > 1:
            m = re.match(r"([\d.]+)[wx]", partes[1])
            p = float(m.group(1)) if m else 0.0
        if p > peso:
            mejor, peso = partes[0], p
    return mejor


class _Extractor(HTMLParser):
    """Recorre la página en orden: junta las imágenes (incluidas las de carga diferida) y el texto visible."""

    OCULTOS = {"script", "style", "noscript", "template"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.imagenes: list[str] = []
        self.texto: list[str] = []
        self._ocultos = 0
        self._picture: list[tuple[str, float]] | None = None

    def _candidatos(self, a: dict) -> list[tuple[str, float]]:
        r: list[tuple[str, float]] = []
        for clave in ("srcset", "data-srcset"):
            if a.get(clave):
                u = _mejor_de_srcset(a[clave])
                if u:
                    r.append((u, 1.0))
        if not r:
            for clave in ("data-src", "data-lazy-src", "data-original", "data-lazy", "src"):
                u = (a.get(clave) or "").strip()
                if u and not u.startswith("data:"):
                    r.append((u, 0.0))
                    break
        return r

    def handle_starttag(self, tag, attrs):
        a = {k: (v or "") for k, v in attrs}
        if tag in self.OCULTOS:
            self._ocultos += 1
            return
        if tag == "picture":
            self._picture = []
        elif tag in ("img", "source"):
            cands = self._candidatos(a)
            if self._picture is not None:
                self._picture.extend(cands)
            else:
                self.imagenes.extend(u for u, _ in cands[:1])
        for m in re.finditer(r"url\(\s*['\"]?([^)'\"]+)", a.get("style", "")):
            self.imagenes.append(m.group(1))

    def handle_endtag(self, tag):
        if tag in self.OCULTOS:
            self._ocultos = max(0, self._ocultos - 1)
        elif tag == "picture" and self._picture is not None:
            if self._picture:
                self.imagenes.append(max(self._picture, key=lambda c: c[1])[0])
            self._picture = None

    def handle_data(self, data):
        if not self._ocultos and data.strip():
            self.texto.append(data.strip())


_MONEDAS = r"COP|MXN|USD|PEN|CLP|ARS|BOB|UYU|PYG|GTQ|CRC|DOP|HNL|NIO|PAB|VES|EUR"
_PRECIO = re.compile(
    rf"(?:(?:US|COL|MX|CL|AR|PE)?\$|S/\.?|€|£|\b(?:{_MONEDAS})\b)\s?\d[\d.,]*(?:\s?(?:{_MONEDAS}|pesos|soles|dólares))?"
    rf"|\b\d[\d.,]*\s?(?:{_MONEDAS}|pesos|soles|dólares)\b",
    re.I,
)


def _precios_en_texto(texto: str) -> list[str]:
    vistos: list[str] = []
    for m in _PRECIO.finditer(texto):
        t = m.group(0).strip()
        if re.search(r"\d", t) and t not in vistos:
            vistos.append(t)
        if len(vistos) >= 30:
            break
    return vistos


def _tipo_sugerido(n_imagenes: int, texto: str) -> str:
    """Una pista (no una decisión): por lo que hay en la página, imágenes frente a texto."""
    letras = len(texto)
    if n_imagenes >= 8 and letras < 2500:
        return "imagenes"
    if n_imagenes <= 5 and letras > 3000:
        return "ficha"
    return "hibrida"


def importar_desde_url(lid: str, url: str = "", reemplazar: bool = False) -> dict:
    """Trae las imágenes de la landing en el orden de la página (vista móvil) y mide sus archivos originales."""
    l = obtener_landing(lid)
    url = _url_limpia(url or l["url"])
    if not url:
        raise Invalido("Falta la dirección de la landing.")
    if l["imagenes"] and not reemplazar:
        raise Invalido("Esta landing ya tiene imágenes. Confirma que quieres reemplazarlas para volver a importar.")
    try:
        html_bytes, _tipo, final_url = _descargar(url, 6_000_000)
    except (ValueError, OSError) as e:
        raise Invalido(f"No se pudo abrir la página: {e}")
    ex = _Extractor()
    ex.feed(html_bytes.decode("utf-8", "ignore"))
    vistas: list[str] = []
    for u in ex.imagenes:
        u = urllib.parse.urljoin(final_url, u.strip())
        base = u.split("?")[0].lower()
        if u.startswith("http") and not base.endswith((".svg", ".ico", ".css", ".js")) and u not in vistas:
            vistas.append(u)
    vistas = vistas[:120]
    if not vistas:
        raise Invalido("No encontré imágenes en esa página. Puede cargarlas con JavaScript: arrastra las imágenes en orden.")

    limite = monotonic() + 45
    def bajar(u: str):
        if monotonic() > limite:
            return u, None, "se acabó el tiempo"
        try:
            return u, _descargar(u, 25 * 1024 * 1024, timeout=15)[0], None
        except Exception as e:
            return u, None, str(e)[:120]

    with ThreadPoolExecutor(max_workers=8) as pool:
        resultados = list(pool.map(bajar, vistas))  # respeta el orden de la página

    if reemplazar and l["imagenes"]:
        with conexion() as con:
            viejas = con.execute("SELECT archivo, miniatura, final_archivo, final_miniatura FROM landing_imagenes WHERE landing_id = ?", (lid,)).fetchall()
            con.execute("DELETE FROM landing_imagenes WHERE landing_id = ?", (lid,))
        for a in viejas:
            archivos.borrar(a["archivo"], a["miniatura"])
            archivos.borrar(a["final_archivo"], a["final_miniatura"])
    omitidas, items = [], []
    for u, datos, error in resultados:
        if datos is None:
            omitidas.append({"url": u, "motivo": error or "no se pudo descargar"})
            continue
        try:
            with Image.open(io.BytesIO(datos)) as im:
                w, h = im.size
        except Exception:
            omitidas.append({"url": u, "motivo": "no es una imagen que se pueda leer"})
            continue
        if min(w, h) < 80 or len(datos) < 2000:
            omitidas.append({"url": u, "motivo": f"muy pequeña ({w}×{h}): parece un ícono"})
            continue
        items.append((datos, u))
    res = agregar_originales(lid, items)
    texto = " ".join(ex.texto)
    precios = _precios_en_texto(texto)
    cambios = {"url": url}
    if precios and not l["precios_encontrados"]:
        cambios["precios_encontrados"] = "\n".join(precios)
    actualizar_landing(lid, cambios)
    return {
        "importadas": res["importadas"], "omitidas": omitidas + [{"url": e["origen"], "motivo": e["error"]} for e in res["errores"]],
        "precios_texto": precios, "tipo_sugerido": _tipo_sugerido(res["importadas"], texto),
        "landing": obtener_landing(lid),
    }


# ---------------------------------------------------------------- paquete de entrega

def _fmt(n: int | None) -> str:
    return f"{n:,}".replace(",", ".") if n is not None else "—"


def paquete(lid: str) -> dict:
    """Todo lo que se entrega: originales, finales numerados, complementos y los documentos (brief, informe, guía)."""
    l = obtener_landing(lid)
    m = l["mercado"]
    archivos_zip: list[dict] = []
    filas_manifiesto: list[dict] = []
    for i in l["imagenes"]:
        nn = f"{i['n']:02d}"
        ext = i["formato"]
        archivos_zip.append({"zip": f"originales/{nn}.{ext}", "ruta": i["ruta"]})
        efectiva = None
        if i["estado"] == "intacta":
            efectiva = ("original", i["ruta"], ext, i["ancho"], i["alto"])
        elif i["estado"] == "editada" and i["final"]:
            efectiva = ("editada", i["final"]["ruta"], i["final"]["archivo"].rsplit(".", 1)[-1], i["final"]["ancho"], i["final"]["alto"])
        carpeta = "complementos" if i["rol"] == "carrusel" else "finales"
        if efectiva:
            archivos_zip.append({"zip": f"{carpeta}/{nn}.{efectiva[2]}", "ruta": efectiva[1]})
        filas_manifiesto.append({
            "n": i["n"], "rol": i["rol"], "estado": i["estado"], "accion": i["accion"],
            "original": {"archivo": f"originales/{nn}.{ext}", "ancho": i["ancho"], "alto": i["alto"], "bytes": i["bytes"], "fuente": i["origen_url"]},
            "entrega": ({"archivo": f"{carpeta}/{nn}.{efectiva[2]}", "tipo": efectiva[0], "ancho": efectiva[3], "alto": efectiva[4]} if efectiva else None),
            "instruccion": i["instruccion"], "hallazgos": i["hallazgos"], "nota_medidas": (i["final"] or {}).get("nota", ""),
        })

    def linea(k: str, v) -> str:
        return f"- **{k}:** {v if (v or v == 0) else 'sin confirmar'}"

    brief = "\n".join([
        f"# Brief · {l['nombre']}", "",
        "## Mercado de venta",
        linea("País", m["pais"]), linea("Moneda", m["moneda"]), linea("Idioma", m["idioma"]), linea("Tienda", m["tienda"]),
        linea("Transportadoras", m["transportadoras"]), linea("Medios de pago", m["medios_pago"]),
        linea("Condiciones de envío", m["condiciones_envio"]),
        linea("Garantía", "conservar la de la referencia" if m["garantia"] == "conservar" else m["garantia"]), "",
        "## Landing",
        linea("Fuente", l["url"]), linea("Tipo", TIPOS.get(l["tipo"] or "", None)), "",
        "## Precios",
        linea("Decisión", {"conservar": "conservar los de la fuente", "cambiar": "cambiar por los importes indicados"}.get(l["precios_decision"] or "", None)),
        linea("Importes nuevos", l["precios_nuevos"] or None),
        "- **Encontrados en el texto de la página:** " + (", ".join(l["precios_encontrados"].split("\n")) if l["precios_encontrados"] else "ninguno"), "",
        "## Notas", l["notas"] or "—", "",
        "## Qué se edita",
        *(f"- #{i['n']:02d}: {i['instruccion'] or '(sin indicar)'}" for i in l["imagenes"] if i["accion"] == "editar"),
    ])
    pend = l["pendientes"]
    informe = "\n".join([
        f"# Informe · {l['nombre']}", "",
        "**Estado de la entrega: " + ("COMPLETA" if not pend else "INCOMPLETA") + "**", "",
        *(["Pendiente:", *(f"- {p['texto']}" for p in pend), ""] if pend else []),
        f"Imágenes: {l['total']} · intactas: {sum(1 for i in l['imagenes'] if i['estado'] == 'intacta')} · "
        f"editadas: {sum(1 for i in l['imagenes'] if i['estado'] == 'editada')} · "
        f"por resolver: {sum(1 for i in l['imagenes'] if i['estado'] not in ('intacta', 'editada'))}", "",
        "| # | Rol | Estado | Original (px) | Entrega (px) | Nota |", "| --- | --- | --- | --- | --- | --- |",
        *(
            f"| {r['n']:02d} | {r['rol']} | {r['estado']} | {r['original']['ancho']}×{r['original']['alto']} | "
            f"{(str(r['entrega']['ancho']) + '×' + str(r['entrega']['alto'])) if r['entrega'] else '—'} | {r['nota_medidas'] or ''} |"
            for r in filas_manifiesto
        ),
    ])
    carruseles = [r for r in filas_manifiesto if r["rol"] == "carrusel"]
    guia = "\n".join([
        f"# Guía de ubicación · {l['nombre']}", "",
        "- `originales/`: las imágenes tal como estaban en la fuente, numeradas en su orden real.",
        "- `finales/`: los banners listos, con el mismo número y orden que en la fuente (editados o intactos).",
        "- `complementos/`: carruseles y sus textos. " + (
            "Posiciones: " + ", ".join(f"#{r['n']:02d}" for r in carruseles) + "." if carruseles else "Esta landing no tiene carruseles."),
        "- Los botones y demás elementos HTML **no están dentro de las imágenes**: se colocan aparte en la página.",
        "- `manifiesto.json` lista cada pieza con sus medidas; `brief.md` resume las decisiones.",
    ])
    textos = {
        "brief.md": brief, "informe.md": informe, "GUIA.md": guia,
        "manifiesto.json": json.dumps({"landing": l["nombre"], "fuente": l["url"], "tipo": l["tipo"], "imagenes": filas_manifiesto}, ensure_ascii=False, indent=2),
    }
    slug = re.sub(r"[^a-z0-9]+", "-", l["nombre"].lower()).strip("-") or "landing"
    return {"nombre": slug, "archivos": archivos_zip, "textos": textos, "completa": not pend}
