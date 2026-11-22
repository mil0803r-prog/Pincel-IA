# Pincel IA 🎨

Puente entre **Claude** y la **API de imágenes de OpenAI** (los mismos modelos que usa ChatGPT para crear imágenes).

Tu skill de ventas por WhatsApp (Chatea Pro) escribe los prompts → Claude se los manda **todos juntos** a Pincel IA → Pincel IA genera las imágenes **en paralelo** → quedan guardadas en una carpeta, con una galería `index.html` para verlas y descargarlas.

```
Skill de ventas ──► Claude ──(MCP)──► Pincel IA ──(API)──► OpenAI gpt-image
                                          │
                                          └──► imagenes/20261122-1310-crema-facial/
                                                 01-....png … 07-....png
                                                 index.html  (galería)
                                                 lote.json   (prompts + resultados)
```

## Importante: API ≠ suscripción de ChatGPT

- Se usa la **API de OpenAI** (platform.openai.com), no la app de ChatGPT. La suscripción ChatGPT Plus **no incluye** créditos de API: se paga aparte, por imagen.
- Las imágenes **no aparecen en tu historial de ChatGPT**; quedan en tu carpeta `imagenes/`.
- Para pruebas baratas usa `calidad: "low"`; para la pieza final, `"high"`.

## Instalación

```bash
git clone <este repo> && cd Pincel-IA
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt     # Windows: .venv\Scripts\pip install -r requirements.txt
```

Crea tu clave en https://platform.openai.com/api-keys (y carga saldo en Billing).

## Conectarlo a Claude

### Claude Desktop
Edita `claude_desktop_config.json` (Configuración → Desarrollador → Editar configuración):

```json
{
  "mcpServers": {
    "pincel-ia": {
      "command": "/RUTA/A/Pincel-IA/.venv/bin/python",
      "args": ["-m", "pincel_ia.server"],
      "cwd": "/RUTA/A/Pincel-IA",
      "env": {
        "OPENAI_API_KEY": "sk-...",
        "PINCEL_CARPETA": "/RUTA/DONDE/QUIERES/LAS/IMAGENES"
      }
    }
  }
}
```
En Windows: `"command": "C:\\RUTA\\Pincel-IA\\.venv\\Scripts\\python.exe"`. Reinicia Claude Desktop.

### Claude Code
```bash
claude mcp add pincel-ia \
  -e OPENAI_API_KEY=sk-... -e PINCEL_CARPETA=$PWD/imagenes \
  -- /RUTA/A/Pincel-IA/.venv/bin/python -m pincel_ia.server
```

## Uso

Dile a Claude algo como:

> Genera los 7 prompts de imagen de la campaña y mándalos a Pincel IA en vertical, lote "crema-black-friday". Usa la foto `C:\fotos\crema.jpg` como referencia del producto.

### Herramientas que ve Claude

| Herramienta | Qué hace |
|---|---|
| `generar_imagenes` | Recibe la lista de prompts y genera todas a la vez. Opciones: `nombre_lote`, `tamano` (`cuadrado`, `vertical`, `horizontal`), `calidad` (`low`/`medium`/`high`), `formato` (`png`/`jpeg`/`webp`), `imagenes_referencia` (fotos reales del producto o logo para que salgan fieles). |
| `listar_lotes` | Muestra los últimos lotes con sus carpetas y archivos. |

Si una imagen falla (por ejemplo, por moderación), las demás igual se guardan y Claude ve cuál falló y por qué.

## Configuración (variables de entorno)

| Variable | Por defecto | Uso |
|---|---|---|
| `OPENAI_API_KEY` | — | Obligatoria. |
| `PINCEL_MODELO` | `gpt-image-2` | Ej. `gpt-image-1.5`, `gpt-image-1-mini` (más barato). |
| `PINCEL_CARPETA` | `./imagenes` | Dónde se guardan los lotes. |
| `PINCEL_PARALELO` | `4` | Imágenes generadas a la vez (súbelo si tu cuenta tiene límites altos). |

## Próximos pasos posibles
- Subir cada imagen a un almacenamiento en la nube (Cloudinary, S3, Google Drive) y devolver un **link público** para pegarlo directo en los flujos de Chatea Pro.
- Plantillas de estilo de marca (colores, tipografía, logo) que se añadan automáticamente a cada prompt.
