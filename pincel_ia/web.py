"""HTML de las páginas de Pincel IA (sin dependencias externas)."""

from __future__ import annotations

import json
from html import escape

CSS = """
:root{--bg:#f6f5f2;--card:#fff;--tx:#1d1d1b;--mu:#6b6a66;--bd:#e3e1dc;--ac:#1f7a5c;--acs:#e3f2ec;--er:#b3261e}
@media (prefers-color-scheme:dark){:root{--bg:#141413;--card:#1f1f1d;--tx:#eceae4;--mu:#a19f98;--bd:#33322f;--ac:#4cc79a;--acs:#1c3a2f;--er:#f2867e}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--tx);font:15px/1.5 system-ui,-apple-system,Segoe UI,sans-serif}
main{max-width:1100px;margin:0 auto;padding:24px 16px 64px}h1{font-size:24px;margin:0 0 4px}
.mu{color:var(--mu)}a{color:var(--ac)}
.bar{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0}
.btn{appearance:none;border:1px solid var(--bd);background:var(--card);color:var(--tx);border-radius:8px;padding:8px 14px;font:inherit;cursor:pointer;text-decoration:none}
.btn.p{background:var(--ac);border-color:var(--ac);color:#fff}
.drop{border:2px dashed var(--bd);border-radius:12px;padding:28px 16px;text-align:center;background:var(--card);cursor:pointer;transition:.15s}
.drop.on{border-color:var(--ac);background:var(--acs)}
.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:16px;margin-top:20px}
.c{background:var(--card);border:1px solid var(--bd);border-radius:12px;overflow:hidden;display:flex;flex-direction:column}
.ph{aspect-ratio:1;display:flex;align-items:center;justify-content:center;background:var(--bg);color:var(--mu);cursor:pointer;text-align:center;padding:12px}
.ph.on{background:var(--acs)}.c img{width:100%;display:block;aspect-ratio:1;object-fit:contain;background:var(--bg)}
.b{padding:12px;display:flex;flex-direction:column;gap:8px;flex:1}
.n{font-weight:600}.pr{font-size:13px;color:var(--mu);max-height:7.5em;overflow:auto;white-space:pre-wrap}
.row{display:flex;gap:6px;flex-wrap:wrap;margin-top:auto}.row .btn{padding:5px 10px;font-size:13px}
.ok{color:var(--ac);font-weight:600}.er{color:var(--er)}
table{width:100%;border-collapse:collapse;background:var(--card);border-radius:12px;overflow:hidden}
td,th{padding:10px 12px;border-bottom:1px solid var(--bd);text-align:left}
#t{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);background:var(--tx);color:var(--bg);padding:8px 14px;border-radius:8px;opacity:0;transition:.2s;pointer-events:none}
#t.v{opacity:1}
"""


def _pagina(titulo: str, cuerpo: str, js: str = "") -> str:
    return (
        f'<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
        f'<meta name="robots" content="noindex"><title>{escape(titulo)}</title><style>{CSS}</style>'
        f'<body><main>{cuerpo}</main><div id="t"></div><script>{js}</script></body></html>'
    )


def inicio() -> str:
    return _pagina("Pincel IA", "<h1>Pincel IA</h1><p class='mu'>Servidor de campañas de imágenes funcionando.</p>")


def no_encontrada() -> str:
    return _pagina("No encontrada", "<h1>Campaña no encontrada</h1><p class='mu'>Revisa el link.</p>")


def panel(campanas: list[dict], url: str, token: str) -> str:
    filas = "".join(
        f"<tr><td><a href='/c/{c['id']}'>{escape(c['nombre'])}</a></td>"
        f"<td>{sum(1 for p in c['prompts'] if p['imagen'])}/{len(c['prompts'])}</td>"
        f"<td class='mu'>{escape(c['creado'].replace('T', ' '))}</td></tr>"
        for c in campanas
    ) or "<tr><td colspan=3 class='mu'>Aún no hay campañas.</td></tr>"
    cuerpo = (
        "<h1>Panel · Pincel IA</h1>"
        f"<p class='mu'>Conector MCP (pégalo en ChatGPT y Claude): <code>{escape(url)}/{escape(token)}/mcp</code></p>"
        f"<table><tr><th>Campaña</th><th>Imágenes</th><th>Creada</th></tr>{filas}</table>"
    )
    return _pagina("Panel · Pincel IA", cuerpo)


