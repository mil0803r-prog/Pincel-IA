"""Servidor MCP de Pincel IA.

Claude (Desktop, Code o cualquier cliente MCP) llama a `generar_imagenes`
con N prompts; el servidor los manda todos a la API de OpenAI a la vez y
devuelve las rutas de las imágenes guardadas.
"""

from __future__ import annotations

from typing import Literal

from mcp.server.mcpserver import MCPServer

from . import generador

mcp = MCPServer(
    "pincel-ia",
    instructions=(
        "Pincel IA genera imágenes profesionales con la API de OpenAI. "
        "Cuando tengas varios prompts de imagen (por ejemplo los de una campaña de ventas por WhatsApp), "
        "mándalos TODOS juntos en una sola llamada a `generar_imagenes`. "
        "Escribe prompts detallados: producto, escenario, iluminación, encuadre, estilo y texto exacto si lleva. "
        "Si el usuario tiene fotos reales del producto, pásalas en `imagenes_referencia` para que salga fiel."
    ),
)


@mcp.tool()
async def generar_imagenes(
    prompts: list[str],
    nombre_lote: str = "lote",
    tamano: Literal["cuadrado", "horizontal", "vertical", "auto"] = "cuadrado",
    calidad: Literal["low", "medium", "high", "auto"] = "high",
    formato: Literal["png", "jpeg", "webp"] = "png",
    imagenes_referencia: list[str] | None = None,
) -> dict:
    """Genera una imagen por cada prompt, todas en paralelo, y las guarda en una carpeta nueva.

    Args:
        prompts: Lista de prompts (uno por imagen). Ej: los 7 prompts de la campaña.
        nombre_lote: Nombre corto para la carpeta (ej. "crema-facial-black-friday").
        tamano: cuadrado (1:1, feed/estado), vertical (2:3, historias/WhatsApp), horizontal (3:2, banners).
        calidad: high para piezas finales; low/medium para bocetos rápidos y baratos.
        formato: png (máxima calidad), jpeg o webp (más livianos para WhatsApp).
        imagenes_referencia: Rutas a fotos reales del producto/logo para mantenerlos fieles.
    """
    lote = await generador.generar_lote(
        prompts,
        nombre_lote=nombre_lote,
        tamano=tamano,
        calidad=calidad,
        formato=formato,
        imagenes_referencia=imagenes_referencia,
    )
    return {
        "lote": lote.nombre,
        "carpeta": lote.carpeta,
        "galeria": f"{lote.carpeta}/index.html",
        "exitosas": lote.exitosas,
        "total": len(lote.resultados),
        "modelo": lote.modelo,
        "resultados": [
            {"n": r.indice, "ok": r.ok, "archivo": r.archivo, "error": r.error} for r in lote.resultados
        ],
    }


@mcp.tool()
def listar_lotes(limite: int = 20) -> list[dict]:
    """Lista los últimos lotes de imágenes generados, con sus carpetas y archivos."""
    return generador.listar_lotes(limite)


def main() -> None:
    mcp.run()


if __name__ == "__main__":
    main()
