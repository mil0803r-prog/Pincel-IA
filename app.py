"""Punto de entrada para Vercel: expone la aplicación ASGI de Pincel IA como `app`.

Sirve todo desde aquí: la interfaz ya compilada (pincel_ia/static), la API, las imágenes y el conector MCP.
"""

from pincel_ia.server import AppVercel

app = AppVercel()
