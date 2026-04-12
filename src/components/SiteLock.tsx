import { useState } from "react";
import "../css/siteLock.css";
import logo from "../assets/logo.png";

// HASH SHA-256 DELLA PASSWORD "SFA2025"
const TARGET_HASH = "90f45147fd552b88761a0b37d84fc493e8cb9074a17a13c6d68c23cbb7478f75";

interface SiteLockProps {
  onUnlock: () => void;
}

export default function SiteLock({ onUnlock }: SiteLockProps) {
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Funzione per calcolare l'impronta digitale (Hash)
  async function sha256(message: string) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  const checkPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const inputHash = await sha256(input);

    if (inputHash === TARGET_HASH) {
      sessionStorage.setItem("site_unlocked", "true");
      onUnlock();
    } else {
      setError(true);
      setInput("");
      setTimeout(() => setError(false), 2000);
    }
  };

  return (
    <div className="site-lock-overlay">
      <div className="lock-bg-elements">
        <div className="glass-orb orb-1"></div>
        <div className="glass-orb orb-2"></div>
        <div className="glass-orb orb-3"></div>
      </div>
      
      <div className={`lock-card ${error ? "shake" : ""}`}>
        <div className="lock-header">
          <img src={logo} alt="SFA Logo" className="lock-logo" />
          <h2 className="lock-title">Area Riservata</h2>
          <p className="lock-desc">Inserisci il codice di accesso per entrare.</p>
        </div>
        
        <form onSubmit={checkPassword} className="lock-form">
          <div className="input-group">
            <input 
              type={showPassword ? "text" : "password"} 
              placeholder="Codice Accesso" 
              className="lock-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              autoFocus
            />
            <button 
              type="button" 
              className="toggle-password" 
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
            >
              {showPassword ? "👁️" : "👁️‍🗨️"}
            </button>
          </div>
          <button type="submit" className="lock-btn">
            <span>SBLOCCA</span>
          </button>
        </form>

        {error && <div className="lock-error">Codice Errato. Riprova.</div>}
      </div>
    </div>
  );
}