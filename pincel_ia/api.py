"""API JSON que usa la interfaz web de Pincel IA."""

from __future__ import annotations

import asyncio
import io
import re
import zipfile

from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from starlette.routing import Route

from . import archivos, auth, config, db


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


def separar_prompts(texto: str) -> list[str]:
    """Separa un bloque de texto en prompts: por líneas en blanco, o por líneas numeradas."""
    texto = texto.replace("\r\n", "\n").strip()
    if not texto:
        return []
    bloques = [b.strip() for b in re.split(r"\n\s*\n", texto) if b.strip()]
    if len(bloques) == 1:
        lineas = [l.strip() for l in texto.split("\n") if l.strip()]
        if len(lineas) > 1:
            bloques = lineas
    limpios = []
    for b in bloques:
        b = re.sub(r"^\s*(?:prompt\s*)?(?:imagen\s*)?#?\d+\s*[\.\):\-–]\s*", "", b, flags=re.I)
        if b:
            limpios.append(b)
    return limpios


# ---------------------------------------------------------------- sesión

async def login(request: Request) -> Response:
    try:
        datos = await _json(request)
    except db.Invalido as e:
        return _error(e)
    if not auth.clave_correcta(str(datos.get("clave", ""))):
        await auth.pausa_fallo()
        return JSONResponse({"error": "Contraseña incorrecta."}, status_code=401)
    resp = JSONResponse({"ok": True})
    auth.iniciar_sesion(resp)
    return resp


async def logout(_: Request) -> Response:
    resp = JSONResponse({"ok": True})
    auth.cerrar_sesion(resp)
    return resp


async def sesion(request: Request) -> Response:
    return JSONResponse({"autenticado": auth.autenticado(request), "limite_subida": config.LIMITE_SUBIDA})


# ---------------------------------------------------------------- datos

@auth.requiere_sesion
async def resumen(_: Request) -> Response:
    return JSONResponse(await asyncio.to_thread(db.resumen_general))


@auth.requiere_sesion
async def conexion(_: Request) -> Response:
    contacto = await asyncio.to_thread(db.ultimo_contacto)
    registro = await asyncio.to_thread(db.listar_registro)
    return JSONResponse({"url_mcp": config.URL_MCP, "url_publica": config.URL_PUBLICA, "ultimo_contacto": contacto, "registro": registro})


@auth.requiere_sesion
async def notificaciones(_: Request) -> Response:
    return JSONResponse(await asyncio.to_thread(db.listar_notificaciones))


@auth.requiere_sesion
async def leer_notificaciones(request: Request) -> Response:
    try:
        datos = await _json(request)
        ids = None if datos.get("todas") else [str(i) for i in (datos.get("ids") or [])]
        return JSONResponse(await asyncio.to_thread(db.marcar_leidas, ids))
    except Exception as e:
        return _error(e)


@auth.requiere_sesion
async def campanas(request: Request) -> Response:
    try:
        if request.method == "GET":
            buscar = request.query_params.get("q", "")
            return JSONResponse(await asyncio.to_thread(db.listar_campanas, buscar))
        datos = await _json(request)
        prompts = datos.get("prompts")
        if isinstance(prompts, str):
            prompts = separar_prompts(prompts)
        c = await asyncio.to_thread(
            db.crear_campana, str(datos.get("nombre", "")), list(prompts or []), str(datos.get("notas", "")), "app"
        )
        return JSONResponse(c, status_code=201)
    except Exception as e:
        return _error(e)


@auth.requiere_sesion
async def campana(request: Request) -> Response:
    cid = request.path_params["cid"]
    try:
        if request.method == "GET":
            return JSONResponse(await asyncio.to_thread(db.obtener_campana, cid))
        if request.method == "DELETE":
            await asyncio.to_thread(db.eliminar_campana, cid)
            return JSONResponse({"ok": True})
        datos = await _json(request)
        c = await asyncio.to_thread(db.actualizar_campana, cid, datos.get("nombre"), datos.get("notas"))
        return JSONResponse(c)
    except Exception as e:
        return _error(e)


@auth.requiere_sesion
async def agregar_prompts(request: Request) -> Response:
    try:
        datos = await _json(request)
        prompts = datos.get("prompts")
        if isinstance(prompts, str):
            prompts = separar_prompts(prompts)
        c = await asyncio.to_thread(db.agregar_prompts, request.path_params["cid"], list(prompts or []))
        return JSONResponse(c)
    except Exception as e:
        return _error(e)


@auth.requiere_sesion
async def prompt(request: Request) -> Response:
    try:
        datos = await _json(request)
        c = await asyncio.to_thread(
            db.actualizar_prompt, request.path_params["cid"], int(request.path_params["n"]), str(datos.get("texto", ""))
        )
        return JSONResponse(c)
    except Exception as e:
        return _error(e)


@auth.requiere_sesion
async def subir(request: Request) -> Response:
    cid = request.path_params["cid"]
    try:
        form = await request.form(max_files=1000, max_part_size=config.MAX_BYTES)
        n = form.get("n")
        lista = form.getlist("archivo")
        if not lista:
            raise db.Invalido("No llegó ningún archivo.")
        subidas, errores = [], []
        for i, f in enumerate(lista):
            datos = await f.read()
            try:
                img = await asyncio.to_thread(db.guardar_imagen, cid, int(n) + i if n else None, datos, "app")
                subidas.append(img)
            except (db.Invalido, ValueError) as e:
                errores.append({"archivo": getattr(f, "filename", ""), "error": str(e)})
        return JSONResponse({"subidas": len(subidas), "errores": errores},
                            status_code=200 if subidas or not errores else 400)
    except Exception as e:
        return _error(e)


