import "../css/navbar.css";
import { ViewType } from "../types/types";
import { Session } from "@supabase/supabase-js";

interface NavbarProps {
  view: ViewType;
  setView: (v: ViewType) => void;
  resetSelection: () => void;
  query: string;
  setQuery: (q: string) => void;
  onSearch: () => void;
  session: Session | null;
  onLogout: () => void;
}

export default function Navbar({ 
  view, setView, resetSelection, query, setQuery, onSearch, session, onLogout 
}: NavbarProps) {
  
  return (
    <nav className="nav">
      <div className="nav-left">
        {/* LOGO */}
        <div className="logo" onClick={() => { setView("home"); resetSelection(); }}>
          <span className="badge">SFA</span>
          <div>
            <div className="logo-title">Streaming For All</div>
            <div className="logo-sub">Cinema a casa tua</div>
          </div>
        </div>

        {/* BARRA DI RICERCA */}
        <div className="nav-search-container">
          <input 
            className="nav-search-input"
            placeholder="Cerca film, serie..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSearch()}
          />
        </div>
      </div>

      <div className="nav-links">
        <button 
          className={`pill ${view === "home" ? "solid" : "ghost"}`} 
          onClick={() => { setView("home"); resetSelection(); }}
        >
          Home
        </button>
        
        <button 
          className={`pill ${view === "archive" ? "solid" : "ghost"}`} 
          onClick={() => { setView("archive"); resetSelection(); }}
        >
          Archivio
        </button>

        {/* LOGICA BOTTONI UTENTE LOGGATO */}
        {session ? (
          <>
            {/* NUOVO TASTO PROFILO */}
            <button 
              className={`pill ${view === "profile" ? "solid" : "ghost"}`} 
              onClick={() => { setView("profile"); resetSelection(); }}
            >
              Profilo
            </button>

            <button 
              className={`pill ${view === "list" ? "solid" : "ghost"}`} 
              onClick={() => { setView("list"); resetSelection(); }}
            >
              La mia Lista
            </button>
            
            <button 
              className="pill ghost"
              onClick={onLogout}
              style={{ borderColor: 'rgba(255, 80, 80, 0.3)', color: '#ff8080' }}
            >
              Esci
            </button>
          </>
        ) : (
          <button 
            className="pill solid"
            style={{ background: '#fff', color: '#000' }}
            onClick={() => { setView("auth"); resetSelection(); }}
          >
            Accedi / Registrati
          </button>
        )}
      </div>
    </nav>
  );
}