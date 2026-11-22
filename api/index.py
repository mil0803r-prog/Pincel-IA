"""Servidor de Pincel IA para Vercel: expone la aplicación ASGI como `app`.

Vercel enruta aquí la API (/api), las imágenes (/i) y el conector de ChatGPT y Claude (/<clave>/mcp).
La interfaz (carpeta dist) la sirve la red de Vercel.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pincel_ia.server import AppVercel  # noqa: E402

app = AppVercel()
