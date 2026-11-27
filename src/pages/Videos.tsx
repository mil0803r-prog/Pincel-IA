import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AudioLines, Clapperboard, Film, Plus, Scissors, Trash2, Type, Wand2 } from "lucide-react";
import { Cabecera, Confirmar, Modal, Vacio, useToast } from "../components/ui";
import { borrarProyecto, guardarProyecto, listarProyectos } from "../editor/almacen";
import { duracionProyecto, FORMATOS, tiempo, uid, type Formato, type Proyecto } from "../editor/tipos";

const fechaCorta = (s: string) => {
  try { return new Date(s).toLocaleDateString("es", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); } catch { return ""; }
};

export function NuevoProyecto({ onCerrar }: { onCerrar: () => void }) {
  const nav = useNavigate();
  const [nombre, setNombre] = useState("");
  const [formato, setFormato] = useState<Formato>("9:16");
  const crear = async () => {
    const ahora = new Date().toISOString();
    const p: Proyecto = { id: uid(), nombre: nombre.trim() || "Video sin título", formato, fondo: "#000000", medios: [], clips: [], creado: ahora, actualizado: ahora };
    await guardarProyecto(p);
    onCerrar();
    nav(`/video/${p.id}`);
  };
  return (
    <Modal titulo="Nuevo video" descripcion="Elige el formato; puedes cambiarlo después." onCerrar={onCerrar} ancho={560}
      pie={<><button className="btn" onClick={onCerrar}>Cancelar</button><button className="btn glow" onClick={crear}><Clapperboard size={16} /> Crear y editar</button></>}>
      <div className="stack gap-16">
        <div className="field">
          <label htmlFor="np-nombre">Nombre</label>
          <input id="np-nombre" className="input" autoFocus value={nombre} placeholder="Ej.: Anuncio crema facial" onChange={(e) => setNombre(e.target.value)} onKeyDown={(e) => e.key === "Enter" && crear()} />
        </div>
        <div className="formatos">
          {(Object.keys(FORMATOS) as Formato[]).map((f) => {
            const d = FORMATOS[f];
            const k = 46 / Math.max(d.ancho, d.alto);
            return (
              <button key={f} className={`formato ${formato === f ? "on" : ""}`} onClick={() => setFormato(f)}>
                <span className="formato-caja"><i style={{ width: d.ancho * k, height: d.alto * k }} /></span>
                <b>{f}</b>
                <span className="subtle small">{d.nombre.split("·")[1]?.trim()}</span>
              </button>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}

export default function Videos() {
  const [lista, setLista] = useState<Proyecto[] | null>(null);
  const [nuevo, setNuevo] = useState(false);
  const [borrar, setBorrar] = useState<Proyecto | null>(null);
  const toast = useToast();

  useEffect(() => { listarProyectos().then(setLista).catch(() => setLista([])); }, []);

  return (
    <>
      <Cabecera titulo={<>Editor de <em>video</em></>} subtitulo="Corta, une, pon textos y música, separa o extrae el audio y exporta en MP4 listo para tus estados y anuncios">
        <button className="btn primary" onClick={() => setNuevo(true)}><Plus size={16} /> Nuevo video</button>
      </Cabecera>

      <div className="vid-funciones">
        {[
          [Scissors, "Cortar y recortar", "Divide en el cabezal, arrastra los bordes"],
          [AudioLines, "Audio", "Separa, extrae a WAV, volumen y fundidos"],
          [Type, "Textos", "Títulos, precios y llamados a la acción"],
          [Wand2, "Filtros y animación", "Velocidad, filtros, entradas y salidas"],
        ].map(([Icono, t, d]) => {
          const I = Icono as typeof Scissors;
          return (
            <div key={t as string} className="glass vid-funcion">
              <span className="tile-icon"><I size={16} /></span>
              <div className="stack"><b className="small">{t as string}</b><span className="subtle small">{d as string}</span></div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 20 }}>
        {!lista ? (
          <div className="grid-campanas">{[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 230 }} />)}</div>
        ) : lista.length === 0 ? (
          <Vacio icono={<Film size={26} />} titulo={<>Tu primer <em>video</em></>} texto="Importa tus clips, fotos y música. Todo se procesa en tu navegador: no se sube nada y es rápido.">
            <button className="btn glow" onClick={() => setNuevo(true)}><Plus size={16} /> Nuevo video</button>
          </Vacio>
        ) : (
          <div className="grid-campanas stagger">
            {lista.map((p) => {
              const portada = p.medios.find((m) => m.miniatura)?.miniatura;
              return (
                <div key={p.id} className="glass camp vid-camp">
                  <Link to={`/video/${p.id}`} className="vid-portada">
                    {portada ? <img src={portada} alt="" /> : <Film size={28} />}
                    <span className="badge onimg">{p.formato}</span>
                    <span className="badge onimg vid-dur">{tiempo(duracionProyecto(p))}</span>
                  </Link>
                  <div className="row between gap-8" style={{ padding: "12px 14px" }}>
                    <Link to={`/video/${p.id}`} className="stack grow" style={{ minWidth: 0 }}>
                      <b className="ellipsis">{p.nombre}</b>
                      <span className="subtle small">{p.clips.length} clips · {fechaCorta(p.actualizado)}</span>
                    </Link>
                    <button className="icon-btn" aria-label="Borrar proyecto" title="Borrar" onClick={() => setBorrar(p)}><Trash2 size={15} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <p className="subtle small" style={{ marginTop: 18 }}>Los proyectos de video se guardan en este navegador. Para llevarlos a otro equipo, exporta el video.</p>

      {nuevo && <NuevoProyecto onCerrar={() => setNuevo(false)} />}
      {borrar && (
        <Confirmar titulo="Borrar proyecto" texto={`Se borrará "${borrar.nombre}" con sus archivos importados. No se puede deshacer.`} accion="Borrar"
          onCerrar={() => setBorrar(null)}
          onSi={async () => {
            await borrarProyecto(borrar);
            setLista((l) => l?.filter((x) => x.id !== borrar.id) ?? null);
            setBorrar(null);
            toast("Proyecto borrado");
          }} />
      )}
    </>
  );
}
