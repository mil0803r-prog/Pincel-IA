"""Servidor de Pincel IA: un conector MCP remoto (para ChatGPT y Claude) + páginas web.

Flujo:
  1. Claude (tu skill de ventas) llama `crear_campana` con los 7+ prompts.
  2. En ChatGPT dices "trae la campaña X": ChatGPT llama `obtener_prompts` y genera las imágenes.
  3. "Enviar a la plataforma": ChatGPT llama `subir_imagen` por cada una
     (o tú las arrastras en el buzón web de la campaña).
  4. Las imágenes quedan con link público; Claude las consulta con `obtener_imagenes`.
"""

from __future__ import annotations

import asyncio
import base64
import os
import secrets
import sys
import urllib.request
from typing import Any
from urllib.parse import urlparse

from mcp.server.mcpserver import MCPServer
from mcp.server.transport_security import TransportSecuritySettings
from mcp.types import ToolAnnotations
from starlette.requests import Request
from starlette.responses import HTMLResponse, JSONResponse, Response, FileResponse

from . import almacen, web

TOKEN = os.environ.get("PINCEL_TOKEN") or ""
if not TOKEN:
    TOKEN = secrets.token_urlsafe(16)
    print(f"[pincel-ia] AVISO: PINCEL_TOKEN no definido; uso uno temporal: {TOKEN}", file=sys.stderr)
URL_PUBLICA = os.environ.get("PINCEL_URL_PUBLICA", "http://localhost:8000").rstrip("/")


def url_campana(cid: str) -> str:
    return f"{URL_PUBLICA}/c/{cid}"


def url_imagen(cid: str, archivo: str) -> str:
    return f"{URL_PUBLICA}/i/{cid}/{archivo}"


def resumen(c: dict) -> dict:
    hechas = [p for p in c["prompts"] if p["imagen"]]
    return {
        "campana": c["nombre"],
        "id": c["id"],
        "buzon": url_campana(c["id"]),
        "zip": f"{url_campana(c['id'])}.zip",
        "imagenes_cargadas": f"{len(hechas)}/{len(c['prompts'])}",
        "faltan": [p["n"] for p in c["prompts"] if not p["imagen"]],
    }


mcp = MCPServer(
    "pincel-ia",
    instructions=(
        "Pincel IA guarda campañas de prompts de imagen y recibe las imágenes creadas en ChatGPT. "
        "Desde Claude: usa `crear_campana` con TODOS los prompts juntos. "
        "Desde ChatGPT: usa `obtener_prompts`, genera cada imagen con el prompt EXACTO y, cuando el "
        "usuario diga 'enviar a la plataforma', usa `subir_imagen` una vez por imagen."
    ),
)

LECTURA = ToolAnnotations(read_only_hint=True, open_world_hint=False)
ESCRITURA = ToolAnnotations(read_only_hint=False, destructive_hint=False, open_world_hint=False)


# ---------------------------------------------------------------- herramientas para Claude

@mcp.tool(annotations=ESCRITURA)
def crear_campana(nombre: str, prompts: list[str], notas_estilo: str = "") -> dict:
    """Guarda una campaña con sus prompts de imagen para generarlos luego en ChatGPT.

    Args:
        nombre: Nombre corto y fácil de decir (ej. "crema black friday"). El usuario lo usará en ChatGPT.
        prompts: Todos los prompts de imagen, uno por imagen, completos y detallados.
        notas_estilo: Indicaciones comunes opcionales (formato vertical 9:16, colores de marca, etc.).
    """
    c = almacen.crear(nombre, prompts, notas_estilo)
    return {
        **resumen(c),
        "siguiente_paso": f'En ChatGPT, con el conector Pincel IA activo, escribe: "Trae la campaña {c["nombre"]} y crea las imágenes".',
    }


@mcp.tool(annotations=LECTURA)
def listar_campanas(limite: int = 10) -> list[dict]:
    """Lista las campañas más recientes y cuántas imágenes tiene cada una."""
    return [resumen(c) for c in almacen.listar(limite)]


