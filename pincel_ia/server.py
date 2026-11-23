"""Arranque de Pincel IA: une la app web, la API y el conector MCP en un solo servidor."""

from __future__ import annotations

import asyncio
import sys
from html import escape
from urllib.parse import urlparse

from mcp.server.transport_security import TransportSecuritySettings
from starlette.requests import Request
from starlette.responses import FileResponse, HTMLResponse, JSONResponse, Response
from starlette.applications import Starlette
from starlette.routing import Mount, Route
from starlette.staticfiles import StaticFiles

from . import api, config, db
from .conector import mcp

SIN_FRONTEND = """<!doctype html><meta charset=utf-8><title>Pincel IA</title>
<body style="font-family:system-ui;padding:40px"><h1>Pincel IA</h1>
<p>Falta compilar la interfaz: <code>npm install && npm run build</code></p>"""


async def spa(request: Request) -> Response:
    """Sirve la interfaz (React) para cualquier ruta que no sea API, imágenes o conector."""
    ruta = request.url.path
    if ruta.startswith(("/api/", "/i/")):
        return JSONResponse({"error": "No encontrado."}, status_code=404)
    # archivos sueltos de la raíz del build (favicon, manifest...)
    nombre = ruta.lstrip("/")
    if nombre and "/" not in nombre and "." in nombre:
        f = config.ESTATICOS / nombre
        if f.is_file():
            return FileResponse(f)
    index = config.ESTATICOS / "index.html"
    if not index.is_file():
        return HTMLResponse(SIN_FRONTEND)
    return FileResponse(index, headers={"Cache-Control": "no-cache"})


def _seguridad_mcp() -> TransportSecuritySettings:
    if config.VERCEL:
        # Protección contra DNS rebinding: solo tiene sentido en servidores locales. En Vercel el dominio es público
        # y el acceso lo protege la clave secreta que forma parte de la URL del conector.
        return TransportSecuritySettings(enable_dns_rebinding_protection=False)
    host_publico = urlparse(config.URL_PUBLICA).netloc
    return TransportSecuritySettings(
        enable_dns_rebinding_protection=True,
        allowed_hosts=[host_publico, "localhost", "localhost:*", "127.0.0.1", "127.0.0.1:*"],
        allowed_origins=[config.URL_PUBLICA, "https://chatgpt.com", "https://chat.openai.com", "https://claude.ai"],
    )


_TOOLS_CHATGPT = {"obtener_prompts", "subir_imagen"}
_TOOLS_CLAUDE = {"crear_campana", "agregar_prompts", "obtener_imagenes", "listar_campanas"}


def _clasificar(nombre_cliente: str, user_agent: str, herramientas: set[str], pistas: str = "") -> str:
    """Decide quién llama. `pistas` es todo el texto de la petición (cabeceras y cuerpo) en minúsculas."""
    texto = f"{nombre_cliente} {user_agent}".lower()
    if any(k in texto for k in ("openai", "chatgpt")) or "openai" in pistas:
        return "chatgpt"
    if any(k in texto for k in ("claude", "anthropic")) or "anthropic" in pistas:
        return "claude"
    if herramientas & _TOOLS_CHATGPT and not herramientas & _TOOLS_CLAUDE:
        return "chatgpt"  # un cliente sin identificar que usa las herramientas de ChatGPT
    if herramientas & _TOOLS_CLAUDE and not herramientas & _TOOLS_CHATGPT:
        return "claude"
    return "otro"


def _registrar_contacto(scope, cuerpo: bytes) -> None:
    try:
        import json

        cabeceras = [(k.decode("latin-1").lower(), v.decode("latin-1")) for k, v in scope.get("headers", [])]
        agente = next((v for k, v in cabeceras if k == "user-agent"), "")
        pistas = " ".join(f"{k} {v}" for k, v in cabeceras if k not in ("authorization", "cookie")).lower()
        nombre, herramientas, metodos = "", set(), []
        try:
            datos = json.loads(cuerpo) if cuerpo else None
        except ValueError:
            datos = None
        for m in (datos if isinstance(datos, list) else [datos]):
            if not isinstance(m, dict):
                continue
            metodos.append(str(m.get("method", "")))
            if m.get("method") == "initialize":
                nombre = str(((m.get("params") or {}).get("clientInfo") or {}).get("name", ""))
            elif m.get("method") == "tools/call":
                herramientas.add(str((m.get("params") or {}).get("name", "")))
        pistas += " " + cuerpo[:20000].decode("utf-8", "ignore").lower()
        cliente = _clasificar(nombre, agente, herramientas, pistas)
        db.registrar_contacto(cliente, nombre or agente, scope.get("method", ""), agente, ",".join(metodos))
    except Exception:
        pass  # llevar la cuenta nunca debe afectar al conector


