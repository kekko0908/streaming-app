import { useState } from "react";
import "../css/siteLock.css";
import logo from "../assets/logo.png";

// HASH SHA-256 DELLA PASSWORD "SFA2025"
// Se vuoi cambiare password, vai su un sito come "sha256 generator"
// scrivi la tua password e incolla qui il codice che ti dà.
const TARGET_HASH = "90f45147fd552b88761a0b37d84fc493e8cb9074a17a13c6d68c23cbb7478f75";

interface SiteLockProps {
  onUnlock: () => void;
}

export default function SiteLock({ onUnlock }: SiteLockProps) {
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);

  // Funzione per calcolare l'impronta digitale (Hash)
  async function sha256(message: string) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  const checkPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Calcoliamo l'hash di quello che hai scritto
    const inputHash = await sha256(input);

    if (inputHash === TARGET_HASH) {
      // Combacia!
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
      <div className="lock-card">
        <img src={logo} alt="Locked" className="lock-logo" />
        <h2 className="lock-title">Area Riservata</h2>
        <p className="lock-desc">Inserisci il codice di accesso per entrare.</p>
        
        <form onSubmit={checkPassword}>
          <input 
            type="password" 
            placeholder="Codice Accesso" 
            className="lock-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoFocus
          />
          <button type="submit" className="lock-btn">SBLOCCA</button>
        </form>

        {error && <div className="lock-error">⛔ Codice Errato.</div>}
      </div>
    </div>
  );
}