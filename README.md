# Pincel IA 🎨

Lleva los prompts de imagen que escribe **Claude** (tu skill de ventas por WhatsApp para Chatea Pro) a **ChatGPT**. ChatGPT crea las imágenes con tu suscripción, sin pagar API, y las devuelve a una plataforma donde quedan guardadas con link público.

```
1. Claude (skill de ventas) ──crear_campana──►  PINCEL IA  (tu servidor en internet)
2. ChatGPT ◄──obtener_prompts── "Trae la campaña crema black friday"
3. ChatGPT crea las 7 imágenes
4. "Enviar a la plataforma" ──subir_imagen──►  PINCEL IA  ──► link público de cada imagen
                     (o las arrastras al buzón web de la campaña)
5. Claude ◄──obtener_imagenes── links / ZIP para bajarlas a tu carpeta
```

## Lo que tienes que saber
- **ChatGPT crea las imágenes una por una**, no las 7 a la vez. A veces se detiene a mitad: dile "continúa".
- **Tu plan de ChatGPT tiene un límite de imágenes por periodo.**
- **El envío automático desde ChatGPT puede fallar.** Pasar a una herramienta una imagen creada en el chat depende de cómo ChatGPT maneje los archivos, y eso cambia seguido. Si no funciona, ChatGPT te da el link del **buzón**: descargas las imágenes y las arrastras todas juntas. Toma unos segundos.
- **Necesitas ChatGPT Plus, Pro, Business o Enterprise** con el **modo desarrollador** activado para agregar conectores propios.

## 1. Publicar el servidor (una sola vez)

ChatGPT solo se conecta a servidores en internet con HTTPS, no a tu PC.

**Opción Render (recomendada):**
1. Crea una cuenta en render.com y conecta tu GitHub.
2. *New → Blueprint* → elige este repositorio. Render lee `render.yaml`.
3. Cuando termine, copia la URL (ej. `https://pincel-ia.onrender.com`). Ve a *Environment* y pégala en `PINCEL_URL_PUBLICA`. Ahí mismo verás tu `PINCEL_TOKEN` (generado automáticamente).
4. Guarda: se redepliega solo.

> Se usa el plan *Starter* porque incluye disco. En el plan gratis las imágenes se borran cada vez que el servidor se reinicia.

**Otra opción:** cualquier hosting con Docker (Railway, Fly.io, un VPS). Usa el `Dockerfile` y monta un volumen en `/datos`.

Tus direcciones (cambia `TU-URL` y `TU-TOKEN`):
- **Conector MCP:** `https://TU-URL/TU-TOKEN/mcp`
- **Panel de campañas:** `https://TU-URL/TU-TOKEN/panel`

⚠️ El token es la contraseña. Quien tenga la URL del conector puede usarlo, así que no la compartas.

## 2. Conectarlo a ChatGPT
1. ChatGPT → *Configuración → Aplicaciones y conectores → Configuración avanzada* → activa **Modo desarrollador**. El nombre del menú puede variar.
2. *Crear conector* → Nombre: `Pincel IA` → URL: `https://TU-URL/TU-TOKEN/mcp` → Autenticación: **Sin autenticación**.
3. En un chat nuevo, activa el conector (botón **+** → Modo desarrollador → Pincel IA).

## 3. Conectarlo a Claude
- **claude.ai / Claude Desktop:** *Configuración → Conectores → Agregar conector personalizado* → pega la misma URL.
- **Claude Code:** `claude mcp add --transport http pincel-ia https://TU-URL/TU-TOKEN/mcp`

## Uso diario
1. **En Claude:** *"Genera los 7 prompts de imagen de la campaña y guárdalos en Pincel IA como 'crema black friday'"*.
2. **En ChatGPT:** *"Trae la campaña crema black friday y crea las imágenes"*.
3. **En ChatGPT:** *"Enviar a la plataforma"*. Si falla, abre el link del buzón y arrastra las imágenes.
4. **En Claude** (opcional): *"Trae las imágenes de la campaña crema black friday"*. Recibes los links públicos para usarlos en Chatea Pro, o Claude Code las baja a tu carpeta.

## Herramientas del conector

| Herramienta | Quién la usa | Qué hace |
|---|---|---|
| `crear_campana` | Claude | Guarda nombre + todos los prompts (+ notas de estilo comunes). |
| `obtener_prompts` | ChatGPT | Trae los prompts con instrucciones para crearlos tal cual, en orden. |
| `subir_imagen` | ChatGPT | Envía una imagen creada a su puesto (número) en la campaña. |
| `obtener_imagenes` | Claude | Links públicos de las imágenes y cuáles faltan. |
| `listar_campanas` | Ambos | Últimas campañas y su avance. |

## Páginas web
- `/c/<id>`: **buzón de la campaña**. Ves las imágenes, arrastras las que falten (todas juntas o una por tarjeta), copias prompts o links y descargas.
- `/c/<id>.zip`: todas las imágenes + `prompts.txt`.
- `/TU-TOKEN/panel`: lista de todas tus campañas.

## Probar en tu PC
```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
PINCEL_TOKEN=prueba .venv/bin/python -m pincel_ia.server
# Buzón y panel en http://localhost:8000/prueba/panel
```
