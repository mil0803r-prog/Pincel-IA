"""Núcleo de Pincel IA: recibe una lista de prompts y genera todas las imágenes
en paralelo con la API de imágenes de OpenAI, guardándolas en una carpeta por lote."""

from __future__ import annotations

import asyncio
import base64
import json
import os
import re
import unicodedata
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path

from openai import AsyncOpenAI

MODELO_POR_DEFECTO = "gpt-image-2"
TAMANOS = {"cuadrado": "1024x1024", "horizontal": "1536x1024", "vertical": "1024x1536", "auto": "auto"}


def _config(nombre: str, defecto: str) -> str:
    return os.environ.get(nombre, defecto)


def carpeta_base() -> Path:
    return Path(_config("PINCEL_CARPETA", "./imagenes")).expanduser().resolve()


def _slug(texto: str, largo: int = 40) -> str:
    texto = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode()
    texto = re.sub(r"[^a-zA-Z0-9]+", "-", texto).strip("-").lower()
    return texto[:largo].strip("-") or "imagen"


@dataclass
class Resultado:
    indice: int
    prompt: str
    ok: bool
    archivo: str | None = None
    error: str | None = None


@dataclass
class Lote:
    nombre: str
    carpeta: str
    modelo: str
    tamano: str
    calidad: str
    creado: str
    resultados: list[Resultado] = field(default_factory=list)

    @property
    def exitosas(self) -> int:
        return sum(r.ok for r in self.resultados)


async def generar_lote(
    prompts: list[str],
    *,
    nombre_lote: str | None = None,
    tamano: str = "cuadrado",
    calidad: str = "high",
    formato: str = "png",
    imagenes_referencia: list[str] | None = None,
    cliente: AsyncOpenAI | None = None,
) -> Lote:
    """Genera una imagen por prompt, todas en paralelo, y las guarda en disco.

    Si se pasan `imagenes_referencia` (fotos reales del producto), se usa el
    endpoint de edición para que el producto salga fiel en todas las imágenes.
    """
    prompts = [p.strip() for p in prompts if p and p.strip()]
    if not prompts:
        raise ValueError("No llegó ningún prompt.")

    modelo = _config("PINCEL_MODELO", MODELO_POR_DEFECTO)
    size = TAMANOS.get(tamano, tamano)
    paralelo = max(1, int(_config("PINCEL_PARALELO", "4")))

    refs: list[Path] = []
    for r in imagenes_referencia or []:
        p = Path(r).expanduser().resolve()
        if not p.is_file():
            raise FileNotFoundError(f"No encuentro la imagen de referencia: {p}")
        refs.append(p)

    ahora = datetime.now()
    nombre = _slug(nombre_lote or "lote", 30)
    carpeta = carpeta_base() / f"{ahora:%Y%m%d-%H%M%S}-{nombre}"
    carpeta.mkdir(parents=True, exist_ok=True)

    cliente = cliente or AsyncOpenAI()
    semaforo = asyncio.Semaphore(paralelo)

    async def una(i: int, prompt: str) -> Resultado:
        async with semaforo:
            try:
                comunes = dict(model=modelo, prompt=prompt, size=size, quality=calidad,
                               output_format=formato, n=1)
                if refs:
                    archivos = [open(p, "rb") for p in refs]
                    try:
                        resp = await cliente.images.edit(image=archivos, input_fidelity="high", **comunes)
                    finally:
                        for f in archivos:
                            f.close()
                else:
                    resp = await cliente.images.generate(**comunes)
                datos = resp.data[0]
                if not datos.b64_json:
                    raise RuntimeError("La API no devolvió la imagen.")
                destino = carpeta / f"{i:02d}-{_slug(prompt)}.{formato}"
                destino.write_bytes(base64.b64decode(datos.b64_json))
                return Resultado(i, prompt, True, archivo=str(destino))
            except Exception as e:  # un fallo no debe tumbar el lote entero
                return Resultado(i, prompt, False, error=f"{type(e).__name__}: {e}")

    resultados = await asyncio.gather(*(una(i, p) for i, p in enumerate(prompts, 1)))

    lote = Lote(nombre=carpeta.name, carpeta=str(carpeta), modelo=modelo, tamano=size,
                calidad=calidad, creado=ahora.isoformat(timespec="seconds"),
                resultados=list(resultados))
    (carpeta / "lote.json").write_text(json.dumps(asdict(lote), ensure_ascii=False, indent=2), encoding="utf-8")
    _escribir_galeria(lote)
    return lote


def _escribir_galeria(lote: Lote) -> None:
    """Crea un index.html en la carpeta del lote para ver y descargar las imágenes."""
    import html

    tarjetas = []
    for r in lote.resultados:
        if r.ok and r.archivo:
            nombre = Path(r.archivo).name
            tarjetas.append(
                f'<figure><a href="{nombre}" download><img src="{nombre}" loading="lazy"></a>'
                f"<figcaption><b>#{r.indice}</b> {html.escape(r.prompt)}</figcaption></figure>"
            )
        else:
            tarjetas.append(
                f'<figure class="err"><div>Falló</div><figcaption><b>#{r.indice}</b> '
                f"{html.escape(r.prompt)}<br><small>{html.escape(r.error or '')}</small></figcaption></figure>"
            )
    (Path(lote.carpeta) / "index.html").write_text(
        f"""<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{html.escape(lote.nombre)}</title>
<style>body{{font-family:system-ui;margin:16px;background:#f6f6f4;color:#222}}
.g{{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px}}
figure{{margin:0;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 1px 3px #0002}}
img{{width:100%;display:block}}figcaption{{padding:10px;font-size:13px}}
.err div{{padding:60px 0;text-align:center;background:#fde8e8;color:#a00}}</style>
<h1>{html.escape(lote.nombre)}</h1><p>{lote.exitosas}/{len(lote.resultados)} imágenes · {lote.modelo} · {lote.tamano} · {lote.calidad}</p>
<div class="g">{''.join(tarjetas)}</div>""",
        encoding="utf-8",
    )


def listar_lotes(limite: int = 20) -> list[dict]:
    base = carpeta_base()
    if not base.is_dir():
        return []
    salida = []
    for d in sorted((d for d in base.iterdir() if (d / "lote.json").is_file()), reverse=True)[:limite]:
        datos = json.loads((d / "lote.json").read_text(encoding="utf-8"))
        salida.append({
            "lote": datos["nombre"],
            "carpeta": datos["carpeta"],
            "creado": datos["creado"],
            "imagenes": [r["archivo"] for r in datos["resultados"] if r["ok"]],
            "fallidas": sum(not r["ok"] for r in datos["resultados"]),
        })
    return salida
