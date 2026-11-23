import { useEffect, useState } from "react";
import { Check, Globe, Loader2, TriangleAlert } from "lucide-react";
import { api, fecha, type Mercado as TMercado } from "../api";
import { Cabecera, useToast } from "../components/ui";

const PAISES = ["Colombia", "México", "Perú", "Chile", "Argentina", "Ecuador", "Bolivia", "Paraguay", "Uruguay", "Venezuela", "Panamá", "Costa Rica", "Guatemala", "Honduras", "República Dominicana", "España"];
const MONEDAS = ["COP", "MXN", "PEN", "CLP", "ARS", "USD", "BOB", "PYG", "UYU", "VES", "PAB", "CRC", "GTQ", "HNL", "DOP", "EUR"];
const IDIOMAS = ["español", "portugués", "inglés"];

type Form = Record<"pais" | "moneda" | "idioma" | "tienda" | "transportadoras" | "medios_pago" | "condiciones_envio", string>;
const aForm = (m: TMercado): Form => ({
  pais: m.pais ?? "", moneda: m.moneda ?? "", idioma: m.idioma ?? "", tienda: m.tienda ?? "",
  transportadoras: m.transportadoras ?? "", medios_pago: m.medios_pago ?? "", condiciones_envio: m.condiciones_envio ?? "",
});

export default function Mercado() {
  const [m, setM] = useState<TMercado | null>(null);
  const [f, setF] = useState<Form | null>(null);
  const [guardando, setGuardando] = useState(false);
  const toast = useToast();

  useEffect(() => {
    api.mercado().then((x) => { setM(x); setF(aForm(x)); }).catch(() => {});
  }, []);

  if (!m || !f) return <div className="skeleton" style={{ height: 420 }} />;
  const cambio = JSON.stringify(f) !== JSON.stringify(aForm(m));
  const poner = (k: keyof Form) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  async function guardar() {
    setGuardando(true);
    try {
      const nuevo = await api.guardarMercado(f as Form);
      setM(nuevo);
      setF(aForm(nuevo));
      toast(nuevo.configurado ? "Mercado guardado" : "Guardado. Faltan datos obligatorios");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
      <Cabecera
        titulo={<>Mercado</>}
        subtitulo="El país donde vendes. Se usa en todas las landings para adaptar precios, moneda, banderas y transportadoras."
      >
        {m.configurado ? (
          <span className="badge success"><span className="dot" />Configurado</span>
        ) : (
          <span className="badge warning"><span className="dot" />Faltan datos</span>
        )}
      </Cabecera>

      {!m.configurado && (
        <div className="callout" style={{ marginBottom: 16 }}>
          <TriangleAlert size={18} />
          <p className="small">
            Empieza por el <b>país de venta</b> y confirma la <b>moneda</b> y el <b>idioma</b>. El idioma en que escribes no define el país. Lo demás puedes completarlo cuando haga falta; lo que no sepas, déjalo vacío y no se inventa.
          </p>
        </div>
      )}

      <div className="two-col">
        <section className="glass">
          <div className="card-head"><h2>Datos <em>obligatorios</em></h2></div>
          <div className="pad stack gap-16">
            <div className="field">
              <label htmlFor="m-pais">País de venta</label>
              <input id="m-pais" className="input" list="paises" placeholder="Ej. Colombia" value={f.pais} onChange={poner("pais")} />
              <datalist id="paises">{PAISES.map((p) => <option key={p} value={p} />)}</datalist>
            </div>
            <div className="row gap-12 wrap">
              <div className="field grow" style={{ minWidth: 160 }}>
                <label htmlFor="m-moneda">Moneda</label>
                <input id="m-moneda" className="input" list="monedas" placeholder="Ej. COP" value={f.moneda} onChange={poner("moneda")} />
                <datalist id="monedas">{MONEDAS.map((p) => <option key={p} value={p} />)}</datalist>
              </div>
              <div className="field grow" style={{ minWidth: 160 }}>
                <label htmlFor="m-idioma">Idioma</label>
                <input id="m-idioma" className="input" list="idiomas" placeholder="Ej. español" value={f.idioma} onChange={poner("idioma")} />
                <datalist id="idiomas">{IDIOMAS.map((p) => <option key={p} value={p} />)}</datalist>
              </div>
            </div>
          </div>
        </section>

        <section className="glass">
          <div className="card-head"><h2>Cuando <em>haga falta</em></h2></div>
          <div className="pad stack gap-16">
            <div className="field">
              <label htmlFor="m-tienda">Tienda</label>
              <input id="m-tienda" className="input" placeholder="Nombre de la tienda" value={f.tienda} onChange={poner("tienda")} />
            </div>
            <div className="field">
              <label htmlFor="m-transp">Transportadoras confirmadas</label>
              <input id="m-transp" className="input" placeholder="Solo las que confirmes para tu tienda" value={f.transportadoras} onChange={poner("transportadoras")} />
              <span className="hint">Un logo de transportadora solo se usa si está confirmado para tu tienda o campaña.</span>
            </div>
            <div className="field">
              <label htmlFor="m-pago">Medios de pago</label>
              <input id="m-pago" className="input" placeholder="Ej. pago contra entrega, tarjeta" value={f.medios_pago} onChange={poner("medios_pago")} />
            </div>
            <div className="field">
              <label htmlFor="m-envio">Condiciones de envío</label>
              <textarea id="m-envio" className="textarea" rows={3} style={{ minHeight: 80 }} placeholder="Tiempos, cobertura, costo…" value={f.condiciones_envio} onChange={poner("condiciones_envio")} />
            </div>
          </div>
        </section>
      </div>

      <div className="row between wrap gap-12" style={{ marginTop: 20 }}>
        <span className="subtle small row gap-6"><Globe size={14} /> Garantía: se conserva la de la referencia, salvo que indiques otra en la landing.{m.actualizado ? ` · Guardado ${fecha(m.actualizado)}` : ""}</span>
        <button className="btn glow" disabled={!cambio || guardando} onClick={guardar}>
          {guardando ? <Loader2 size={16} className="spin" /> : <Check size={16} />} Guardar mercado
        </button>
      </div>
    </>
  );
}
