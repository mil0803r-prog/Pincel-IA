"""Herramientas del conector para la sección Landing (Claude revisa y decide; ChatGPT edita las imágenes)."""

from __future__ import annotations

import asyncio

from mcp.server.mcpserver import Image

from . import archivos, config, db
from . import landing as lg
from .conector import ESCRITURA, LECTURA, _bytes_de, mcp

REGLAS_EDICION = (
    "REGLAS DE EDICIÓN: edita solo lo que indica la instrucción y deja todo lo demás igual. "
    "Conserva EXACTAMENTE el ancho y el alto del original (misma proporción; no recortes, no agregues márgenes, no deformes). "
    "Conserva todos los cintillos y rótulos, incluidos «OFERTA» y «SÚPER OFERTA». "
    "No inventes testimonios, avales, promesas ni condiciones comerciales. "
    "Distingue las banderas del país de venta de los sellos de origen o importación. "
    "Usa logos de transportadoras solo si están confirmados para esta tienda. "
    "Si el original no necesita el cambio, dilo en vez de editarlo."
)


def url_landing(lid: str) -> str:
    return f"{config.URL_PUBLICA}/landing/{lid}"


def _resumen(l: dict) -> dict:
    return {
        "landing": l["nombre"], "id": l["id"], "en_la_app": url_landing(l["id"]),
        "tipo": l["tipo"], "precios_decision": l["precios_decision"],
        "imagenes": l["total"], "listas": l["listas"], "lista_para_entregar": l["lista"],
        "pendientes": [p["texto"] for p in l["pendientes"]],
    }


@mcp.tool(annotations=LECTURA)
def obtener_mercado() -> dict:
    """Devuelve el mercado de venta configurado (país, moneda, idioma, tienda, transportadoras, pagos, envío, garantía).

    Si faltan país, moneda o idioma, pregunta al usuario primero el país de venta y confirma moneda e idioma;
    el idioma de la conversación no define el país. Lo que no se conoce aparece como null: no lo inventes."""
    m = lg.obtener_mercado()
    return {**m, "configurar_en": f"{config.URL_PUBLICA}/mercado"}


@mcp.tool(annotations=ESCRITURA)
def crear_landing(nombre: str, url: str = "", notas: str = "") -> dict:
    """Crea una landing en Pincel IA para adaptarla al mercado.

    Args:
        nombre: Nombre corto de la landing o del producto.
        url: Dirección de la página fuente (opcional; se puede importar después).
        notas: Indicaciones de la campaña (opcional).
    """
    l = lg.crear_landing(nombre, url, notas, origen="claude")
    return {**_resumen(l), "siguiente_paso": "Importar las imágenes con `importar_landing` (o arrastrarlas en la app)."}


@mcp.tool(annotations=ESCRITURA)
async def importar_landing(landing: str, url: str = "", reemplazar: bool = False) -> dict:
    """Trae las imágenes de la página fuente en su orden real y mide los archivos originales.

    Si la página carga las imágenes con JavaScript puede no encontrarlas: en ese caso el usuario las arrastra en la app.

    Args:
        landing: Nombre o id de la landing.
        url: Dirección de la página (si se omite, usa la guardada en la landing).
        reemplazar: true solo si la landing ya tiene imágenes y el usuario quiere volver a importarlas.
    """
    l = lg.buscar_landing(landing)
    try:
        r = await asyncio.to_thread(lg.importar_desde_url, l["id"], url, reemplazar)
    except db.Invalido as e:
        return {"ok": False, "error": str(e)}
    nueva = r["landing"]
    return {
        "ok": True, **_resumen(nueva), "importadas": r["importadas"], "omitidas": r["omitidas"][:10],
        "precios_encontrados_en_texto": r["precios_texto"], "tipo_sugerido": r["tipo_sugerido"],
        "medidas": [{"n": i["n"], "ancho": i["ancho"], "alto": i["alto"], "bytes": i["bytes"]} for i in nueva["imagenes"]],
        "siguiente_paso": (
            "Revisa las imágenes, clasifica la landing y registra la revisión con `registrar_auditoria`. "
            "Pregunta SIEMPRE al usuario si conserva o cambia los precios y muéstrale todos los precios, paquetes, "
            "precios anteriores y ahorros que encuentres."
        ),
    }


