import { useState } from "react";
import "../css/siteLock.css";
import logo from "../assets/logo.png"; // Il tuo logo nuovo

// 🔒 IMPOSTA QUI LA TUA PASSWORD SEGRETA
const SECRET_CODE = import.meta.env.VITE_SITE_PASSWORD;

interface SiteLockProps {
  onUnlock: () => void;
}

export default function SiteLock({ onUnlock }: SiteLockProps) {
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);

  const checkPassword = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (input === SECRET_CODE) {
      // Password corretta!
      sessionStorage.setItem("site_unlocked", "true"); // Salva che è sbloccato
      onUnlock();
    } else {
      // Password errata
      setError(true);
      setInput(""); // Pulisci campo
      setTimeout(() => setError(false), 2000); // Rimuovi errore dopo 2 sec
    }
  };

  return (
    <div className="site-lock-overlay">
      <div className="lock-card">
        <img src={logo} alt="Locked" className="lock-logo" />
        <h2 className="lock-title">Area Riservata</h2>
        <p className="lock-desc">Inserisci il codice di accesso per entrare nel mondo SFA.</p>
        
        <form onSubmit={checkPassword}>
          <input 
            type="password" 
            placeholder="Codice Accesso" 
            className="lock-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoFocus
          />
          
          <button type="submit" className="lock-btn">
            SBLOCCA ACCESSO
          </button>
        </form>

        {error && <div className="lock-error">⛔ Codice Errato. Riprova.</div>}
      </div>
    </div>
  );
}