def campana(c: dict) -> str:
    total = len(c["prompts"])
    hechas = sum(1 for p in c["prompts"] if p["imagen"])
    tarjetas = []
    for p in c["prompts"]:
        if p["imagen"]:
            src = f"/i/{c['id']}/{p['imagen']}"
            media = f'<a href="{src}" target="_blank"><img src="{src}" loading="lazy" alt="Imagen {p["n"]}"></a>'
            acciones = (
                f'<button class="btn" data-copiar-url="{src}">Copiar link</button>'
                f'<a class="btn" href="{src}" download>Descargar</a>'
                f'<button class="btn" data-elegir="{p["n"]}">Reemplazar</button>'
            )
        else:
            media = f'<div class="ph" data-elegir="{p["n"]}" data-soltar="{p["n"]}">Arrastra aquí la imagen {p["n"]}<br>o haz clic</div>'
            acciones = ""
        tarjetas.append(
            f'<div class="c">{media}<div class="b"><div class="n">#{p["n"]} '
            f'{"<span class=ok>✓</span>" if p["imagen"] else ""}</div>'
            f'<div class="pr">{escape(p["prompt"])}</div>'
            f'<div class="row"><button class="btn" data-copiar-prompt="{p["n"]}">Copiar prompt</button>{acciones}</div></div></div>'
        )
    prompts_js = json.dumps({p["n"]: p["prompt"] for p in c["prompts"]}, ensure_ascii=False).replace("</", "<\\/")
    cuerpo = f"""
<h1>{escape(c['nombre'])}</h1>
<p class="mu">{hechas}/{total} imágenes cargadas{(' · ' + escape(c['notas'])) if c['notas'] else ''}</p>
<div class="bar">
  <a class="btn p" href="/c/{c['id']}.zip">Descargar todo (ZIP)</a>
  <button class="btn" id="copiar-todos">Copiar todos los prompts</button>
</div>
<div class="drop" id="drop" data-elegir="">
  <b>Arrastra aquí todas las imágenes de ChatGPT</b><br>
  <span class="mu">Se asignan en orden (por nombre de archivo) a los puestos vacíos. También puedes soltar cada una en su tarjeta.</span>
</div>
<input type="file" id="f" accept="image/*" multiple hidden>
<div class="g">{''.join(tarjetas)}</div>"""
    js = f"""
const P={prompts_js}, ID={json.dumps(c['id'])};
const t=m=>{{const e=document.getElementById('t');e.textContent=m;e.classList.add('v');setTimeout(()=>e.classList.remove('v'),1800)}};
const copiar=s=>navigator.clipboard.writeText(s).then(()=>t('Copiado'),()=>t('No se pudo copiar'));
async function subir(files,n){{
  files=[...files].filter(f=>f.type.startsWith('image/')).sort((a,b)=>a.name.localeCompare(b.name,undefined,{{numeric:true}}));
  if(!files.length)return;
  const fd=new FormData(); if(n)fd.append('n',n); files.forEach(f=>fd.append('archivo',f));
  t('Subiendo '+files.length+'…');
  const r=await fetch('/c/'+ID+'/subir',{{method:'POST',body:fd}}); const j=await r.json().catch(()=>({{}}));
  if(j.ok)location.reload(); else t(j.error||'Error al subir');
}}
let destino='';
const inp=document.getElementById('f'); inp.onchange=()=>{{subir(inp.files,destino);inp.value=''}};
document.addEventListener('click',e=>{{
  const el=e.target.closest('[data-elegir],[data-copiar-prompt],[data-copiar-url]'); if(!el)return;
  if(el.dataset.copiarPrompt)copiar(P[el.dataset.copiarPrompt]);
  else if(el.dataset.copiarUrl)copiar(location.origin+el.dataset.copiarUrl);
  else{{destino=el.dataset.elegir;inp.multiple=!destino;inp.click()}}
}});
document.getElementById('copiar-todos').onclick=()=>copiar(Object.entries(P).map(([n,p])=>'Imagen '+n+':\\n'+p).join('\\n\\n'));
document.querySelectorAll('#drop,[data-soltar]').forEach(z=>{{
  z.addEventListener('dragover',e=>{{e.preventDefault();e.stopPropagation();z.classList.add('on')}});
  z.addEventListener('dragleave',()=>z.classList.remove('on'));
  z.addEventListener('drop',e=>{{e.preventDefault();e.stopPropagation();z.classList.remove('on');subir(e.dataTransfer.files,z.dataset.soltar||'')}});
}});
"""
    return _pagina(c["nombre"], cuerpo, js)
