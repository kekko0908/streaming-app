import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "../css/navbar.css";
import { Session } from "@supabase/supabase-js";
import { supabase } from "../supabaseClient";
import { Icon } from "./ui/Icon";
import { ReleaseNotificationMessage } from "../hooks/useReleaseNotifications";

interface NavbarProps {
  clearSelected: () => void;
  query: string;
  setQuery: (q: string) => void;
  onSearch: () => void;
  session: Session | null;
  onLogout: () => void;
  onShowUpdates: () => void;
  isAdmin: boolean;
  releaseNotifications: ReleaseNotificationMessage[];
  releaseNotificationsUnread: ReleaseNotificationMessage[];
  releaseNotificationsUnreadCount: number;
  onReleaseNotificationRead: (message: ReleaseNotificationMessage) => void;
  onReleaseNotificationsOpen: () => void;
  onDisableReleaseNotification: (item: ReleaseNotificationMessage["item"]) => void;
}

const DEFAULT_AVATAR = "https://api.dicebear.com/7.x/adventurer/svg?seed=Default";

export default function Navbar({ 
  clearSelected,
  query,
  setQuery,
  onSearch,
  session,
  onLogout,
  onShowUpdates,
  isAdmin,
  releaseNotifications,
  releaseNotificationsUnread,
  releaseNotificationsUnreadCount,
  onReleaseNotificationRead,
  onReleaseNotificationsOpen,
  onDisableReleaseNotification,
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
    "/calendario": "calendar",
  };
  let view = path === "/" || isDetailRoute ? "home" : routeViewMap[path] || path.substring(1);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [releaseToast, setReleaseToast] = useState<ReleaseNotificationMessage | null>(null);
  const dismissedReleaseToastIdsRef = useRef<Set<string>>(new Set());
  const menuRefDesktop = useRef<HTMLDivElement | null>(null);
  const menuRefMobile = useRef<HTMLDivElement | null>(null);
  const notificationsRefDesktop = useRef<HTMLDivElement | null>(null);
  const notificationsRefMobile = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

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
      const isInsideNotifications =
        notificationsRefDesktop.current?.contains(target) ||
        notificationsRefMobile.current?.contains(target);
      const isInsideSearch = searchRef.current?.contains(target);
      if (!isInsideDesktop && !isInsideMobile) setIsMenuOpen(false);
      if (!isInsideNotifications) setIsNotificationsOpen(false);
      if (!isInsideSearch && !query.trim()) setIsSearchOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
        setIsNotificationsOpen(false);
        setIsSearchOpen(false);
      }
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
    setIsNotificationsOpen(false);
    setIsSearchOpen(false);
  }, [location, session]);

  useEffect(() => {
    const unreadIds = new Set(releaseNotificationsUnread.map((notification) => notification.id));
    for (const dismissedId of dismissedReleaseToastIdsRef.current) {
      if (!unreadIds.has(dismissedId)) dismissedReleaseToastIdsRef.current.delete(dismissedId);
    }

    if (releaseToast) return;

    const nextToast = releaseNotificationsUnread.find(
      (notification) => !dismissedReleaseToastIdsRef.current.has(notification.id)
    );
    if (nextToast) {
      setReleaseToast(nextToast);
      onReleaseNotificationRead(nextToast);
      return;
    }
    setReleaseToast(null);
  }, [releaseNotificationsUnread, releaseToast, onReleaseNotificationRead]);

  useEffect(() => {
    if (!releaseToast) return;
    const timer = window.setTimeout(() => {
      dismissedReleaseToastIdsRef.current.add(releaseToast.id);
      setReleaseToast(null);
    }, 9000);
    return () => window.clearTimeout(timer);
  }, [releaseToast]);

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
    clearSelected();
    setIsMenuOpen(false);
  };

  const handleLogoutClick = () => {
    setIsMenuOpen(false);
    setIsNotificationsOpen(false);
    onLogout();
  };

  const toggleNotifications = () => {
    setIsNotificationsOpen((prev) => {
      const next = !prev;
      if (next) {
        setIsMenuOpen(false);
        setReleaseToast(null);
        onReleaseNotificationsOpen();
      }
      return next;
    });
  };

  const openNotificationsFromToast = () => {
    setIsMenuOpen(false);
    setIsSearchOpen(false);
    setIsNotificationsOpen(true);
    setReleaseToast(null);
    onReleaseNotificationsOpen();
  };

  const dismissReleaseToast = () => {
    if (releaseToast) dismissedReleaseToastIdsRef.current.add(releaseToast.id);
    setReleaseToast(null);
  };

  const openSearch = () => {
    setIsSearchOpen(true);
    window.setTimeout(() => searchInputRef.current?.focus(), 0);
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      onSearch();
      navigate("/");
      return;
    }
    if (event.key === "Escape" && !query.trim()) {
      setIsSearchOpen(false);
    }
  };

  return (
    <nav className="nav">
      <div className="nav-left">
        {/* LOGO */}
        <div className="logo" onClick={() => handleMenuNavigate("/")}>
         <img src="/logo.png" alt="SFA Logo" className="logo-img" width="60" height="60" loading="eager" decoding="async" />
          <div>
            <div className="logo-title">Streaming For All</div>
            <div className="logo-sub">Cinema a casa tua</div>
          </div>
        </div>

        {/* BARRA DI RICERCA MOBILE */}
        <div className="nav-search-container mobile-search">
          <input 
            className="nav-search-input"
            placeholder="Cerca film, serie..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
          />
        </div>

        {session && (
          <div className="release-notifications mobile-only" ref={notificationsRefMobile}>
            <button
              type="button"
              className={`notification-button ${isNotificationsOpen ? "open" : ""} ${releaseNotificationsUnreadCount > 0 ? "has-unread" : ""}`}
              onClick={toggleNotifications}
              aria-label="Notifiche uscite"
              aria-expanded={isNotificationsOpen}
            >
              <Icon name="bell" size={20} />
              {releaseNotificationsUnreadCount > 0 && <span className="notification-badge">{releaseNotificationsUnreadCount}</span>}
            </button>
            {isNotificationsOpen && (
              <NotificationsPanel
                notifications={releaseNotifications}
                onDisable={onDisableReleaseNotification}
              />
            )}
          </div>
        )}

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
              <span className="user-avatar-fallback"><Icon name="menu" size={20} /></span>
            )}
          </button>

          {isMenuOpen && (
            <div className="user-menu-dropdown" role="menu">
              <button className="user-menu-item" onClick={() => handleMenuNavigate("/")}>Home</button>
              <button className="user-menu-item" onClick={() => handleMenuNavigate("/suggestions")}>Suggerimenti <Icon name="lightbulb" size={16} /></button>
              <button className="user-menu-item" onClick={() => handleMenuNavigate("/archivio")}>Archivio</button>
              <button className="user-menu-item" onClick={() => handleMenuNavigate("/classifica")}>Classifica <Icon name="trophy" size={16} /></button>
              <button className="user-menu-item" onClick={() => handleMenuNavigate("/calendario")}>Calendario uscite <Icon name="calendar" size={16} /></button>
              
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

      <div className="nav-center">
      <div className="nav-links">
        <button 
          className={`pill ${view === "home" ? "solid" : "ghost"}`} 
          onClick={() => handleMenuNavigate("/")}
        >
          Home
        </button>
        <button 
          className={`pill ${view === 'suggestions' ? "solid" : "ghost"}`} 
          onClick={() => handleMenuNavigate('/suggestions')}
        >
          Suggerimenti <Icon name="lightbulb" size={16} />
        </button>
        <button 
          className={`pill ${view === "archive" ? "solid" : "ghost"}`} 
          onClick={() => handleMenuNavigate("/archivio")}
        >
          Archivio
        </button>
        <button 
          className={`pill ${view === "ranking" ? "solid" : "ghost"}`} 
          onClick={() => handleMenuNavigate("/classifica")}
        >
          Classifica <Icon name="trophy" size={16} />
        </button>
        <button
          className={`pill ${view === "calendar" ? "solid" : "ghost"}`}
          onClick={() => handleMenuNavigate("/calendario")}
        >
          Calendario <Icon name="calendar" size={16} />
        </button>
      </div>
      </div>

      <div className="nav-right">
        <div className={`nav-search-container desktop-search ${isSearchOpen || query.trim() ? "open" : ""}`} ref={searchRef}>
          <input
            ref={searchInputRef}
            className="nav-search-input"
            placeholder="Cerca film, serie..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsSearchOpen(true)}
            onKeyDown={handleSearchKeyDown}
            tabIndex={isSearchOpen || query.trim() ? 0 : -1}
          />
          <button
            type="button"
            className="search-toggle-button"
            onClick={openSearch}
            aria-label="Cerca"
            aria-expanded={isSearchOpen}
          >
            <Icon name="search" size={20} />
          </button>
        </div>
        {session && (
          <>
          <div className="release-notifications desktop-only" ref={notificationsRefDesktop}>
            <button
              type="button"
              className={`notification-button ${isNotificationsOpen ? "open" : ""} ${releaseNotificationsUnreadCount > 0 ? "has-unread" : ""}`}
              onClick={toggleNotifications}
              aria-label="Notifiche uscite"
              aria-expanded={isNotificationsOpen}
            >
              <Icon name="bell" size={20} />
              {releaseNotificationsUnreadCount > 0 && <span className="notification-badge">{releaseNotificationsUnreadCount}</span>}
            </button>
            {isNotificationsOpen && (
              <NotificationsPanel
                notifications={releaseNotifications}
                onDisable={onDisableReleaseNotification}
              />
            )}
          </div>
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
          </>
        )}
        {/* LOGICA BOTTONI UTENTE LOGGATO */}
        {!session && (
          <button 
            className="pill solid login-pill"
            onClick={() => handleMenuNavigate("/auth")}
          >
            Accedi
          </button>
        )}
      </div>

      {releaseToast && (
        <div className="release-toast" role="status" aria-live="polite">
          <img src={releaseToast.item.poster || "https://via.placeholder.com/80x120"} alt="" />
          <div className="release-toast-copy">
            <span>{releaseToast.phase === "released" ? "Nuova uscita" : "Avviso aggiornato"}</span>
            <strong>{releaseToast.title}</strong>
            <p>{releaseToast.message}</p>
          </div>
          <button type="button" className="release-toast-open" onClick={openNotificationsFromToast}>
            Apri
          </button>
          <button
            type="button"
            className="release-toast-close"
            onClick={dismissReleaseToast}
            aria-label="Chiudi notifica"
          >
            <Icon name="x" size={14} />
          </button>
        </div>
      )}
    </nav>
  );
}

