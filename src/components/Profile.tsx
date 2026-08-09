import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useStore } from "../hooks/useStore";
import { motion, Variants } from "framer-motion";
import { ProfileStats } from "../types/profileStats";
import { AVATAR_OPTIONS, PROFILE_COLORS, emptyProfileStats } from "./profile/profileConstants";
import { getTmdbImageUrl } from "../utils/helper";
import { Icon } from "./ui/Icon";
import "../css/profile.css";

export default function Profile() {
  const { fetchStats } = useStore();
  
  // STATI DATI
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // STATI MODALI
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showResetConfirmationModal, setShowResetConfirmationModal] = useState(false);
  
  // STATI FORM
  const [newPassword, setNewPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [securityMessage, setSecurityMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // CARICAMENTO INIZIALE
  useEffect(() => {
    async function load() {
      try {
        const [statsResult, sessionResult, userResult] = await Promise.allSettled([
           fetchStats(),
           supabase.auth.getSession(),
           supabase.auth.getUser()
        ]);

        const statsData =
          statsResult.status === "fulfilled" && statsResult.value
            ? statsResult.value
            : emptyProfileStats;

        const sessionUser =
          sessionResult.status === "fulfilled"
            ? sessionResult.value.data.session?.user ?? null
            : null;

        const fetchedUser =
          userResult.status === "fulfilled"
            ? userResult.value.data.user ?? null
            : null;

        setStats(statsData);
        setUser(sessionUser || fetchedUser);
      } catch (e) {
        console.error("Errore profilo", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // --- HANDLERS AZIONI ---

 const handleUpdateAvatar = async (url: string) => {
    // 1. Aggiorna la tabella PROFILES (per la Community)
    if (user && user.id) {
        const { error } = await supabase
            .from('profiles')
            .upsert({ 
                id: user.id, 
                avatar_url: url,
                updated_at: new Date().toISOString()
            });
            
        if (error) {
            console.error("Errore salvataggio profilo:", error);
            alert("Errore nel salvataggio dell'avatar.");
            return;
        }
    }

    // 2. Aggiorna i metadati Auth (per la sessione locale veloce)
    const { data } = await supabase.auth.updateUser({ data: { avatar_url: url } });
    
    // 3. Aggiorna la UI
    if (data.user) {
        setUser(data.user);
    }
    setShowAvatarModal(false);
  };
  const handleUpdatePassword = async () => {
    setSecurityMessage(null);
    if (!currentPassword) {
      setSecurityMessage({ type: "error", text: "Inserisci la password attuale." });
      return;
    }
    if (newPassword.length < 12) {
      setSecurityMessage({ type: "error", text: "La nuova password deve avere almeno 12 caratteri." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setSecurityMessage({ type: "error", text: "Le nuove password non coincidono." });
      return;
    }
    setActionLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword, current_password: currentPassword });
    if (error) {
      setSecurityMessage({ type: "error", text: error.message });
    } else {
      await supabase.auth.signOut({ scope: "others" });
      setSecurityMessage({ type: "success", text: "Password aggiornata. Le altre sessioni sono state revocate." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
    setActionLoading(false);
  };

  const handleSessionLogout = async (scope: "local" | "global") => {
    setActionLoading(true);
    const { error } = await supabase.auth.signOut({ scope });
    if (error) {
      setSecurityMessage({ type: "error", text: error.message });
      setActionLoading(false);
      return;
    }
    window.location.assign("/auth");
  };

  // Click su "Resetta Statistiche" (Apre la conferma)
  const handleResetClick = () => {
    setShowResetConfirmationModal(true);
  };

  // Conferma finale Reset
  const confirmResetStats = async () => {
    setActionLoading(true);
    if (user && user.id) {
        await supabase.from('watch_events').delete().eq('user_id', user.id);
        await supabase.from('user_library').delete().eq('user_id', user.id);
        setShowResetConfirmationModal(false);
        setShowSettingsModal(false);
        window.location.reload();
    }
  };

  // --- RENDER CONDIZIONALE (Loading/Error) ---
  if (loading) {
      return (
          <div className="profile-loading">
              <div className="loader"></div>
              <p>Caricamento profilo...</p>
          </div>
      );
  }
  if (!stats || !user) return <div style={{padding:50, textAlign:'center'}}>Errore caricamento dati.</div>;

  // --- CALCOLI STATISTICHE ---
  const totalMinutes = (stats.movie_minutes || 0) + (stats.tv_minutes || 0);
  const totalHours = Math.floor(totalMinutes / 60);
  const movieHours = Math.floor((stats.movie_minutes || 0) / 60);
  const tvHours = Math.floor((stats.tv_minutes || 0) / 60);
  const advanced = stats.advanced_stats;
  const records = stats.personal_records;

  const formatMinutes = (minutes: number) => {
    if (!minutes) return "0h";
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    if (hours <= 0) return `${rest}m`;
    return rest > 0 ? `${hours}h ${rest}m` : `${hours}h`;
  };

  const formatRecordDate = (value: string) => {
    if (!value) return "Nessun dato";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Nessun dato";
    return date.toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
  };

  const getRank = (h: number) => {
    if (h > 500) return "DIVINITÀ DEL DIVANO";
    if (h > 200) return "CINEFILO ESPERTO";
    if (h > 50) return "APPASSIONATO";
    return "SPETTATORE CASUALE";
  };

  const genres = stats.genres || {};
  const totalGenresCount = Object.values(genres).reduce((a: any, b: any) => a + b, 0) as number;
  
  let currentDeg = 0;
  const gradientParts = Object.entries(genres).map(([genre, count], index) => {
    const percent = ((count as number) / totalGenresCount) * 100;
    const deg = (percent / 100) * 360;
    const color = PROFILE_COLORS[index % PROFILE_COLORS.length];
    const segment = `${color} ${currentDeg}deg ${currentDeg + deg}deg`;
    currentDeg += deg;
    return { segment, color, genre, percent: Math.round(percent) };
  });

  const gradientString = gradientParts.length > 0 
    ? `conic-gradient(${gradientParts.map(p => p.segment).join(', ')})` 
    : '#333';

  const avatarUrl = user.user_metadata?.avatar_url || "https://api.dicebear.com/7.x/adventurer/svg?seed=Default";

  // Framer Motion Variants
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.15, delayChildren: 0.1 }
    }
  };

  const itemVariants: Variants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { type: "spring", stiffness: 300, damping: 24 }
    }
  };

  return (
    <motion.div 
        className="profile-container"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
    >
      
      {/* HEADER COVER SECTION */}
      <motion.div className="profile-cover-section" variants={itemVariants}>
        <div className="profile-cover-bg"></div>
        <header className="profile-header">
          <button className="settings-btn glass-btn" onClick={() => setShowSettingsModal(true)}>
            <Icon name="settings" size={18} /> Impostazioni
          </button>

          <div className="avatar-wrapper" onClick={() => setShowAvatarModal(true)}>
             <img src={avatarUrl} alt="Avatar" className="profile-avatar" />
             <div className="avatar-edit-icon"><Icon name="edit" size={18} /></div>
          </div>

          <h1>Il tuo Profilo</h1>
          <div className="member-since">
              MEMBRO DA {new Date(user.created_at).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }).toUpperCase()}
          </div>
        </header>
      </motion.div>

      <div className="profile-dashboard">
        {/* RANK CARD */}
        <motion.div className="rank-card glass-panel" variants={itemVariants}>
           <div className="rank-glow-bg"></div>
           <span className="rank-pill">{getRank(totalHours)}</span>
           <p className="rank-desc">Hai esplorato mondi per un totale di <b>{totalHours} ore</b>.</p>
        </motion.div>

        {/* STATS GRID */}
        <motion.div className="stats-row" variants={itemVariants}>
           <div className="stat-card glass-panel stat-hover">
              <div className="stat-icon"><Icon name="clock" size={24} /></div>
              <div className="stat-content">
                <span className="stat-number">{totalHours}</span>
                <span className="stat-label">ORE TOTALI</span>
              </div>
           </div>
           <div className="stat-card glass-panel stat-hover">
              <div className="stat-icon"><Icon name="film" size={24} /></div>
              <div className="stat-content">
                <span className="stat-number">{movieHours}</span>
                <span className="stat-label">ORE FILM</span>
              </div>
           </div>
           <div className="stat-card glass-panel stat-hover">
              <div className="stat-icon"><Icon name="tv" size={24} /></div>
              <div className="stat-content">
                <span className="stat-number">{tvHours}</span>
                <span className="stat-label">ORE SERIE TV</span>
              </div>
           </div>
        </motion.div>

        <motion.section className="advanced-stats-section" variants={itemVariants}>
          <div className="profile-section-heading">
            <span className="section-kicker">Statistiche avanzate</span>
            <h2>La tua visione in numeri</h2>
          </div>

          <div className="advanced-stats-grid">
            <div className="advanced-stat-card">
              <span className="advanced-stat-label">Episodi visti</span>
              <strong>{advanced.episodes_total}</strong>
              <small>Totale serie TV tracciate</small>
            </div>
            <div className="advanced-stat-card">
              <span className="advanced-stat-label">Serie completate</span>
              <strong>{advanced.completed_series}</strong>
              <small>{advanced.active_series} ancora in corso</small>
            </div>
            <div className="advanced-stat-card">
              <span className="advanced-stat-label">Film visti</span>
              <strong>{advanced.watched_movies}</strong>
              <small>{advanced.library_total} titoli in libreria</small>
            </div>
            <div className="advanced-stat-card">
              <span className="advanced-stat-label">Da vedere</span>
              <strong>{advanced.watchlist_total}</strong>
              <small>Pianificati o in lista</small>
            </div>
            <div className="advanced-stat-card">
              <span className="advanced-stat-label">Voto medio</span>
              <strong>{Number(advanced.avg_rating || 0).toFixed(1)}</strong>
              <small>{advanced.rated_titles} titoli votati</small>
            </div>
            <div className="advanced-stat-card">
              <span className="advanced-stat-label">Rapporto visione</span>
              <strong>{advanced.movie_share_percent}% / {advanced.tv_share_percent}%</strong>
              <small>Film / Serie</small>
            </div>
          </div>

          <div className="highlight-stats-row">
            <div className="highlight-stat">
              {advanced.longest_series_poster && (
                <img
                  src={getTmdbImageUrl(advanced.longest_series_poster, "w342", "")}
                  alt={advanced.longest_series_title}
                  className="highlight-poster"
                />
              )}
              <div className="highlight-copy">
                <span>Serie piu lunga seguita</span>
                <strong>{advanced.longest_series_title || "Nessun dato"}</strong>
                <small>{advanced.longest_series_episodes} episodi</small>
              </div>
            </div>
            <div className="highlight-stat">
              {advanced.heaviest_poster && (
                <img
                  src={getTmdbImageUrl(advanced.heaviest_poster, "w342", "")}
                  alt={advanced.heaviest_title}
                  className="highlight-poster"
                />
              )}
              <div className="highlight-copy">
                <span>Titolo piu impegnativo</span>
                <strong>{advanced.heaviest_title || "Nessun dato"}</strong>
                <small>{formatMinutes(advanced.heaviest_minutes)}</small>
              </div>
            </div>
            <div className="highlight-stat">
              {advanced.longest_movie_poster && (
                <img
                  src={getTmdbImageUrl(advanced.longest_movie_poster, "w342", "")}
                  alt={advanced.longest_movie_title}
                  className="highlight-poster"
                />
              )}
              <div className="highlight-copy">
                <span>Film piu lungo visto</span>
                <strong>{advanced.longest_movie_title || "Nessun dato"}</strong>
                <small>{formatMinutes(advanced.longest_movie_minutes)}</small>
              </div>
            </div>
          </div>
        </motion.section>

        <motion.section className="records-section" variants={itemVariants}>
          <div className="profile-section-heading">
            <span className="section-kicker">Record personali</span>
            <h2>Binge watch e giornate intense</h2>
          </div>

          <div className="records-grid">
            <div className="record-card primary-record">
              <span className="record-label">Piu episodi in un giorno</span>
              <strong>{records.max_episodes_day}</strong>
              <small>{formatRecordDate(records.max_episodes_day_date)}</small>
            </div>
            <div className="record-card">
              <span className="record-label">Stessa serie in un giorno</span>
              <strong>{records.max_same_series_day}</strong>
              <small>{records.max_same_series_title || "Nessun dato"}</small>
            </div>
            <div className="record-card">
              <span className="record-label">Giorno piu intenso</span>
              <strong>{formatMinutes(records.max_minutes_day)}</strong>
              <small>{formatRecordDate(records.max_minutes_day_date)}</small>
            </div>
            <div className="record-card">
              <span className="record-label">Serie piu bingewatchata</span>
              <strong>{records.top_binge_series_episodes}</strong>
              <small>{records.top_binge_series_title || "Nessun dato"}</small>
            </div>
            <div className="record-card">
              <span className="record-label">Streak visione</span>
              <strong>{records.watch_streak_days}</strong>
              <small>giorni consecutivi</small>
            </div>
          </div>
        </motion.section>

        {/* CHART CARD */}
        <motion.div className="chart-card glass-panel" variants={itemVariants}>
           <div className="chart-visual">
             <div className="doughnut-chart" style={{ background: gradientString }}>
                <div className="doughnut-hole"></div>
             </div>
             <div className="chart-center-icon"><Icon name="sparkles" size={24} /></div>
           </div>
           <div className="chart-legend">
              <span className="legend-title">I TUOI GENERI PREFERITI</span>
              <div className="legend-grid">
                  {gradientParts.map((p, i) => (
                     <div key={i} className="legend-item">
                        <span className="dot" style={{background: p.color, boxShadow: `0 0 10px ${p.color}`}} />
                        <span className="legend-name">{p.genre}</span>
                        <span className="legend-percent" style={{color: p.color}}>{p.percent}%</span>
                     </div>
                  ))}
                  {gradientParts.length === 0 && <span style={{color:'#666'}}>Nessun dato disponibile.</span>}
              </div>
           </div>
        </motion.div>
      </div>

      {/* --- MODALE AVATAR --- */}
      {showAvatarModal && (
        <motion.div 
            className="modal-overlay" 
            onClick={() => setShowAvatarModal(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
        >
          <motion.div 
            className="modal-content glass-modal" 
            onClick={e => e.stopPropagation()}
            initial={{ y: 50, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
          >
            <div className="modal-header">
               <h3>Scegli Avatar</h3>
               <button className="close-btn" onClick={() => setShowAvatarModal(false)}>×</button>
            </div>
            <div className="avatar-grid">
               {AVATAR_OPTIONS.map((url, i) => (
                  <img key={i} src={url} className="avatar-option" onClick={() => handleUpdateAvatar(url)} alt="Avatar Option" />
               ))}
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* --- MODALE IMPOSTAZIONI --- */}
      {showSettingsModal && (
        <motion.div 
            className="modal-overlay" 
            onClick={() => setShowSettingsModal(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
        >
          <motion.div 
            className="modal-content glass-modal" 
            onClick={e => e.stopPropagation()}
            initial={{ y: 50, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
          >
            <div className="modal-header">
               <h3>Impostazioni Account</h3>
               <button className="close-btn" onClick={() => setShowSettingsModal(false)}>×</button>
            </div>
            
            <div className="form-group">
               <label>Cambia Password</label>
               <input
                 type="password"
                 placeholder="Password attuale"
                 value={currentPassword}
                 onChange={e => setCurrentPassword(e.target.value)}
                 className="form-input glass-input"
                 autoComplete="current-password"
               />
               <input 
                 type="password" 
                 placeholder="Nuova password (minimo 12 caratteri)"
                 value={newPassword} 
                 onChange={e => setNewPassword(e.target.value)} 
                 className="form-input glass-input" 
                 autoComplete="new-password"
                 minLength={12}
               />
               <input
                 type="password"
                 placeholder="Conferma nuova password"
                 value={confirmPassword}
                 onChange={e => setConfirmPassword(e.target.value)}
                 className="form-input glass-input"
                 autoComplete="new-password"
                 minLength={12}
               />
               {securityMessage && <p className={`security-inline-message ${securityMessage.type}`} role="status">{securityMessage.text}</p>}
               <button 
                 className="action-btn btn-primary glass-btn-primary" 
                 onClick={handleUpdatePassword} 
                 disabled={!currentPassword || newPassword.length < 12 || !confirmPassword || actionLoading}
               >
                  {actionLoading ? "..." : "Aggiorna Password"}
               </button>
            </div>

            <div className="form-group session-actions">
              <label>Sessioni</label>
              <p className="warning-text">Durata massima 7 giorni, inattività massima 24 ore su questo dispositivo.</p>
              <div className="session-action-buttons">
                <button className="action-btn glass-btn" disabled={actionLoading} onClick={() => handleSessionLogout("local")}>Esci da questo dispositivo</button>
                <button className="action-btn btn-danger glass-btn-danger" disabled={actionLoading} onClick={() => handleSessionLogout("global")}>Esci da tutti i dispositivi</button>
              </div>
            </div>

            {/* DANGER ZONE */}
            <div className="danger-zone">
                <span className="danger-title"><Icon name="warning" size={18} /> Zona Pericolosa</span>
                <p className="warning-text">
                    Questa azione è irreversibile. Cancellerà tutta la tua lista personale, i voti e azzererà le tue ore di visione.
                </p>
                <button className="action-btn btn-danger glass-btn-danger" onClick={handleResetClick}>
                   RESETTA TUTTE LE STATISTICHE
                </button>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* --- MODALE CONFERMA RESET (2° LIVELLO) --- */}
      {showResetConfirmationModal && (
        <motion.div 
            className="modal-overlay" 
            style={{zIndex: 10000}}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
        >
            <motion.div 
                className="modal-content reset-confirmation-modal glass-modal" 
                onClick={e => e.stopPropagation()}
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
            >
                <h3>Sei assolutamente sicuro?</h3>
                <p>
                    Stai per cancellare <b>definitivamente</b> tutti i tuoi progressi, la tua lista "Da Vedere" e il tuo rango attuale ({getRank(totalHours)}).<br/><br/>
                    Non potrai tornare indietro.
                </p>
                <div className="modal-actions">
                    <button className="action-btn btn-secondary glass-btn-secondary" onClick={() => setShowResetConfirmationModal(false)}>
                        Annulla
                    </button>
                    <button className="action-btn btn-danger glass-btn-danger" onClick={confirmResetStats} disabled={actionLoading}>
                        {actionLoading ? "Cancellazione..." : "Sì, cancella tutto"}
                    </button>
                </div>
            </motion.div>
        </motion.div>
      )}

    </motion.div>
  );
}
