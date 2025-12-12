import { useEffect, useState } from "react";
import "../css/profile.css";
import { useStore } from "../hooks/useStore";

export default function Profile() {
  const { fetchStats } = useStore();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchStats();
        setStats(data);
      } catch (e) {
        console.error("Errore profilo", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <div style={{textAlign:'center', padding:'100px', color:'white'}}>Caricamento statistiche...</div>;
  
  if (!stats) return (
    <div style={{textAlign:'center', padding:'100px', color:'white'}}>
        <h2>Impossibile caricare il profilo.</h2>
        <p>Assicurati di aver eseguito lo script SQL su Supabase.</p>
    </div>
  );

  // Calcoli
  const totalMinutes = (stats.movie_minutes || 0) + (stats.tv_minutes || 0);
  const totalHours = Math.floor(totalMinutes / 60);
  const movieHours = Math.floor((stats.movie_minutes || 0) / 60);
  const tvHours = Math.floor((stats.tv_minutes || 0) / 60);

  // Livello
  let level = "Spettatore Occasionale";
  if (totalHours > 10) level = "Cinefilo Novizio";
  if (totalHours > 50) level = "Binge Watcher";
  if (totalHours > 200) level = "Maestro dello Streaming";
  if (totalHours > 500) level = "Divinità del Divano";

  // Grafico
  const genres = stats.genres || {};
  const totalGenresCount = Object.values(genres).reduce((a: any, b: any) => a + b, 0) as number;
  const colors = ["#4ae8ff", "#ff0050", "#ffd700", "#00e676", "#aa00ff"];
  
  let currentDeg = 0;
  const gradientParts = Object.entries(genres).map(([genre, count], index) => {
    const percent = ((count as number) / totalGenresCount) * 100;
    const deg = (percent / 100) * 360;
    const color = colors[index % colors.length];
    const segment = `${color} ${currentDeg}deg ${currentDeg + deg}deg`;
    currentDeg += deg;
    return { segment, color, genre, percent: Math.round(percent) };
  });

  const gradientString = gradientParts.length > 0 
    ? `conic-gradient(${gradientParts.map(p => p.segment).join(', ')})` 
    : 'gray';

  return (
    <div className="profile-container">
      <header className="profile-header">
        <h1>Il tuo Profilo</h1>
        <div className="member-since">Membro da {stats.joinDate}</div>
      </header>

      <section className="level-section">
        <div className="level-badge">{level}</div>
        <p className="level-desc">Hai guardato un totale di <strong>{totalHours} ore</strong> di contenuti.</p>
      </section>

      <div className="stats-grid">
        <div className="stat-card highlight">
           <div className="stat-value">{totalHours}</div>
           <div className="stat-label">Ore Totali</div>
        </div>
        <div className="stat-card">
           <div className="stat-value">{movieHours}</div>
           <div className="stat-label">Ore Film</div>
        </div>
        <div className="stat-card">
           <div className="stat-value">{tvHours}</div>
           <div className="stat-label">Ore Serie TV</div>
        </div>
      </div>

      {totalGenresCount > 0 && (
        <section className="chart-section">
           <div className="pie-chart" style={{ background: gradientString }} />
           <div className="chart-legend">
              <h3 className="eyebrow" style={{marginBottom:'10px', color:'white'}}>Generi Preferiti</h3>
              {gradientParts.map((p, i) => (
                 <div key={i} className="legend-item">
                    <span className="color-dot" style={{background: p.color}} />
                    <span>{p.genre} ({p.percent}%)</span>
                 </div>
              ))}
           </div>
        </section>
      )}
    </div>
  );
}