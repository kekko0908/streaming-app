import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useStore } from "../hooks/useStore";
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

const COLORS = ['#4ae8ff', '#ff1744', '#ffd700', '#00e676', '#d500f9']; 

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
        const [statsData, userData] = await Promise.all([
           fetchStats(),
           supabase.auth.getUser()
        ]);
        setStats(statsData);
        setUser(userData.data.user);
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
    const { data } = await supabase.auth.updateUser({ data: { avatar_url: url } });
    setUser(data.user);
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
        await supabase.from('saved_items').delete().eq('user_id', user.id);
        setShowResetConfirmationModal(false);
        setShowSettingsModal(false);
        window.location.reload();
    }
  };

  // --- RENDER CONDIZIONALE (Loading/Error) ---
  if (loading) return <div style={{padding:50, textAlign:'center'}}>Caricamento...</div>;
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

  return (
    <div className="profile-container">
      
      {/* HEADER */}
      <header className="profile-header">
        <button className="settings-btn" onClick={() => setShowSettingsModal(true)}>
          ⚙️ Impostazioni
        </button>

        <div className="avatar-wrapper" onClick={() => setShowAvatarModal(true)}>
           <img src={avatarUrl} alt="Avatar" className="profile-avatar" />
           <div className="avatar-edit-icon">✏️</div>
        </div>

        <h1>Il tuo Profilo</h1>
        <div className="member-since">
            MEMBRO DA {new Date(user.created_at).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}
        </div>
      </header>

      {/* RANK CARD */}
      <div className="rank-card">
         <span className="rank-pill">{getRank(totalHours)}</span>
         <p style={{marginTop: 15, color: '#ccc'}}>Hai guardato un totale di <b>{totalHours} ore</b> di contenuti.</p>
      </div>

      {/* STATS GRID */}
      <div className="stats-row">
         <div className="stat-card">
            <span className="stat-number">{totalHours}</span>
            <span className="stat-label">ORE TOTALI</span>
         </div>
         <div className="stat-card">
            <span className="stat-number">{movieHours}</span>
            <span className="stat-label">ORE FILM</span>
         </div>
         <div className="stat-card">
            <span className="stat-number">{tvHours}</span>
            <span className="stat-label">ORE SERIE TV</span>
         </div>
      </div>

      {/* CHART CARD */}
      <div className="chart-card">
         <div className="doughnut-chart" style={{ background: gradientString }}>
            <div className="doughnut-hole"></div>
         </div>
         <div className="chart-legend">
            <span className="legend-title">GENERI PREFERITI</span>
            {gradientParts.map((p, i) => (
               <div key={i} className="legend-item">
                  <span className="dot" style={{background: p.color}} />
                  <span>{p.genre} ({p.percent}%)</span>
               </div>
            ))}
            {gradientParts.length === 0 && <span style={{color:'#666'}}>Nessun dato disponibile.</span>}
         </div>
      </div>

      {/* --- MODALE AVATAR --- */}
      {showAvatarModal && (
        <div className="modal-overlay" onClick={() => setShowAvatarModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
               <h3>Scegli Avatar</h3>
               <button className="close-btn" onClick={() => setShowAvatarModal(false)}>×</button>
            </div>
            <div className="avatar-grid">
               {AVATAR_OPTIONS.map((url, i) => (
                  <img key={i} src={url} className="avatar-option" onClick={() => handleUpdateAvatar(url)} alt="Avatar Option" />
               ))}
            </div>
          </div>
        </div>
      )}

      {/* --- MODALE IMPOSTAZIONI --- */}
      {showSettingsModal && (
        <div className="modal-overlay" onClick={() => setShowSettingsModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
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
                 className="form-input" 
               />
               <button 
                 className="action-btn btn-primary" 
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
                <button className="action-btn btn-danger" onClick={handleResetClick}>
                   RESETTA TUTTE LE STATISTICHE
                </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODALE CONFERMA RESET (2° LIVELLO) --- */}
      {showResetConfirmationModal && (
        <div className="modal-overlay" style={{zIndex: 10000}}>
            <div className="modal-content reset-confirmation-modal" onClick={e => e.stopPropagation()}>
                <h3>Sei assolutamente sicuro?</h3>
                <p>
                    Stai per cancellare <b>definitivamente</b> tutti i tuoi progressi, la tua lista "Da Vedere" e il tuo rango attuale ({getRank(totalHours)}).<br/><br/>
                    Non potrai tornare indietro.
                </p>
                <div className="modal-actions">
                    <button className="action-btn btn-secondary" onClick={() => setShowResetConfirmationModal(false)}>
                        Annulla
                    </button>
                    <button className="action-btn btn-danger" onClick={confirmResetStats} disabled={actionLoading}>
                        {actionLoading ? "Cancellazione..." : "Sì, cancella tutto"}
                    </button>
                </div>
            </div>
        </div>
      )}

    </div>
  );
}