class RegistroContacto:
    """Envuelve el conector MCP y anota cada comunicación para mostrar 'Conectado' y avisar 'se conectó'.

    Se anota ANTES de responder: en hostings tipo Vercel el proceso puede congelarse en cuanto se envía la respuesta."""

    def __init__(self, app) -> None:
        self.app = app

    async def __call__(self, scope, receive, send) -> None:
        ruta = f"/{config.TOKEN}/mcp"
        if scope["type"] != "http" or scope["path"].rstrip("/") != ruta:
            return await self.app(scope, receive, send)
        if scope["path"] != ruta:  # tolera la barra final: /clave/mcp/
            scope = {**scope, "path": ruta, "raw_path": ruta.encode()}
        mensajes: list = []
        cuerpo = b""
        if scope["method"] == "POST":
            while True:
                m = await receive()
                mensajes.append(m)
                if m["type"] != "http.request":
                    break
                cuerpo += m.get("body", b"")
                if not m.get("more_body") or len(cuerpo) > 4_000_000:
                    break
        await asyncio.to_thread(_registrar_contacto, scope, cuerpo[:65536])
        pendientes = iter(mensajes)

        async def repetir():
            try:
                return next(pendientes)
            except StopIteration:
                return await receive()

        await self.app(scope, repetir, send)


def _app_mcp():
    return mcp.streamable_http_app(
        streamable_http_path=f"/{config.TOKEN}/mcp",
        stateless_http=True,
        json_response=True,
        max_request_body_size=40 * 1024 * 1024,
        transport_security=_seguridad_mcp(),
        host="0.0.0.0",
    )


def crear_app():
    """Servidor normal (local, Render, Docker): un solo proceso con todo incluido."""
    db.iniciar()
    app = _app_mcp()
    rutas = list(api.rutas)
    if (config.ESTATICOS / "assets").is_dir():
        rutas.append(Mount("/assets", StaticFiles(directory=config.ESTATICOS / "assets"), name="assets"))
    app.router.routes[0:0] = rutas                       # antes que el conector
    app.router.routes.append(Route("/{ruta:path}", spa, methods=["GET"]))  # después de todo
    return RegistroContacto(app)


PAGINA_CONFIG = """<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">
<title>Pincel IA · falta configurar</title>
<body style="font-family:system-ui;max-width:560px;margin:12vh auto;padding:0 20px;line-height:1.55;color:#222">
<h1 style="margin:0 0 8px">Casi listo</h1>
<p>Pincel IA ya está publicado, pero faltan estas variables de entorno en Vercel
(<b>Settings → Environment Variables</b>):</p><ul>{lista}</ul>
<p>Después de agregarlas, haz un <b>Redeploy</b> desde la pestaña Deployments.</p></body>"""


class AppVercel:
    """Aplicación ASGI para Vercel (funciones sin estado).

    No depende de eventos de arranque: la base se prepara en la primera petición y el conector MCP
    se construye en cada petición (es barato y evita estado compartido entre invocaciones)."""

    def __init__(self) -> None:
        rutas = list(api.rutas)
        if (config.ESTATICOS / "assets").is_dir():  # en Vercel los sirve su red de contenido; aquí por si acaso
            rutas.append(Mount("/assets", StaticFiles(directory=config.ESTATICOS / "assets"), name="assets"))
        rutas.append(Route("/{ruta:path}", spa, methods=["GET"]))
        self.web = Starlette(routes=rutas)
        self.lista = False

    async def _preparar(self) -> None:
        if self.lista:
            return
        await asyncio.to_thread(db.iniciar)
        self.lista = True

    async def __call__(self, scope, receive, send) -> None:
        if scope["type"] == "lifespan":
            while True:
                msg = await receive()
                if msg["type"] == "lifespan.startup":
                    await send({"type": "lifespan.startup.complete"})
                elif msg["type"] == "lifespan.shutdown":
                    await send({"type": "lifespan.shutdown.complete"})
                    return
        if scope["type"] != "http":
            return
        if config.FALTAN:
            if scope["path"].startswith("/api/"):  # la interfaz muestra este texto en la pantalla de entrada
                aviso = "Falta configurar en Vercel: " + ", ".join(config.FALTAN) + ". Luego haz Redeploy."
                await JSONResponse({"error": aviso}, status_code=503)(scope, receive, send)
                return
            lista = "".join(f"<li><code>{escape(v)}</code></li>" for v in config.FALTAN)
            await HTMLResponse(PAGINA_CONFIG.format(lista=lista), status_code=503)(scope, receive, send)
            return
        try:
            await self._preparar()
        except Exception as e:  # base de datos inalcanzable: mensaje claro en vez de un error genérico
            print(f"[pincel-ia] No se pudo preparar la base de datos: {e!r}", file=sys.stderr)
            await JSONResponse({"error": "No se pudo conectar con la base de datos."}, status_code=503)(scope, receive, send)
            return
        if scope["path"].rstrip("/") == f"/{config.TOKEN}/mcp":
            app = _app_mcp()
            async with app.router.lifespan_context(app):
                await RegistroContacto(app)(scope, receive, send)
            return
        await self.web(scope, receive, send)


def main() -> None:
    import uvicorn

    print(f"[pincel-ia] App:          {config.URL_PUBLICA}", file=sys.stderr)
    print(f"[pincel-ia] Conector MCP: {config.URL_MCP}", file=sys.stderr)
    uvicorn.run(crear_app(), host="0.0.0.0", port=config.PORT, proxy_headers=True, forwarded_allow_ips="*")


if __name__ == "__main__":
    main()