function NotificationsPanel({
  notifications,
  onDisable,
}: {
  notifications: ReleaseNotificationMessage[];
  onDisable: (item: ReleaseNotificationMessage["item"]) => void;
}) {
  return (
    <div className="notifications-panel" role="dialog" aria-label="Notifiche uscite">
      <div className="notifications-panel-header">
        <div>
          <span>Avvisi uscite</span>
          <strong>{notifications.length}</strong>
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="notifications-empty">
          <Icon name="bell-off" size={22} />
          <p>Nessuna campanella attiva.</p>
        </div>
      ) : (
        <div className="notifications-list">
          {notifications.map((notification) => (
            <article key={notification.id} className={`notification-row ${notification.kind} ${notification.unread ? "unread" : ""} ${notification.phase === "released" ? "released" : ""}`}>
              <img src={notification.item.poster || "https://via.placeholder.com/80x120"} alt={notification.title} />
              <div>
                <span>{notification.meta}</span>
                <strong>{notification.title}</strong>
                <p>{notification.message}</p>
              </div>
              <button
                type="button"
                className="notification-dismiss"
                onClick={() => onDisable(notification.item)}
                aria-label={`Disattiva notifiche per ${notification.title}`}
                title="Disattiva notifiche"
              >
                <Icon name="x" size={15} />
              </button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