@auth.requiere_sesion
async def subir_referencia(request: Request) -> Response:
    cid = request.path_params["cid"]
    try:
        form = await request.form(max_files=6, max_part_size=config.MAX_BYTES)
        lista = form.getlist("archivo")
        if not lista:
            raise db.Invalido("No llegó ningún archivo.")
        for f in lista:
            await asyncio.to_thread(db.agregar_referencia, cid, await f.read())
        return JSONResponse(await asyncio.to_thread(db.obtener_campana, cid))
    except Exception as e:
        return _error(e)


@auth.requiere_sesion
async def quitar_referencia(request: Request) -> Response:
    try:
        c = await asyncio.to_thread(db.quitar_referencia, request.path_params["cid"], request.path_params["rid"])
        return JSONResponse(c)
    except Exception as e:
        return _error(e)


@auth.requiere_sesion
async def quitar_imagen(request: Request) -> Response:
    try:
        c = await asyncio.to_thread(db.quitar_imagen, request.path_params["cid"], int(request.path_params["n"]))
        return JSONResponse(c)
    except Exception as e:
        return _error(e)


@auth.requiere_sesion
async def imagenes(request: Request) -> Response:
    cid = request.query_params.get("campana") or None
    try:
        desde = max(0, int(request.query_params.get("desde", 0)))
        limite = min(200, max(1, int(request.query_params.get("limite", 60))))
    except ValueError:
        return _error(db.Invalido("Parámetros inválidos."))
    lista = await asyncio.to_thread(db.listar_imagenes, cid, limite, desde)
    total = await asyncio.to_thread(db.contar_imagenes, cid)
    return JSONResponse({"imagenes": lista, "total": total, "siguiente": desde + len(lista) if desde + len(lista) < total else None})


@auth.requiere_sesion
async def zip_campana(request: Request) -> Response:
    try:
        c = await asyncio.to_thread(db.obtener_campana, request.path_params["cid"])
    except Exception as e:
        return _error(e)

    def armar() -> bytes:
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_STORED) as z:
            for p in c["prompts"]:
                if p["imagen"]:
                    nombre = p["imagen"]["ruta"].rsplit("/", 1)[-1]
                    leido = archivos.leer_original(nombre)
                    if leido:
                        z.writestr(f"{p['n']:02d}.{nombre.rsplit('.', 1)[-1]}", leido[0])
            z.writestr("prompts.txt", "\n\n".join(f"#{p['n']}\n{p['texto']}" for p in c["prompts"]))
        return buf.getvalue()

    nombre = re.sub(r"[^a-zA-Z0-9]+", "-", c["nombre"]).strip("-") or "campana"
    return Response(await asyncio.to_thread(armar), media_type="application/zip",
                    headers={"Content-Disposition": f'attachment; filename="{nombre}.zip"'})


# ---------------------------------------------------------------- archivos públicos

CACHE = {"Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable"}


def _archivo(leido) -> Response:
    if not leido:
        return Response(status_code=404)
    datos, tipo = leido
    return Response(datos, media_type=tipo, headers=CACHE)


async def imagen_publica(request: Request) -> Response:
    return _archivo(await asyncio.to_thread(archivos.leer_original, request.path_params["archivo"]))


async def miniatura_publica(request: Request) -> Response:
    return _archivo(await asyncio.to_thread(archivos.leer_miniatura, request.path_params["archivo"]))


rutas = [
    Route("/api/sesion", sesion, methods=["GET"]),
    Route("/api/login", login, methods=["POST"]),
    Route("/api/logout", logout, methods=["POST"]),
    Route("/api/resumen", resumen, methods=["GET"]),
    Route("/api/conexion", conexion, methods=["GET"]),
    Route("/api/notificaciones", notificaciones, methods=["GET"]),
    Route("/api/notificaciones/leer", leer_notificaciones, methods=["POST"]),
    Route("/api/campanas", campanas, methods=["GET", "POST"]),
    Route("/api/campanas/{cid}", campana, methods=["GET", "PATCH", "DELETE"]),
    Route("/api/campanas/{cid}/prompts", agregar_prompts, methods=["POST"]),
    Route("/api/campanas/{cid}/prompts/{n:int}", prompt, methods=["PATCH"]),
    Route("/api/campanas/{cid}/imagenes", subir, methods=["POST"]),
    Route("/api/campanas/{cid}/prompts/{n:int}/imagen", quitar_imagen, methods=["DELETE"]),
    Route("/api/campanas/{cid}/zip", zip_campana, methods=["GET"]),
    Route("/api/campanas/{cid}/referencias", subir_referencia, methods=["POST"]),
    Route("/api/campanas/{cid}/referencias/{rid}", quitar_referencia, methods=["DELETE"]),
    Route("/api/imagenes", imagenes, methods=["GET"]),
    Route("/i/t/{archivo}", miniatura_publica, methods=["GET"]),
    Route("/i/{archivo}", imagen_publica, methods=["GET"]),
]


from . import api_landing  # noqa: E402  (las rutas de la sección Landing)

rutas += api_landing.rutas
