import { useState } from "react";
import { supabase } from "../supabaseClient";
import "../css/auth.css";
import logo from "../assets/logo.png";

export default function AuthForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message || "Errore durante l'autenticazione");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-bg-elements">
        <div className="auth-orb auth-orb-1"></div>
        <div className="auth-orb auth-orb-2"></div>
        <div className="auth-orb auth-orb-3"></div>
      </div>

      <div className="auth-card">
        <img src={logo} alt="SFA Logo" className="auth-logo" />
        <h2>Area Riservata</h2>
        <p className="auth-desc">Inserisci le tue credenziali per entrare.</p>

        {error && <div className="auth-error">{error}</div>}

        <form className="auth-form" onSubmit={handleAuth}>
          <div className="auth-input-group">
            <input
              type="email"
              placeholder="Email"
              className="auth-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>
          <div className="auth-input-group">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              className="auth-input auth-input-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              minLength={6}
            />
            <button
              type="button"
              className="auth-password-toggle"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Nascondi password" : "Mostra password"}
            >
              {showPassword ? (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 3l18 18" />
                  <path d="M10.58 10.58A2 2 0 0012 14a1.99 1.99 0 001.42-.58" />
                  <path d="M9.88 5.09A9.77 9.77 0 0112 4c5 0 9.27 3.11 11 8-0.55 1.56-1.46 2.96-2.63 4.11" />
                  <path d="M6.61 6.61C4.62 7.94 3.1 9.81 2 12c1.73 4.89 6 8 10 8 1.73 0 3.37-.46 4.79-1.27" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M2 12s3.64-8 10-8 10 8 10 8-3.64 8-10 8-10-8-10-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
          <button type="submit" className="auth-btn" disabled={loading}>
            <span>{loading ? "CARICAMENTO..." : "SBLOCCA"}</span>
          </button>
        </form>

        <div className="auth-switch">
          Accesso solo su invito. Se non hai credenziali, fatti abilitare da un amministratore.
        </div>
      </div>
    </div>
  );
}
