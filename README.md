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
1. **Interfaz:** crea la página en `src/pages/`, añádela al menú en `src/components/Layout.tsx` (lista `GRUPOS`) y registra la ruta en `src/App.tsx`.
2. **Datos y API:** añade tablas en `pincel_ia/db.py` y rutas en `pincel_ia/api.py`.
3. **Herramientas para ChatGPT y Claude:** añádelas en `pincel_ia/conector.py`.

## Con el mockup de tu producto
1. **Envía a Claude el mockup** (o la foto real) del producto y pídele la campaña.
2. **Claude lo mira y escribe los prompts** describiendo el producto con detalle (forma, colores, etiqueta, logo) y los guarda en Pincel IA.
3. **El mockup queda como "Producto de referencia" de la campaña.** Claude lo guarda solo si tiene un link a la imagen o trabaja con archivos (Claude Code). En claude.ai, Claude no puede pasar el archivo al conector, así que lo arrastras tú una vez en la sección *Producto de referencia*; Claude te da el link.
4. **ChatGPT recibe el mockup junto con cada lote de prompts** y la instrucción de mantener el producto idéntico en todas las imágenes. Si ChatGPT no lo ve, adjúntale el mockup en el chat una vez.

## Sin límite de imágenes
Una campaña puede tener **cualquier cantidad de prompts e imágenes** (7, 150, 1.000…):
- **Claude** crea la campaña con todos los prompts y puede seguir agregando más con `agregar_prompts`.
- **ChatGPT** trabaja **por lotes**: trae los siguientes prompts pendientes, crea esas imágenes, las envía y pide el siguiente lote, hasta que no falte ninguna. Si quieres que lo haga todo seguido, dile: *"continúa con todos los lotes hasta terminar, enviando cada uno a la plataforma"*.
- **En la app** puedes arrastrar cientos de imágenes de una vez: se suben en tandas y ves el avance. La campaña tiene filtros (Todas / Faltan / Listas) y la biblioteca carga más imágenes a medida que bajas.

## Notificaciones en la plataforma
Pincel IA te avisa solo, sin que tengas que recargar, cuando algo pasa:
- **Claude** crea una campaña o agrega prompts.
- **ChatGPT** recoge un lote de prompts y va enviando imágenes (se agrupan: "ChatGPT envió 6 imágenes · 6/20").
- La **campaña queda completa**, o una imagen **no se pudo recibir** (con el motivo).

Los avisos salen como mensaje emergente, en la **campanita** (arriba a la izquierda, con el número de sin leer), en el título de la pestaña y, si lo activas en el panel, como **aviso del navegador** aunque estés en otra pestaña. En **Conexiones** ves cuándo fue la última actividad de ChatGPT y de Claude, lo que confirma que el conector funciona.

## Lo que tienes que saber
- **ChatGPT crea las imágenes una por una.** Si se detiene a mitad, dile "continúa". Tu plan tiene un límite de imágenes por periodo.
- **El envío automático desde ChatGPT puede fallar.** Depende de cómo ChatGPT maneje los archivos, y eso cambia seguido. Si no puede, te da el link de la campaña: descargas las imágenes y las arrastras todas juntas.
- **Necesitas ChatGPT Plus, Pro, Business o Enterprise** con el **modo desarrollador** activado para agregar el conector.

## 1. Publicarla (una sola vez)

ChatGPT solo se conecta a servidores en internet con HTTPS.

### Opción A: Vercel + Neon (gratis para empezar)
Vercel no guarda archivos en disco, así que Pincel IA usa una base de datos **Postgres (Neon)** donde guarda campañas **e imágenes**. El código lo detecta solo: con `DATABASE_URL` usa Postgres, sin ella usa SQLite.

El repositorio ya tiene el formato estándar de Vercel: la interfaz (Vite) en la raíz y el servidor en `api/index.py`. Se importa como cualquier otra app.

1. En Vercel: **Add New → Project** → elige el repositorio (rama `main`). El preset sale solo como **Vite**.
2. Abre **Environment Variables** y agrega:
   - `PINCEL_CLAVE`: la contraseña para entrar a la app.
   - `PINCEL_TOKEN`: una clave larga y aleatoria (forma parte de la URL del conector; no la compartas).
