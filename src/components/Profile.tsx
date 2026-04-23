import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useStore } from "../hooks/useStore";
import { motion, Variants } from "framer-motion";
import "../css/profile.css";

// Avatar predefiniti
const AVATAR_OPTIONS = [
  "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=Aneka",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=Shadow",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=Kiki",
  "https://api.dicebear.com/7.x/bottts/svg?seed=C-3PO",
  "https://api.dicebear.com/7.x/bottts/svg?seed=R2D2",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Scooby",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Shaggy",
  "https://api.dicebear.com/9.x/avataaars/svg?seed=Wyatt",
  "https://api.dicebear.com/9.x/avataaars/svg?seed=Liam",
  "https://api.dicebear.com/9.x/avataaars/svg?seed=Oliver"
];

const COLORS = [
  '#4ae8ff', '#ff1744', '#ffd700', '#00e676', '#d500f9',
  '#ff3d00', '#00b0ff', '#1de9b6', '#f50057', '#76ff03',
  '#651fff', '#ffea00', '#00e5ff', '#ff9100', '#18ffff',
  '#b388ff', '#c6ff00', '#ff8a80', '#84ffff', '#ea80fc'
];

export default function Profile() {
  const { fetchStats } = useStore();
  
  // STATI DATI
  const [stats, setStats] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // STATI MODALI
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showResetConfirmationModal, setShowResetConfirmationModal] = useState(false);
  
  // STATI FORM
  const [newPassword, setNewPassword] = useState("");
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
            : { movie_minutes: 0, tv_minutes: 0, genres: {} };

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
    setActionLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    alert(error ? "Errore: " + error.message : "Password aggiornata!");
    setActionLoading(false);
    setNewPassword("");
  };

  // Click su "Resetta Statistiche" (Apre la conferma)
  const handleResetClick = () => {
    setShowResetConfirmationModal(true);
  };

  // Conferma finale Reset
  const confirmResetStats = async () => {
    setActionLoading(true);
    if (user && user.id) {
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
    const color = COLORS[index % COLORS.length];
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
            ⚙️ Impostazioni
          </button>

          <div className="avatar-wrapper" onClick={() => setShowAvatarModal(true)}>
             <img src={avatarUrl} alt="Avatar" className="profile-avatar" />
             <div className="avatar-edit-icon">✏️</div>
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
              <div className="stat-icon">🕒</div>
              <div className="stat-content">
                <span className="stat-number">{totalHours}</span>
                <span className="stat-label">ORE TOTALI</span>
              </div>
           </div>
           <div className="stat-card glass-panel stat-hover">
              <div className="stat-icon">🎬</div>
              <div className="stat-content">
                <span className="stat-number">{movieHours}</span>
                <span className="stat-label">ORE FILM</span>
              </div>
           </div>
           <div className="stat-card glass-panel stat-hover">
              <div className="stat-icon">📺</div>
              <div className="stat-content">
                <span className="stat-number">{tvHours}</span>
                <span className="stat-label">ORE SERIE TV</span>
              </div>
           </div>
        </motion.div>

        {/* CHART CARD */}
        <motion.div className="chart-card glass-panel" variants={itemVariants}>
           <div className="chart-visual">
             <div className="doughnut-chart" style={{ background: gradientString }}>
                <div className="doughnut-hole"></div>
             </div>
             <div className="chart-center-icon">✨</div>
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
                 placeholder="Nuova password..." 
                 value={newPassword} 
                 onChange={e => setNewPassword(e.target.value)} 
                 className="form-input glass-input" 
               />
               <button 
                 className="action-btn btn-primary glass-btn-primary" 
                 onClick={handleUpdatePassword} 
                 disabled={!newPassword || actionLoading}
               >
                  {actionLoading ? "..." : "Aggiorna Password"}
               </button>
            </div>

            {/* DANGER ZONE */}
            <div className="danger-zone">
                <span className="danger-title">⚠ Zona Pericolosa</span>
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