@mcp.tool(annotations=LECTURA)
def obtener_imagenes(campana: str = "") -> dict:
    """Devuelve los links públicos de las imágenes de una campaña (por nombre o id; vacío = la última)."""
    c = almacen.buscar(campana or None)
    return {
        **resumen(c),
        "imagenes": [
            {"n": p["n"], "url": url_imagen(c["id"], p["imagen"]) if p["imagen"] else None, "prompt": p["prompt"]}
            for p in c["prompts"]
        ],
    }


# ---------------------------------------------------------------- herramientas para ChatGPT

@mcp.tool(annotations=LECTURA)
def obtener_prompts(campana: str = "") -> dict:
    """Trae los prompts de una campaña para crear las imágenes en ChatGPT.

    Args:
        campana: Nombre o id de la campaña. Vacío = la campaña más reciente.
    """
    c = almacen.buscar(campana or None)
    total = len(c["prompts"])
    return {
        **resumen(c),
        "instrucciones": (
            f"Genera {total} imágenes, una por cada prompt, en orden del 1 al {total}, usando el texto EXACTO "
            "de cada prompt (no lo resumas ni lo cambies). No pidas confirmación entre imágenes. "
            "Antes de cada imagen escribe su número (ej. 'Imagen 3/7'). "
            + (f"Aplica a todas: {c['notas']}. " if c["notas"] else "")
            + "Cuando el usuario diga 'enviar a la plataforma', llama a `subir_imagen` una vez por cada imagen, "
            f"con campana='{c['id']}' y su número. Si no puedes adjuntar las imágenes, dile al usuario que las "
            f"descargue y las arrastre en el buzón: {url_campana(c['id'])}"
        ),
        "prompts": [{"n": p["n"], "prompt": p["prompt"], "ya_cargada": bool(p["imagen"])} for p in c["prompts"]],
    }


def _descargar(url: str) -> bytes:
    if urlparse(url).scheme not in ("https", "http"):
        raise ValueError("URL de imagen inválida.")
    req = urllib.request.Request(url, headers={"User-Agent": "pincel-ia"})
    with urllib.request.urlopen(req, timeout=60) as r:
        datos = r.read(almacen.MAX_BYTES + 1)
    return datos


async def _bytes_de(imagen: Any) -> bytes:
    """Acepta el archivo de ChatGPT ({download_url, file_id}), una URL o base64."""
    if isinstance(imagen, dict):
        url = imagen.get("download_url") or imagen.get("url")
        if url:
            return await asyncio.to_thread(_descargar, url)
        b64 = imagen.get("base64") or imagen.get("data")
        if b64:
            imagen = b64
        else:
            raise ValueError("El archivo no trae download_url.")
    if isinstance(imagen, str):
        s = imagen.strip()
        if s.startswith(("http://", "https://")):
            return await asyncio.to_thread(_descargar, s)
        if s.startswith("data:"):
            s = s.split(",", 1)[1]
        return base64.b64decode(s, validate=False)
    raise ValueError("Formato de imagen no reconocido.")


@mcp.tool(
    annotations=ESCRITURA,
    meta={"openai/fileParams": ["imagen"]},
)
async def subir_imagen(campana: str, numero: int, imagen: dict | str) -> dict:
    """Envía a la plataforma una imagen creada en esta conversación.

    Args:
        campana: id de la campaña (lo da `obtener_prompts`).
        numero: Número del prompt al que corresponde la imagen (1, 2, 3...).
        imagen: La imagen generada (archivo adjunto de la conversación).
    """
    c = almacen.buscar(campana)
    try:
        datos = await _bytes_de(imagen)
        c = almacen.guardar_imagen(c["id"], numero, datos)
    except Exception as e:
        return {
            "ok": False,
            "error": str(e),
            "alternativa": f"Pide al usuario que descargue las imágenes y las arrastre en el buzón: {url_campana(c['id'])}",
        }
    p = next(p for p in c["prompts"] if p["n"] == numero)
    return {"ok": True, "numero": numero, "url": url_imagen(c["id"], p["imagen"]), **resumen(c)}


