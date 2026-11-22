import { useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { api, DEMO } from "../api";
import { Logo } from "../components/ui";
import { Fondo } from "../components/Layout";

export default function Login({ onEntrar }: { onEntrar: () => void }) {
  const [clave, setClave] = useState("");
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [ver, setVer] = useState(false);

  async function entrar(e: FormEvent) {
    e.preventDefault();
    setOcupado(true);
    setError("");
    try {
      await api.login(clave);
      onEntrar();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <>
      <Fondo />
      <div className="login">
        <div className="login-copy stagger">
          <div className="row gap-12">
            <Logo size={44} />
            <span className="brand-name" style={{ fontSize: 20 }}>Pincel <em>IA</em></span>
          </div>
          <h1>
            Crea imágenes<br />que <em className="grad-text">venden</em>.
          </h1>
          <p className="muted">
            Tu estudio creativo: Claude escribe los prompts, ChatGPT crea las imágenes y Pincel IA las organiza para tus campañas de WhatsApp.
          </p>
          <div className="login-feats">
            <span className="badge"><span className="dot" style={{ color: "#a78bfa" }} />Campañas</span>
            <span className="badge"><span className="dot" style={{ color: "#f472b6" }} />Biblioteca</span>
            <span className="badge"><span className="dot" style={{ color: "#fb923c" }} />ChatGPT + Claude</span>
          </div>
        </div>

        <form className="glass login-card" onSubmit={entrar}>
          <div className="stack gap-6">
            <h2>Bienvenido <em>de vuelta</em></h2>
            <p className="muted small">{DEMO ? "Demo: escribe cualquier contraseña para entrar." : "Ingresa tu contraseña para entrar a tu estudio."}</p>
          </div>
          <div className="field">
            <label htmlFor="clave">Contraseña</label>
            <div className="search">
              <Lock size={15} />
              <input
                id="clave"
                className="input"
                style={{ width: "100%", height: 46, paddingRight: 46 }}
                type={ver ? "text" : "password"}
                autoFocus
                autoComplete="current-password"
                placeholder="••••••••"
                value={clave}
                onChange={(e) => setClave(e.target.value)}
              />
              <button
                type="button"
                className="pw-toggle"
                onClick={() => setVer(!ver)}
                aria-label={ver ? "Ocultar contraseña" : "Mostrar contraseña"}
                title={ver ? "Ocultar contraseña" : "Mostrar contraseña"}
                tabIndex={0}
              >
                {ver ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {error && <span className="error-text">{error}</span>}
          </div>
          <button className="btn glow lg block" disabled={ocupado || !clave}>
            {ocupado ? <Loader2 size={17} className="spin" /> : null} Entrar <ArrowRight size={17} />
          </button>
        </form>
      </div>
    </>
  );
}
