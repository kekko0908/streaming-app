import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "../css/navbar.css";
import { Session } from "@supabase/supabase-js";
import { supabase } from "../supabaseClient";
import logo from "../assets/logo.png"; 

interface NavbarProps {
  resetSelection: () => void;
  query: string;
  setQuery: (q: string) => void;
  onSearch: () => void;
  session: Session | null;
  onLogout: () => void;
  onShowUpdates: () => void;
  isAdmin: boolean;
}

const DEFAULT_AVATAR = "https://api.dicebear.com/7.x/adventurer/svg?seed=Default";

export default function Navbar({ 
  resetSelection, query, setQuery, onSearch, session, onLogout, onShowUpdates, isAdmin
}: NavbarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const path = location.pathname;
  const isDetailRoute = path.startsWith("/film/") || path.startsWith("/serie-tv/");
  const routeViewMap: Record<string, string> = {
    "/archivio": "archive",
    "/archive": "archive",
    "/classifica": "ranking",
    "/ranking": "ranking",
  };
  let view = path === "/" || isDetailRoute ? "home" : routeViewMap[path] || path.substring(1);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRefDesktop = useRef<HTMLDivElement | null>(null);
  const menuRefMobile = useRef<HTMLDivElement | null>(null);

  // DEBOUNCE RICERCA
  useEffect(() => {
    if (query.trim().length > 1) {
      const timer = setTimeout(() => {
        onSearch();
        navigate("/");
      }, 600);
      return () => clearTimeout(timer);
    } else if (query.trim() === "") {
      const timer = setTimeout(() => {
          onSearch();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [query]);

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
  }, [location, session]);

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

  const handleMenuNavigate = (nextPath: string) => {
    navigate(nextPath);
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
        <div className="logo" onClick={() => { navigate("/"); resetSelection(); }}>
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
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onSearch();
                navigate("/");
              }
            }}
          />
        </div>

        {/* MENU MOBILE COMPLETO (Sempre visibile su mobile) */}
        <div className="user-menu mobile-only" ref={menuRefMobile}>
          <button
            type="button"
            className={`user-menu-button ${isMenuOpen ? "open" : ""} ${(view === "profile" || view === "list" || view === "admin") ? "active" : ""}`}
            onClick={() => setIsMenuOpen((prev) => !prev)}
            aria-haspopup="menu"
            aria-expanded={isMenuOpen}
            aria-label="Menu"
          >
            {session && avatarUrl ? (
              <img src={avatarUrl} alt="Avatar utente" />
            ) : (
              <span className="user-avatar-fallback">☰</span>
            )}
          </button>

          {isMenuOpen && (
            <div className="user-menu-dropdown" role="menu">
              <button className="user-menu-item" onClick={() => handleMenuNavigate("/")}>Home</button>
              <button className="user-menu-item" onClick={() => handleMenuNavigate("/suggestions")}>Suggerimenti 💡</button>
              <button className="user-menu-item" onClick={() => handleMenuNavigate("/archivio")}>Archivio</button>
              <button className="user-menu-item" onClick={() => handleMenuNavigate("/classifica")}>Classifica 🏆</button>
              
              {isAdmin && <button className="user-menu-item" onClick={() => handleMenuNavigate("/admin")}>Admin Dashboard</button>}
              <div className="user-menu-divider" role="separator" />
              
              {session ? (
                <>
                  <button className="user-menu-item" onClick={() => handleMenuNavigate("/profile")}>Profilo</button>
                  <button className="user-menu-item" onClick={() => handleMenuNavigate("/list")}>La mia Lista</button>
                  <button className="user-menu-item" onClick={() => { setIsMenuOpen(false); onShowUpdates(); }}>Novità</button>
                  <div className="user-menu-divider" role="separator" />
                  <button className="user-menu-item danger" onClick={handleLogoutClick}>Esci</button>
                </>
              ) : (
                <button className="user-menu-item" onClick={() => handleMenuNavigate("/auth")}>Accedi</button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="nav-links">
        <button 
          className={`pill ${view === "home" ? "solid" : "ghost"}`} 
          onClick={() => { navigate("/"); resetSelection(); }}
        >
          Home
        </button>
        <button 
          className={`pill ${view === 'suggestions' ? "solid" : "ghost"}`} 
          onClick={() => navigate('/suggestions')}
        >
          Suggerimenti💡
        </button>
        <button 
          className={`pill ${view === "archive" ? "solid" : "ghost"}`} 
          onClick={() => { navigate("/archivio"); resetSelection(); }}
        >
          Archivio
        </button>
        <button 
          className={`pill ${view === "ranking" ? "solid" : "ghost"}`} 
          onClick={() => { navigate("/classifica"); resetSelection(); }}
        >
          Classifica 🏆
        </button>

        {session && (
          <div className="user-menu desktop-only" ref={menuRefDesktop}>
            <button
              type="button"
            className={`user-menu-button ${isMenuOpen ? "open" : ""} ${(view === "profile" || view === "list" || view === "admin") ? "active" : ""}`}
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
                  onClick={() => handleMenuNavigate("/profile")}
                >
                  Profilo
                </button>
                <button
                  type="button"
                  className="user-menu-item"
                  role="menuitem"
                  onClick={() => handleMenuNavigate("/list")}
                >
                  La mia Lista
                </button>
                {isAdmin && (
                  <button
                    type="button"
                    className="user-menu-item"
                    role="menuitem"
                    onClick={() => handleMenuNavigate("/admin")}
                  >
                    Admin Dashboard
                  </button>
                )}
                <button
                  type="button"
                  className="user-menu-item"
                  role="menuitem"
                  onClick={() => { setIsMenuOpen(false); onShowUpdates(); }}
                >
                  Novità
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
            onClick={() => { navigate("/auth"); resetSelection(); }}
          >
            Accedi
          </button>
        )}
      </div>
    </nav>
  );
}
