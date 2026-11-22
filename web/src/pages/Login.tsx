import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { api } from "../api";
import { Logo } from "../components/ui";

export default function Login({ onEntrar }: { onEntrar: () => void }) {
  const [clave, setClave] = useState("");
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);

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
    <div className="login">
      <form className="card login-card" onSubmit={entrar}>
        <div className="login-brand">
          <Logo size={52} />
          <div className="stack gap-4">
            <h1>Pincel IA</h1>
            <p className="muted">Tu estudio de imágenes para vender más</p>
          </div>
        </div>
        <div className="field">
          <label htmlFor="clave">Contraseña</label>
          <input
            id="clave"
            className="input"
            type="password"
            autoFocus
            autoComplete="current-password"
            value={clave}
            onChange={(e) => setClave(e.target.value)}
          />
          {error && <span className="error-text">{error}</span>}
        </div>
        <button className="btn primary block" disabled={ocupado || !clave} style={{ height: 40 }}>
          {ocupado && <Loader2 size={16} className="spin" />} Entrar
        </button>
      </form>
    </div>
  );
}