3. Pulsa **Deploy**. Si olvidas las variables, la app te muestra una página "Casi listo" con lo que falta.
4. En el proyecto, ve a **Storage → Create Database → Neon (Postgres)** y conéctala al proyecto en todos los entornos. Vercel agrega `DATABASE_URL` solo.
5. Ve a **Deployments → ⋯ → Redeploy**. Entra a tu dirección `https://TU-PROYECTO.vercel.app` con tu contraseña.
6. **Importante:** en **Settings → Deployment Protection** desactiva la protección para *Production*. Si está activa, ChatGPT y Claude no pueden llegar al conector.

Límites de Vercel que la app ya maneja:
- **Peticiones de más de 4,5 MB:** el navegador reduce las imágenes pesadas y las reparte en tandas antes de subirlas; si ChatGPT envía una más grande, el servidor la aligera al guardarla.
- **El ZIP** se arma en el navegador, porque el servidor no puede devolver archivos grandes.
- **Espacio:** el plan gratis de Neon da 0,5 GB, suficiente para cientos de imágenes. Si llegas al tope, súbelo de plan o pásate a Render.

### Opción B: Render (con disco)
1. Crea una cuenta en render.com y conecta tu GitHub.
2. *New → Blueprint* → elige este repositorio (rama `main`). Render lee `render.yaml` y te pide:
   - `PINCEL_CLAVE`: la contraseña para entrar a la app.
   - `PINCEL_URL_PUBLICA`: déjalo vacío por ahora.
3. Cuando termine, copia la URL (ej. `https://pincel-ia.onrender.com`). Ve a *Environment*, pégala en `PINCEL_URL_PUBLICA` y guarda.
4. Entra a esa URL con tu contraseña. En **Conexiones** está la URL del conector.

> Usa el plan *Starter*, que incluye disco para guardar las imágenes. En el plan gratis se borran al reiniciar.

**Otra opción:** cualquier hosting con Docker (Railway, Fly.io, un VPS). Usa el `Dockerfile`, monta un volumen en `/datos` y define las variables de `.env.example`.

## 2. Conectar ChatGPT y Claude
Los pasos están dentro de la app, en **Conexiones**. En resumen:
- **ChatGPT:** Configuración → Aplicaciones y conectores → Configuración avanzada → **Modo desarrollador** → Crear conector con la URL. En **Autenticación** elige **Sin autenticación** (no OAuth: la clave ya va dentro de la dirección).
- **claude.ai / Claude Desktop:** Configuración → Conectores → Agregar conector personalizado.
- **Claude Code:** `claude mcp add --transport http pincel-ia <URL del conector>`

## Herramientas del conector

| Herramienta | Quién la usa | Qué hace |
|---|---|---|
| `crear_campana` | Claude | Guarda nombre + todos los prompts (+ notas de estilo y links del mockup en `referencias_url`). Sin límite de cantidad. |
| `agregar_prompts` | Claude | Agrega más prompts al final de una campaña existente. |
| `subir_referencia` | Claude o ChatGPT | Guarda el mockup o foto del producto como referencia de la campaña (hasta 6). |
| `obtener_prompts` | ChatGPT | Trae el siguiente **lote** de prompts pendientes (10 por defecto, hasta 25) con instrucciones; se repite hasta terminar. |
| `subir_imagen` | ChatGPT | Envía una imagen creada a su número en la campaña. |
| `obtener_imagenes` | Claude | Links públicos de las imágenes y cuáles faltan. |
| `listar_campanas` | Ambos | Últimas campañas y su avance. |

## Desarrollo local
```bash
# Backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
PINCEL_CLAVE=prueba PINCEL_TOKEN=prueba .venv/bin/python -m pincel_ia.server   # http://localhost:8000

# Interfaz (en otra terminal, con recarga en vivo en http://localhost:5173)
npm install && npm run dev
# Para servirla desde el backend: npm run build (genera la carpeta dist)
```

## Estructura
```
pincel_ia/            Servidor (Python)
  server.py           Arranque: une app, API y conector
  conector.py         Herramientas MCP para ChatGPT y Claude
  api.py              API de la app web
  db.py               Base de datos (SQLite o Postgres)
  archivos.py         Imágenes y miniaturas (disco o base de datos)
  auth.py             Inicio de sesión
api/index.py          Punto de entrada para Vercel
vercel.json           Rutas de Vercel
src/                  Interfaz (React + TypeScript + Vite)
  pages/              Inicio, Campañas, Campaña, Biblioteca, Conexiones, Login
  components/         Menú, visor, tarjetas, ventanas, avisos
```
