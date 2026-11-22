"""Conector MCP de Pincel IA: herramientas para Claude y para ChatGPT."""

from __future__ import annotations

import asyncio
import base64
import urllib.request
from typing import Any
from urllib.parse import urlparse

from mcp.server.mcpserver import MCPServer
from mcp.types import ToolAnnotations

from . import config, db

mcp = MCPServer(
    "pincel-ia",
    title="Pincel IA",
    instructions=(
        "Pincel IA es la plataforma de campañas de imágenes del usuario. "
        "Desde Claude: usa `crear_campana` con TODOS los prompts de imagen juntos. "
        "Desde ChatGPT: usa `obtener_prompts`, genera cada imagen con el prompt EXACTO y, cuando el "
        "usuario diga 'enviar a la plataforma', usa `subir_imagen` una vez por cada imagen."
    ),
)

LECTURA = ToolAnnotations(read_only_hint=True, open_world_hint=False)
ESCRITURA = ToolAnnotations(read_only_hint=False, destructive_hint=False, open_world_hint=False)


def url_app(cid: str) -> str:
    return f"{config.URL_PUBLICA}/campanas/{cid}"


def _resumen(c: dict) -> dict:
    return {
        "campana": c["nombre"],
        "id": c["id"],
        "en_la_app": url_app(c["id"]),
        "imagenes_cargadas": f"{c['hechas']}/{c['total']}",
        "faltan": [p["n"] for p in c.get("prompts", []) if not p["imagen"]],
    }


# ---------------------------------------------------------------- Claude

@mcp.tool(annotations=ESCRITURA)
def crear_campana(nombre: str, prompts: list[str], notas_estilo: str = "") -> dict:
    """Guarda en Pincel IA una campaña con sus prompts de imagen para crearlos luego en ChatGPT.

    Args:
        nombre: Nombre corto y fácil de decir (ej. "crema black friday"). El usuario lo usará en ChatGPT.
        prompts: Todos los prompts de imagen, uno por imagen, completos y detallados.
        notas_estilo: Indicaciones comunes opcionales (formato vertical 9:16, colores de marca, etc.).
    """
    c = db.crear_campana(nombre, prompts, notas_estilo, origen="claude")
    return {
        **_resumen(c),
        "siguiente_paso": f'En ChatGPT, con el conector Pincel IA activo, escribe: "Trae la campaña {c["nombre"]} y crea las imágenes".',
    }


@mcp.tool(annotations=LECTURA)
def listar_campanas(limite: int = 10) -> list[dict]:
    """Lista las campañas más recientes de Pincel IA y cuántas imágenes tiene cada una."""
    return [
        {"campana": c["nombre"], "id": c["id"], "imagenes_cargadas": f"{c['hechas']}/{c['total']}",
         "en_la_app": url_app(c["id"])}
        for c in db.listar_campanas(limite=limite)
    ]


@mcp.tool(annotations=LECTURA)
def obtener_imagenes(campana: str = "") -> dict:
    """Devuelve los links públicos de las imágenes de una campaña (por nombre o id; vacío = la última)."""
    c = db.buscar_campana(campana or None)
    return {
        **_resumen(c),
        "imagenes": [
            {"n": p["n"], "url": p["imagen"]["url"] if p["imagen"] else None, "prompt": p["texto"]}
            for p in c["prompts"]
        ],
    }


# ---------------------------------------------------------------- ChatGPT

@mcp.tool(annotations=LECTURA)
def obtener_prompts(campana: str = "") -> dict:
    """Trae los prompts de una campaña de Pincel IA para crear las imágenes.

    Args:
        campana: Nombre o id de la campaña. Vacío = la campaña más reciente.
    """
    c = db.buscar_campana(campana or None)
    total = c["total"]
    return {
        **_resumen(c),
        "instrucciones": (
            f"Genera {total} imágenes, una por cada prompt, en orden del 1 al {total}, usando el texto EXACTO "
            "de cada prompt (no lo resumas ni lo cambies). No pidas confirmación entre imágenes. "
            "Antes de cada imagen escribe su número (ej. 'Imagen 3/7'). "
            + (f"Aplica a todas: {c['notas']}. " if c["notas"] else "")
            + "Cuando el usuario diga 'enviar a la plataforma', llama a `subir_imagen` una vez por cada imagen, "
            f"con campana='{c['id']}' y su número. Si no puedes adjuntar las imágenes, dile al usuario que las "
            f"descargue y las arrastre en la campaña dentro de la app: {url_app(c['id'])}"
        ),
        "prompts": [{"n": p["n"], "prompt": p["texto"], "ya_cargada": bool(p["imagen"])} for p in c["prompts"]],
    }


def _descargar(url: str) -> bytes:
    if urlparse(url).scheme not in ("https", "http"):
        raise ValueError("URL de imagen inválida.")
    req = urllib.request.Request(url, headers={"User-Agent": "pincel-ia"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read(config.MAX_BYTES + 1)


async def _bytes_de(imagen: Any) -> bytes:
    """Acepta el archivo de ChatGPT ({download_url, file_id}), una URL o base64."""
    if isinstance(imagen, dict):
        url = imagen.get("download_url") or imagen.get("url")
        if url:
            return await asyncio.to_thread(_descargar, url)
        imagen = imagen.get("base64") or imagen.get("data")
        if not imagen:
            raise ValueError("El archivo no trae download_url.")
    if isinstance(imagen, str):
        s = imagen.strip()
        if s.startswith(("http://", "https://")):
            return await asyncio.to_thread(_descargar, s)
        if s.startswith("data:"):
            s = s.split(",", 1)[1]
        return base64.b64decode(s, validate=False)
    raise ValueError("Formato de imagen no reconocido.")


@mcp.tool(annotations=ESCRITURA, meta={"openai/fileParams": ["imagen"]})
async def subir_imagen(campana: str, numero: int, imagen: dict | str) -> dict:
    """Envía a Pincel IA una imagen creada en esta conversación.

    Args:
        campana: id de la campaña (lo da `obtener_prompts`).
        numero: Número del prompt al que corresponde la imagen (1, 2, 3...).
        imagen: La imagen generada (archivo adjunto de la conversación).
    """
    c = db.buscar_campana(campana)
    try:
        datos = await _bytes_de(imagen)
        img = await asyncio.to_thread(db.guardar_imagen, c["id"], numero, datos, "chatgpt")
    except Exception as e:
        return {
            "ok": False,
            "error": str(e),
            "alternativa": f"Pide al usuario que descargue las imágenes y las arrastre en la app: {url_app(c['id'])}",
        }
    c = db.obtener_campana(c["id"])
    return {"ok": True, "numero": numero, "url": img["url"], **_resumen(c)}
