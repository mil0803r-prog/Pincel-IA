"""Punto de entrada para Vercel: expone la aplicación ASGI de Pincel IA como `app`."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pincel_ia.server import AppVercel  # noqa: E402

app = AppVercel()