@mcp.tool(annotations=ESCRITURA)
def registrar_auditoria(
    landing: str,
    tipo: str = "",
    precios_encontrados: str = "",
    precios_decision: str = "",
    precios_nuevos: str = "",
    notas: str = "",
    imagenes: list[dict] | None = None,
) -> dict:
    """Registra el resultado de revisar la landing: clasificación, precios y qué hacer con cada imagen.

    `precios_decision` ('conservar' o 'cambiar') y `precios_nuevos` solo se envían DESPUÉS de que el usuario los haya
    contestado en esta landing; nunca los decidas por él. Elegir 'cambiar' exige los importes nuevos.

    Args:
        landing: Nombre o id de la landing.
        tipo: 'imagenes' (landing de imágenes), 'ficha' (ficha de producto) o 'hibrida', según el contenido visible.
        precios_encontrados: Todos los precios, paquetes, precios anteriores y ahorros hallados (uno por línea).
        precios_decision: 'conservar' o 'cambiar' (solo tras la respuesta del usuario).
        precios_nuevos: Importes nuevos, si eligió cambiar.
        notas: Observaciones (banderas, transportadoras, moneda, condiciones, garantía).
        imagenes: Una entrada por imagen: {"n": 3, "accion": "editar" | "intacta", "instruccion": "qué cambiar",
            "rol": "banner" | "carrusel", "hallazgos": "lo que se vio"}. Edita solo las que lo necesiten.
    """
    l = lg.buscar_landing(landing)
    cambios: dict = {}
    if tipo:
        cambios["tipo"] = tipo
    if precios_encontrados:
        cambios["precios_encontrados"] = precios_encontrados
    if precios_decision:
        cambios["precios_decision"] = precios_decision
    if precios_nuevos:
        cambios["precios_nuevos"] = precios_nuevos
    if notas:
        cambios["notas"] = notas
    if cambios:
        l = lg.actualizar_landing(l["id"], cambios)
    errores = []
    for im in imagenes or []:
        try:
            datos = {k: im[k] for k in ("accion", "instruccion", "rol", "hallazgos") if k in im}
            l = lg.actualizar_imagen(l["id"], int(im["n"]), datos)
        except (db.Invalido, db.NoEncontrado, KeyError, ValueError) as e:
            errores.append({"n": im.get("n"), "error": str(e)})
    a_editar = sum(1 for i in l["imagenes"] if i["accion"] == "editar")
    db.avisar("auditoria", "claude", None, f"{l['nombre']} · {a_editar} para editar de {l['total']}", 1, landing_id=l["id"])
    return {**_resumen(l), "para_editar": a_editar, "errores": errores}


@mcp.tool(annotations=LECTURA)
def estado_landing(landing: str = "") -> dict:
    """Estado de una landing (la más reciente si no indicas cuál): qué falta para entregarla y el detalle de cada imagen."""
    l = lg.buscar_landing(landing or None)
    return {
        **_resumen(l),
        "mercado_configurado": l["mercado"]["configurado"],
        "imagenes_detalle": [
            {"n": i["n"], "rol": i["rol"], "medidas": f"{i['ancho']}×{i['alto']}", "estado": i["estado"], "instruccion": i["instruccion"]}
            for i in l["imagenes"]
        ],
    }