# ---------------------------------------------------------------- páginas web

@mcp.custom_route("/", methods=["GET"])
async def inicio(_: Request) -> Response:
    return HTMLResponse(web.inicio())


@mcp.custom_route(f"/{TOKEN}/panel", methods=["GET"])
async def panel(_: Request) -> Response:
    return HTMLResponse(web.panel(almacen.listar(200), URL_PUBLICA, TOKEN))


@mcp.custom_route("/c/{cid}", methods=["GET"])
async def pagina_campana(request: Request) -> Response:
    cid = request.path_params["cid"]
    if cid.endswith(".zip"):
        return await zip_campana(request)
    try:
        c = almacen.obtener(cid)
    except (KeyError, ValueError):
        return HTMLResponse(web.no_encontrada(), status_code=404)
    return HTMLResponse(web.campana(c))


async def zip_campana(request: Request) -> Response:
    cid = request.path_params["cid"].removesuffix(".zip")
    try:
        c = almacen.obtener(cid)
        datos = almacen.zip_campana(cid)
    except (KeyError, ValueError):
        return HTMLResponse(web.no_encontrada(), status_code=404)
    nombre = "".join(ch if ch.isalnum() else "-" for ch in c["nombre"]).strip("-") or "campana"
    return Response(datos, media_type="application/zip",
                    headers={"Content-Disposition": f'attachment; filename="{nombre}.zip"'})


@mcp.custom_route("/c/{cid}/subir", methods=["POST"])
async def subir_web(request: Request) -> Response:
    cid = request.path_params["cid"]
    try:
        almacen.obtener(cid)
        form = await request.form(max_files=50, max_part_size=almacen.MAX_BYTES)
        n = form.get("n")
        archivos = form.getlist("archivo")
        if not archivos:
            raise ValueError("No llegó ningún archivo.")
        for i, f in enumerate(archivos):
            datos = await f.read()
            puesto = int(n) + i if n else None
            almacen.guardar_imagen(cid, puesto, datos)
        return JSONResponse({"ok": True})
    except (KeyError, ValueError) as e:
        return JSONResponse({"ok": False, "error": str(e)}, status_code=400)


@mcp.custom_route("/i/{cid}/{archivo}", methods=["GET"])
async def imagen(request: Request) -> Response:
    try:
        p = almacen.ruta_imagen(request.path_params["cid"], request.path_params["archivo"])
    except (KeyError, ValueError):
        return Response(status_code=404)
    return FileResponse(p, headers={"Cache-Control": "public, max-age=31536000, immutable"})


# ---------------------------------------------------------------- arranque

def crear_app():
    host_publico = urlparse(URL_PUBLICA).netloc
    seguridad = TransportSecuritySettings(
        enable_dns_rebinding_protection=True,
        allowed_hosts=[host_publico, "localhost", "localhost:*", "127.0.0.1", "127.0.0.1:*"],
        allowed_origins=[URL_PUBLICA, "https://chatgpt.com", "https://chat.openai.com", "https://claude.ai"],
    )
    return mcp.streamable_http_app(
        streamable_http_path=f"/{TOKEN}/mcp",
        stateless_http=True,
        json_response=True,
        max_request_body_size=40 * 1024 * 1024,
        transport_security=seguridad,
        host="0.0.0.0",
    )


def main() -> None:
    import uvicorn

    port = int(os.environ.get("PORT", "8000"))
    print(f"[pincel-ia] Conector MCP: {URL_PUBLICA}/{TOKEN}/mcp", file=sys.stderr)
    print(f"[pincel-ia] Panel:        {URL_PUBLICA}/{TOKEN}/panel", file=sys.stderr)
    uvicorn.run(crear_app(), host="0.0.0.0", port=port, proxy_headers=True, forwarded_allow_ips="*")


if __name__ == "__main__":
    main()
