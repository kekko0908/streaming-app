import { useEffect, useRef, useState } from "react";
import "../css/navbar.css";
import { ViewType } from "../types/types";
import { Session } from "@supabase/supabase-js";
import { supabase } from "../supabaseClient";
import logo from "../assets/logo.png"; 

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

const DEFAULT_AVATAR = "https://api.dicebear.com/7.x/adventurer/svg?seed=Default";

export default function Navbar({ 
  view, setView, resetSelection, query, setQuery, onSearch, session, onLogout 
}: NavbarProps) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRefDesktop = useRef<HTMLDivElement | null>(null);
  const menuRefMobile = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      const isInsideDesktop = menuRefDesktop.current?.contains(target);
      const isInsideMobile = menuRefMobile.current?.contains(target);
      if (!isInsideDesktop && !isInsideMobile) setIsMenuOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [view, session]);

  useEffect(() => {
    let isActive = true;
    const loadAvatar = async () => {
      if (!session?.user) {
        setAvatarUrl(null);
        return;
      }
      const fallback = session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture || null;
      const { data, error } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("id", session.user.id)
        .maybeSingle();

      if (error) {
        console.warn("Errore caricamento avatar profilo", error);
      }
      if (!isActive) return;
      setAvatarUrl(data?.avatar_url || fallback || DEFAULT_AVATAR);
    };
    loadAvatar();
    return () => {
      isActive = false;
    };
  }, [session?.user?.id, session?.user?.user_metadata?.avatar_url, session?.user?.user_metadata?.picture]);

  const handleMenuNavigate = (nextView: ViewType) => {
    setView(nextView);
    resetSelection();
    setIsMenuOpen(false);
  };

  const handleLogoutClick = () => {
    setIsMenuOpen(false);
    onLogout();
  };

  return (
    <nav className="nav">
      <div className="nav-left">
        {/* LOGO */}
        <div className="logo" onClick={() => { setView("home"); resetSelection(); }}>
         <img src={logo} alt="SFA Logo" className="logo-img" />
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

        {session && (
          <div className="user-menu mobile-only" ref={menuRefMobile}>
            <button
              type="button"
              className={`user-menu-button ${isMenuOpen ? "open" : ""} ${(view === "profile" || view === "list") ? "active" : ""}`}
              onClick={() => setIsMenuOpen((prev) => !prev)}
              aria-haspopup="menu"
              aria-expanded={isMenuOpen}
              aria-label="Menu utente"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar utente" />
              ) : (
                <span className="user-avatar-fallback">U</span>
              )}
            </button>

            {isMenuOpen && (
              <div className="user-menu-dropdown" role="menu">
                <button
                  type="button"
                  className="user-menu-item"
                  role="menuitem"
                  onClick={() => handleMenuNavigate("profile")}
                >
                  Profilo
                </button>
                <button
                  type="button"
                  className="user-menu-item"
                  role="menuitem"
                  onClick={() => handleMenuNavigate("list")}
                >
                  La mia Lista
                </button>
                <div className="user-menu-divider" role="separator" />
                <button
                  type="button"
                  className="user-menu-item danger"
                  role="menuitem"
                  onClick={handleLogoutClick}
                >
                  Esci
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="nav-links">
        <button 
          className={`pill ${view === "home" ? "solid" : "ghost"}`} 
          onClick={() => { setView("home"); resetSelection(); }}
        >
          Home
        </button>
        <button 
  className={`pill ${view === 'suggestions' ? "solid" : "ghost"}`} 
  onClick={() => setView('suggestions')}
>
  Consigli💡
</button>
        
        <button 
          className={`pill ${view === "archive" ? "solid" : "ghost"}`} 
          onClick={() => { setView("archive"); resetSelection(); }}
        >
          Archivio
        </button>
        <button 
  className={`pill ${view === "ranking" ? "solid" : "ghost"}`} 
  onClick={() => { setView("ranking"); resetSelection(); }}
>
  Classifica 🏆
</button>

        {session && (
          <div className="user-menu desktop-only" ref={menuRefDesktop}>
            <button
              type="button"
              className={`user-menu-button ${isMenuOpen ? "open" : ""} ${(view === "profile" || view === "list") ? "active" : ""}`}
              onClick={() => setIsMenuOpen((prev) => !prev)}
              aria-haspopup="menu"
              aria-expanded={isMenuOpen}
              aria-label="Menu utente"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar utente" />
              ) : (
                <span className="user-avatar-fallback">U</span>
              )}
            </button>

            {isMenuOpen && (
              <div className="user-menu-dropdown" role="menu">
                <button
                  type="button"
                  className="user-menu-item"
                  role="menuitem"
                  onClick={() => handleMenuNavigate("profile")}
                >
                  Profilo
                </button>
                <button
                  type="button"
                  className="user-menu-item"
                  role="menuitem"
                  onClick={() => handleMenuNavigate("list")}
                >
                  La mia Lista
                </button>
                <div className="user-menu-divider" role="separator" />
                <button
                  type="button"
                  className="user-menu-item danger"
                  role="menuitem"
                  onClick={handleLogoutClick}
                >
                  Esci
                </button>
              </div>
            )}
          </div>
        )}
        {/* LOGICA BOTTONI UTENTE LOGGATO */}
        {!session && (
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
