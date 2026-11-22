"""Arranque de Pincel IA: une la app web, la API y el conector MCP en un solo servidor."""

from __future__ import annotations

import sys
from urllib.parse import urlparse

from mcp.server.transport_security import TransportSecuritySettings
from starlette.requests import Request
from starlette.responses import FileResponse, HTMLResponse, JSONResponse, Response
from starlette.routing import Mount, Route
from starlette.staticfiles import StaticFiles

from . import api, config, db
from .conector import mcp

SIN_FRONTEND = """<!doctype html><meta charset=utf-8><title>Pincel IA</title>
<body style="font-family:system-ui;padding:40px"><h1>Pincel IA</h1>
<p>Falta compilar la interfaz: <code>cd web && npm install && npm run build</code></p>"""


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


def crear_app():
    db.iniciar()
    host_publico = urlparse(config.URL_PUBLICA).netloc
    seguridad = TransportSecuritySettings(
        enable_dns_rebinding_protection=True,
        allowed_hosts=[host_publico, "localhost", "localhost:*", "127.0.0.1", "127.0.0.1:*"],
        allowed_origins=[config.URL_PUBLICA, "https://chatgpt.com", "https://chat.openai.com", "https://claude.ai"],
    )
    app = mcp.streamable_http_app(
        streamable_http_path=f"/{config.TOKEN}/mcp",
        stateless_http=True,
        json_response=True,
        max_request_body_size=40 * 1024 * 1024,
        transport_security=seguridad,
        host="0.0.0.0",
    )
    rutas = list(api.rutas)
    if (config.ESTATICOS / "assets").is_dir():
        rutas.append(Mount("/assets", StaticFiles(directory=config.ESTATICOS / "assets"), name="assets"))
    app.router.routes[0:0] = rutas                       # antes que el conector
    app.router.routes.append(Route("/{ruta:path}", spa, methods=["GET"]))  # después de todo
    return app


def main() -> None:
    import uvicorn

    print(f"[pincel-ia] App:          {config.URL_PUBLICA}", file=sys.stderr)
    print(f"[pincel-ia] Conector MCP: {config.URL_MCP}", file=sys.stderr)
    uvicorn.run(crear_app(), host="0.0.0.0", port=config.PORT, proxy_headers=True, forwarded_allow_ips="*")


if __name__ == "__main__":
    main()
