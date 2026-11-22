# Pincel IA 🎨

**Tu estudio de imágenes para vender más.** Pincel IA conecta **Claude**, que escribe los prompts con tu skill de ventas para WhatsApp y Chatea Pro, con **ChatGPT**, que crea las imágenes con tu suscripción. Todo queda organizado en una app web profesional.

```
1. Claude (skill de ventas) ──crear_campana──►  PINCEL IA
2. ChatGPT ◄──obtener_prompts── "Trae la campaña crema black friday y crea las imágenes"
3. ChatGPT crea las imágenes
4. "Enviar a la plataforma" ──subir_imagen──►  PINCEL IA  (o las arrastras a la campaña)
5. En la app: links públicos, ZIP, biblioteca… listas para Chatea Pro
```

## La app

| Sección | Para qué |
|---|---|
| **Inicio** | Resumen: campañas, imágenes, pendientes, actividad de la semana y campañas recientes. |
| **Campañas** | Cada promoción con sus prompts e imágenes. Arrastra imágenes (todas juntas o una por tarjeta), reemplaza, edita prompts, copia links públicos, descarga ZIP y copia la frase para ChatGPT. Se actualiza sola mientras ChatGPT envía imágenes. |
| **Biblioteca** | Todas tus imágenes en un solo lugar, con filtro por campaña y visor a pantalla completa. |
| **Conexiones** | La URL del conector, cómo conectarlo a ChatGPT y Claude, y frases listas para copiar. |

Tiene inicio de sesión con contraseña, modo claro y oscuro, y funciona en el celular.

### Agregar módulos nuevos
La app está pensada para crecer:
1. **Interfaz:** crea la página en `web/src/pages/`, añádela al menú en `web/src/components/Layout.tsx` (lista `GRUPOS`) y registra la ruta en `web/src/App.tsx`.
2. **Datos y API:** añade tablas en `pincel_ia/db.py` y rutas en `pincel_ia/api.py`.
3. **Herramientas para ChatGPT y Claude:** añádelas en `pincel_ia/conector.py`.

## Lo que tienes que saber
- **ChatGPT crea las imágenes una por una.** Si se detiene a mitad, dile "continúa". Tu plan tiene un límite de imágenes por periodo.
- **El envío automático desde ChatGPT puede fallar.** Depende de cómo ChatGPT maneje los archivos, y eso cambia seguido. Si no puede, te da el link de la campaña: descargas las imágenes y las arrastras todas juntas.
- **Necesitas ChatGPT Plus, Pro, Business o Enterprise** con el **modo desarrollador** activado para agregar el conector.

## 1. Publicarla (una sola vez)

ChatGPT solo se conecta a servidores en internet con HTTPS.

**Render (recomendado):**
1. Crea una cuenta en render.com y conecta tu GitHub.
2. *New → Blueprint* → elige este repositorio. Render lee `render.yaml` y te pide:
   - `PINCEL_CLAVE`: la contraseña para entrar a la app.
   - `PINCEL_URL_PUBLICA`: déjalo vacío por ahora.
3. Cuando termine, copia la URL (ej. `https://pincel-ia.onrender.com`). Ve a *Environment*, pégala en `PINCEL_URL_PUBLICA` y guarda.
4. Entra a esa URL con tu contraseña. En **Conexiones** está la URL del conector.

> Usa el plan *Starter*, que incluye disco para guardar las imágenes. En el plan gratis se borran al reiniciar.

**Otra opción:** cualquier hosting con Docker (Railway, Fly.io, un VPS). Usa el `Dockerfile`, monta un volumen en `/datos` y define las variables de `.env.example`.

## 2. Conectar ChatGPT y Claude
Los pasos están dentro de la app, en **Conexiones**. En resumen:
- **ChatGPT:** Configuración → Aplicaciones y conectores → Configuración avanzada → **Modo desarrollador** → Crear conector con la URL, sin autenticación.
- **claude.ai / Claude Desktop:** Configuración → Conectores → Agregar conector personalizado.
- **Claude Code:** `claude mcp add --transport http pincel-ia <URL del conector>`

## Herramientas del conector

| Herramienta | Quién la usa | Qué hace |
|---|---|---|
| `crear_campana` | Claude | Guarda nombre + todos los prompts (+ notas de estilo). |
| `obtener_prompts` | ChatGPT | Trae los prompts con instrucciones para crearlos tal cual, en orden. |
| `subir_imagen` | ChatGPT | Envía una imagen creada a su número en la campaña. |
| `obtener_imagenes` | Claude | Links públicos de las imágenes y cuáles faltan. |
| `listar_campanas` | Ambos | Últimas campañas y su avance. |

## Desarrollo local
```bash
# Backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
PINCEL_CLAVE=prueba PINCEL_TOKEN=prueba .venv/bin/python -m pincel_ia.server   # http://localhost:8000

# Interfaz (en otra terminal, con recarga en vivo en http://localhost:5173)
cd web && npm install && npm run dev
# Para servirla desde el backend: npm run build (genera pincel_ia/static)
```

## Estructura
```
pincel_ia/            Servidor (Python)
  server.py           Arranque: une app, API y conector
  conector.py         Herramientas MCP para ChatGPT y Claude
  api.py              API de la app web
  db.py               Base de datos (SQLite)
  archivos.py         Imágenes y miniaturas
  auth.py             Inicio de sesión
web/                  Interfaz (React + TypeScript + Vite)
  src/pages/          Inicio, Campañas, Campaña, Biblioteca, Conexiones, Login
  src/components/     Menú, visor, tarjetas, ventanas, avisos
```
