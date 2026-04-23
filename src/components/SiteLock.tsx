import { useState } from "react";
import { supabase } from "../supabaseClient";
import "../css/siteLock.css";
import logo from "../assets/logo.png";

interface SiteLockProps {
  onLogin?: () => void;
}

export default function SiteLock({ onLogin }: SiteLockProps) {
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
      // onLogin is optional, as App.tsx listens to supabase state changes.
      if (onLogin) onLogin();
    } catch (err: any) {
      setError(err.message || "Errore di accesso");
      // Small shake effect on error
      const card = document.querySelector(".lock-card");
      if (card) {
        card.classList.remove("shake");
        void (card as HTMLElement).offsetWidth; 
        card.classList.add("shake");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="site-lock-overlay">
      <div className="lock-bg-elements">
        <div className="glass-orb orb-1"></div>
        <div className="glass-orb orb-2"></div>
        <div className="glass-orb orb-3"></div>
      </div>

      <div className="lock-card">
        <div className="lock-header">
          <img src={logo} alt="SFA Logo" className="lock-logo" />
          <h2 className="lock-title">Area Riservata</h2>
          <p className="lock-desc">
            Inserisci le tue credenziali per entrare.
          </p>
        </div>

        {error && <div className="lock-error">{error}</div>}

        <form className="lock-form" onSubmit={handleAuth}>
          <div className="input-group">
            <input
              type="email"
              className="lock-input"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          
          <div className="input-group">
            <input
              type={showPassword ? "text" : "password"}
              className="lock-input"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              className="toggle-password"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? "👁️" : "🤫"}
            </button>
          </div>

          <button type="submit" className="lock-btn" disabled={loading}>
            <span>{loading ? "CARICAMENTO..." : "SBLOCCA"}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