@mcp.tool(annotations=LECTURA, structured_output=False)
def obtener_ediciones(landing: str = "", cantidad: int = 3) -> list:
    """Trae las siguientes imágenes de una landing que hay que EDITAR, con su instrucción y la imagen original.

    Edita cada una según su instrucción y envíala con `subir_edicion`. Cuando termines el lote, vuelve a llamar a esta
    herramienta hasta que `faltan_total` sea 0.

    Args:
        landing: Nombre o id de la landing (vacío = la más reciente).
        cantidad: Cuántas traer en este lote (1 a 5, por defecto 3).
    """
    l = lg.buscar_landing(landing or None)
    cantidad = max(1, min(5, int(cantidad or 3)))
    lote, faltan = lg.ediciones_pendientes(l["id"], cantidad)
    base = {"landing": l["nombre"], "id": l["id"], "en_la_app": url_landing(l["id"]), "faltan_total": faltan}
    if not lote:
        return [{**base, "ediciones": [], "instrucciones": "No hay ediciones pendientes en esta landing."}]
    m = l["mercado"]
    contexto = {
        "pais": m["pais"], "moneda": m["moneda"], "idioma": m["idioma"], "transportadoras_confirmadas": l["transportadoras_ok"] or None,
        "precios": ("conservar los de la fuente" if l["precios_decision"] == "conservar" else f"cambiar por: {l['precios_nuevos']}" if l["precios_decision"] == "cambiar" else "sin decidir"),
        "garantia": "conservar la de la referencia" if m["garantia"] == "conservar" else m["garantia"],
    }
    respuesta: list = [{
        **base, "contexto_mercado": contexto,
        "ediciones": [
            {"n": i["n"], "ancho": i["ancho"], "alto": i["alto"], "medida_exacta": f"{i['ancho']}×{i['alto']} px", "instruccion": i["instruccion"],
             "hallazgos": i["hallazgos"], "url_original": i["url"], "corregir": i["final"]["nota"] if i["final"] and i["estado"] == "dimension" else ""}
            for i in lote
        ],
        "instrucciones": (
            f"Edita estas {len(lote)} imágenes (adjuntas a continuación, en el mismo orden). {REGLAS_EDICION} "
            f"Apenas termines cada una, súbela con `subir_edicion` (landing='{l['id']}' y numero=n), sin esperar otra orden. "
            "Comprueba que la respuesta sea ok=true; si dice que la medida no coincide, rehaz la imagen con la medida exacta. "
            "Después vuelve a llamar a `obtener_ediciones` por el siguiente lote."
        ),
    }]
    for i in lote:
        datos = archivos.version_para_ia(i["archivo"], lado=1600)
        if datos:
            respuesta.append(Image(data=datos, format="png" if datos[:4] == b"\x89PNG" else "jpeg"))
    return respuesta


@mcp.tool(annotations=ESCRITURA, meta={"openai/fileParams": ["imagen"]})
async def subir_edicion(landing: str, numero: int, imagen: dict | str) -> dict:
    """Envía a Pincel IA la imagen editada de la posición `numero` de una landing.

    La plataforma compara su ancho y alto con el original: si la proporción no coincide, no la acepta y hay que rehacerla.

    Args:
        landing: id de la landing (lo da `obtener_ediciones`).
        numero: Número de la imagen (el `n` de la edición).
        imagen: La imagen editada (archivo adjunto de la conversación).
    """
    l = lg.buscar_landing(landing)
    try:
        datos = await _bytes_de(imagen)
        nueva = await asyncio.to_thread(lg.guardar_final, l["id"], int(numero), datos, "chatgpt")
    except Exception as e:
        motivo = str(e) if isinstance(e, (db.Invalido, db.NoEncontrado)) else "no se pudo leer o descargar el archivo"
        db.avisar("error", "chatgpt", None, f"{l['nombre']} · edición #{numero}: {motivo}", landing_id=l["id"])
        return {"ok": False, "error": motivo}
    img = next(i for i in nueva["imagenes"] if i["n"] == int(numero))
    ok = img["estado"] == "editada"
    return {
        "ok": ok, "numero": int(numero), "estado": img["estado"], "medidas": (img["final"] or {}).get("nota", ""),
        **({} if ok else {"error": (img["final"] or {}).get("nota", "La edición no se pudo aceptar.")}),
        "faltan": len([i for i in nueva["imagenes"] if i["accion"] == "editar" and i["estado"] != "editada"]),
        "en_la_app": url_landing(nueva["id"]),
    }
