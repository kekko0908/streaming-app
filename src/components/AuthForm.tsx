import { useState } from "react";
import { supabase } from "../supabaseClient";
import "../css/auth.css";

export default function AuthForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLogin, setIsLogin] = useState(true); // Toggle tra Login e Sign Up
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (isLogin) {
        // LOGIN
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      } else {
        // REGISTRAZIONE
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        setMessage("Registrazione completata! Controlla la tua email (se richiesto) o effettua il login.");
      }
    } catch (err: any) {
      setError(err.message || "Errore durante l'autenticazione");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>{isLogin ? "Bentornato" : "Crea Account"}</h2>
        <p className="auth-desc">
          {isLogin 
            ? "Accedi per sincronizzare la tua lista." 
            : "Registrati per salvare film e tenere traccia delle serie."}
        </p>

        {error && <div className="auth-error">{error}</div>}
        {message && <div className="auth-success">{message}</div>}

        <form className="auth-form" onSubmit={handleAuth}>
          <input
            type="email"
            placeholder="Email"
            className="auth-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            className="auth-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? "Caricamento..." : (isLogin ? "Accedi" : "Registrati")}
          </button>
        </form>

        <div className="auth-switch">
          {isLogin ? "Non hai un account? " : "Hai già un account? "}
          <span onClick={() => { setIsLogin(!isLogin); setError(null); setMessage(null); }}>
            {isLogin ? "Registrati" : "Accedi"}
          </span>
        </div>
      </div>
    </div>
  );
}