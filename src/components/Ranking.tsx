import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import "../css/ranking.css";

type TimeRange = 'week' | 'month' | 'all';

interface RankingUser {
  username: string;
  avatar_url: string;
  total_minutes: number;
  rank: number;
}

export default function Ranking() {
  const [range, setRange] = useState<TimeRange>('all');
  const [users, setUsers] = useState<RankingUser[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchRanking();
  }, [range]);

  const fetchRanking = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('get_ranking', { time_range: range });
    if (!error && data) {
      setUsers(data);
    } else {
      console.error(error);
    }
    setLoading(false);
  };

  // --- FUNZIONE DI MASCHERAMENTO NOME ---
  const formatUserName = (name: string) => {
    if (!name) return "Utente SFA";
    
    // Se è un'email, prendi i primi 3 caratteri e aggiungi ***
    if (name.includes("@")) {
        const parts = name.split("@");
        const prefix = parts[0].substring(0, 3);
        return `${prefix}***`;
    }
    
    // Se è un username normale, taglialo se troppo lungo
    return name.length > 12 ? name.substring(0, 10) + "..." : name;
  };

  const formatHours = (mins: number) => {
    const h = Math.floor(mins / 60);
    return `${h}h`;
  };

  const getLevel = (mins: number) => {
    const h = Math.floor(mins / 60);
    if (h > 500) return "👑 Divinità";
    if (h > 200) return "🎬 Cinefilo";
    if (h > 50) return "🍿 Appassionato";
    return "👀 Spettatore";
  };

  const top3 = users.slice(0, 3);
  const rest = users.slice(3);

  const first = top3[0];
  const second = top3[1];
  const third = top3[2];

  return (
    <div className="ranking-container">
      <div className="ranking-header">
        <h1>Classifica Spettatori</h1>
        <p style={{color:'#aaa'}}>Chi ha passato più tempo davanti allo schermo?</p>
        
        <div className="ranking-tabs">
          <button className={`rank-tab ${range === 'week' ? 'active' : ''}`} onClick={() => setRange('week')}>Settimanale</button>
          <button className={`rank-tab ${range === 'month' ? 'active' : ''}`} onClick={() => setRange('month')}>Mensile</button>
          <button className={`rank-tab ${range === 'all' ? 'active' : ''}`} onClick={() => setRange('all')}>Totale</button>
        </div>
      </div>

      {loading ? (
        <div style={{textAlign:'center', padding:50}}>Caricamento classifica...</div>
      ) : (
        <>
          {/* PODIO TOP 3 */}
          {users.length > 0 && (
            <div className="podium-container">
              
              {/* 2° POSTO */}
              {second && (
                <div className="podium-place second">
                  <div className="podium-avatar-wrapper">
                    <img src={second.avatar_url} alt="User" className="podium-avatar" />
                    <div className="rank-badge">2</div>
                  </div>
                  {/* Nome Mascherato */}
                  <div className="podium-name">{formatUserName(second.username)}</div>
                  <div className="podium-hours">{formatHours(second.total_minutes)}</div>
                </div>
              )}

              {/* 1° POSTO */}
              {first && (
                <div className="podium-place first">
                  <div className="crown">👑</div>
                  <div className="podium-avatar-wrapper">
                    <img src={first.avatar_url} alt="User" className="podium-avatar" />
                    <div className="rank-badge">1</div>
                  </div>
                  {/* Nome Mascherato */}
                  <div className="podium-name">{formatUserName(first.username)}</div>
                  <div className="podium-hours" style={{background:'#ffd700', color:'#000', fontWeight:'bold'}}>
                    {formatHours(first.total_minutes)}
                  </div>
                </div>
              )}

              {/* 3° POSTO */}
              {third && (
                <div className="podium-place third">
                  <div className="podium-avatar-wrapper">
                    <img src={third.avatar_url} alt="User" className="podium-avatar" />
                    <div className="rank-badge">3</div>
                  </div>
                  {/* Nome Mascherato */}
                  <div className="podium-name">{formatUserName(third.username)}</div>
                  <div className="podium-hours">{formatHours(third.total_minutes)}</div>
                </div>
              )}
            </div>
          )}

          {/* LISTA DAL 4° IN POI */}
          <div className="ranking-list">
            {rest.map((u) => (
              <div key={u.rank} className="ranking-item">
                <div className="rank-number">{u.rank}</div>
                <img src={u.avatar_url} alt="User" className="list-avatar" />
                <div className="list-info">
                  {/* Nome Mascherato */}
                  <div className="list-name">{formatUserName(u.username)}</div>
                  <div className="list-level">{getLevel(u.total_minutes)}</div>
                </div>
                <div className="list-stats">
                  <div className="hours-big">{formatHours(u.total_minutes)}</div>
                  <div className="hours-label">ore totali</div>
                </div>
              </div>
            ))}
            
            {users.length === 0 && <p style={{textAlign:'center', color:'#666'}}>Nessun dato per questo periodo.</p>}
          </div>
        </>
      )}
    </div>
  );
}