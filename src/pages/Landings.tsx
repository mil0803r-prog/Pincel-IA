import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Globe, ImageIcon, Loader2, PanelsTopLeft, Plus, TriangleAlert } from "lucide-react";
import { api, fecha, type LandingResumen, type Mercado } from "../api";
import { Anillo, Cabecera, Modal, Vacio, iniciales, useToast } from "../components/ui";

const ETIQUETA_TIPO = { imagenes: "De imágenes", ficha: "Ficha de producto", hibrida: "Híbrida" } as const;

export default function Landings() {
  const [lista, setLista] = useState<LandingResumen[] | null>(null);
  const [mercado, setMercado] = useState<Mercado | null>(null);
  const [nueva, setNueva] = useState(false);

  useEffect(() => {
    api.landings().then(setLista).catch(() => setLista([]));
    api.mercado().then(setMercado).catch(() => {});
  }, []);

  return (
    <>
      <Cabecera titulo={<>Landing</>} subtitulo="Adapta una landing a tu mercado: revisa, edita solo lo necesario y entrega todo en orden">
        <button className="btn primary" onClick={() => setNueva(true)}><Plus size={16} /> Nueva landing</button>
      </Cabecera>

      {mercado && (
        mercado.configurado ? (
          <Link to="/mercado" className="glass mercado-chip">
            <span className="tile-icon"><Globe size={16} /></span>
            <div className="stack grow">
              <span className="small subtle">Mercado de venta</span>
              <b>{mercado.pais} · {mercado.moneda} · {mercado.idioma}</b>
            </div>
            <span className="small muted">Editar</span>
          </Link>
        ) : (
          <div className="callout" style={{ marginBottom: 16 }}>
            <TriangleAlert size={18} />
            <div className="row between wrap gap-12 grow">
              <p className="small">Antes de empezar, configura tu mercado: <b>país, moneda e idioma</b>.</p>
              <Link className="btn sm primary" to="/mercado">Configurar mercado</Link>
            </div>
          </div>
        )
      )}

      <div style={{ marginTop: 20 }}>
        {!lista ? (
          <div className="grid-campanas">{[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 270 }} />)}</div>
        ) : lista.length === 0 ? (
          <Vacio icono={<PanelsTopLeft size={26} />} titulo={<>Tu primera <em>landing</em></>} texto="Pega la dirección de una landing para traer sus imágenes en orden, o arrástralas. Después decides qué se edita y qué queda intacto.">
            <button className="btn glow" onClick={() => setNueva(true)}><Plus size={16} /> Nueva landing</button>
          </Vacio>
        ) : (
          <div className="grid-campanas stagger">
            {lista.map((l) => (
              <Link key={l.id} to={`/landing/${l.id}`} className="glass camp">
                <div className={`collage n${Math.max(l.miniaturas.length, 1)}`}>
                  {l.miniaturas.length ? l.miniaturas.map((src) => <img key={src} src={src} alt="" loading="lazy" />) : <div className="collage-empty"><span>{iniciales(l.nombre)}</span></div>}
                  {l.tipo ? <span className="badge onimg">{ETIQUETA_TIPO[l.tipo]}</span> : <span className="badge onimg">Sin clasificar</span>}
                </div>
                <div className="camp-body">
                  <div className="stack gap-4 grow">
                    <div className="camp-title" title={l.nombre}>{l.nombre}</div>
                    <span className="subtle small">
                      {l.total ? `${l.listas} de ${l.total} listas${l.a_editar ? ` · ${l.a_editar} a editar` : ""}` : "Sin imágenes todavía"} · {fecha(l.creado)}
                    </span>
                  </div>
                  <Anillo hechas={l.listas} total={l.total} size={40} grosor={3.5} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {nueva && <NuevaLanding onCerrar={() => setNueva(false)} />}
    </>
  );
}

function NuevaLanding({ onCerrar }: { onCerrar: () => void }) {
  const [nombre, setNombre] = useState("");
  const [url, setUrl] = useState("");
  const [notas, setNotas] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const nav = useNavigate();
  const toast = useToast();

  async function crear() {
    setOcupado(true);
    setError("");
    try {
      const l = await api.crearLanding(nombre, url, notas);
      toast("Landing creada");
      nav(`/landing/${l.id}`);
      onCerrar();
    } catch (e) {
      setError((e as Error).message);
      setOcupado(false);
    }
  }

  return (
    <Modal
      titulo={<>Nueva <em>landing</em></>}
      descripcion="Después podrás importar sus imágenes desde la dirección o arrastrarlas."
      onCerrar={onCerrar}
      ancho={560}
      pie={
        <>
          <button className="btn" onClick={onCerrar}>Cancelar</button>
          <button className="btn glow" disabled={ocupado || !nombre.trim()} onClick={crear}>
            {ocupado ? <Loader2 size={16} className="spin" /> : <ImageIcon size={16} />} Crear landing
          </button>
        </>
      }
    >
      <div className="field">
        <label htmlFor="nl-nombre">Nombre</label>
        <input id="nl-nombre" className="input" autoFocus placeholder="Ej. Crema facial Glow" value={nombre} onChange={(e) => setNombre(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="nl-url">Dirección de la landing <span className="subtle">(opcional)</span></label>
        <input id="nl-url" className="input" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
        <span className="hint">La página fuente que vas a adaptar.</span>
      </div>
      <div className="field">
        <label htmlFor="nl-notas">Notas <span className="subtle">(opcional)</span></label>
        <input id="nl-notas" className="input" placeholder="Producto, oferta, indicaciones…" value={notas} onChange={(e) => setNotas(e.target.value)} />
      </div>
      {error && <span className="error-text">{error}</span>}
    </Modal>
  );
}
