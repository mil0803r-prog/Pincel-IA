"""API de la sección Landing."""

from __future__ import annotations

import asyncio

from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from starlette.routing import Route

from . import auth, config, db, landing


def _error(e: Exception) -> JSONResponse:
    if isinstance(e, db.NoEncontrado):
        return JSONResponse({"error": str(e)}, status_code=404)
    if isinstance(e, (db.Invalido, ValueError)):
        return JSONResponse({"error": str(e)}, status_code=400)
    raise e


async def _json(request: Request) -> dict:
    try:
        datos = await request.json()
    except Exception:
        raise db.Invalido("Solicitud inválida.")
    if not isinstance(datos, dict):
        raise db.Invalido("Solicitud inválida.")
    return datos


@auth.requiere_sesion
async def mercado(request: Request) -> Response:
    try:
        if request.method == "GET":
            return JSONResponse(await asyncio.to_thread(landing.obtener_mercado))
        return JSONResponse(await asyncio.to_thread(landing.guardar_mercado, await _json(request)))
    except Exception as e:
        return _error(e)


@auth.requiere_sesion
async def landings(request: Request) -> Response:
    try:
        if request.method == "GET":
            return JSONResponse(await asyncio.to_thread(landing.listar_landings))
        d = await _json(request)
        l = await asyncio.to_thread(landing.crear_landing, str(d.get("nombre", "")), str(d.get("url", "")), str(d.get("notas", "")))
        return JSONResponse(l, status_code=201)
    except Exception as e:
        return _error(e)


@auth.requiere_sesion
async def una_landing(request: Request) -> Response:
    lid = request.path_params["lid"]
    try:
        if request.method == "GET":
            return JSONResponse(await asyncio.to_thread(landing.obtener_landing, lid))
        if request.method == "DELETE":
            await asyncio.to_thread(landing.eliminar_landing, lid)
            return JSONResponse({"ok": True})
        return JSONResponse(await asyncio.to_thread(landing.actualizar_landing, lid, await _json(request)))
    except Exception as e:
        return _error(e)


@auth.requiere_sesion
async def importar(request: Request) -> Response:
    try:
        d = await _json(request)
        r = await asyncio.to_thread(landing.importar_desde_url, request.path_params["lid"], str(d.get("url", "")), bool(d.get("reemplazar")))
        return JSONResponse(r)
    except Exception as e:
        return _error(e)


@auth.requiere_sesion
async def subir_originales(request: Request) -> Response:
    lid = request.path_params["lid"]
    try:
        form = await request.form(max_files=1000, max_part_size=config.MAX_BYTES)
        lista = form.getlist("archivo")
        if not lista:
            raise db.Invalido("No llegó ningún archivo.")
        items = [(await f.read(), getattr(f, "filename", "") or "") for f in lista]
        return JSONResponse(await asyncio.to_thread(landing.agregar_originales, lid, items))
    except Exception as e:
        return _error(e)


@auth.requiere_sesion
async def una_imagen(request: Request) -> Response:
    lid, n = request.path_params["lid"], int(request.path_params["n"])
    try:
        if request.method == "DELETE":
            return JSONResponse(await asyncio.to_thread(landing.quitar_imagen, lid, n))
        return JSONResponse(await asyncio.to_thread(landing.actualizar_imagen, lid, n, await _json(request)))
    except Exception as e:
        return _error(e)


@auth.requiere_sesion
async def la_final(request: Request) -> Response:
    lid, n = request.path_params["lid"], int(request.path_params["n"])
    try:
        if request.method == "DELETE":
            return JSONResponse(await asyncio.to_thread(landing.quitar_final, lid, n))
        form = await request.form(max_files=1, max_part_size=config.MAX_BYTES)
        f = form.get("archivo")
        if f is None or not hasattr(f, "read"):
            raise db.Invalido("No llegó ningún archivo.")
        return JSONResponse(await asyncio.to_thread(landing.guardar_final, lid, n, await f.read(), "app"))
    except Exception as e:
        return _error(e)


@auth.requiere_sesion
async def el_paquete(request: Request) -> Response:
    try:
        return JSONResponse(await asyncio.to_thread(landing.paquete, request.path_params["lid"]))
    except Exception as e:
        return _error(e)


rutas = [
    Route("/api/mercado", mercado, methods=["GET", "PUT"]),
    Route("/api/landings", landings, methods=["GET", "POST"]),
    Route("/api/landings/{lid}", una_landing, methods=["GET", "PATCH", "DELETE"]),
    Route("/api/landings/{lid}/importar", importar, methods=["POST"]),
    Route("/api/landings/{lid}/imagenes", subir_originales, methods=["POST"]),
    Route("/api/landings/{lid}/imagenes/{n:int}", una_imagen, methods=["PATCH", "DELETE"]),
    Route("/api/landings/{lid}/imagenes/{n:int}/final", la_final, methods=["POST", "DELETE"]),
    Route("/api/landings/{lid}/paquete", el_paquete, methods=["GET"]),
]
