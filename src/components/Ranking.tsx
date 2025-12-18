/* src/components/Ranking.tsx */
import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import "../css/ranking.css";

// Tipi di classifica
type RankingType = 'time' | 'avg_rating' | 'planned';
type TimeRange = 'week' | 'month' | 'all';

interface RankingUser {
  username: string;
  avatar_url: string;
  score: number; // Può essere minuti, voto medio o numero items
  rank: number;
}

// Configurazione delle categorie
const CATEGORIES = {
  time: {
    id: 'time' as RankingType,
    label: "Divano d'Oro",
    icon: "⏱️",
    desc: "La classica gara di resistenza. Chi ha passato più tempo davanti allo schermo sommando la durata di film e serie TV completate?",
    unitLabel: "ore totali",
    format: (val: number) => `${Math.floor(val / 60)}h` // Minuti -> Ore
  },
  avg_rating: {
    id: 'avg_rating' as RankingType,
    label: "Il Critico",
    icon: "⚖️",
    desc: "Chi è il più severo o il più generoso? Questa classifica mostra il punteggio medio dei voti assegnati. (Minimo 5 voti per entrare in classifica)",
    unitLabel: "voto medio",
    format: (val: number) => val.toFixed(1) // Es: 8.5
  },
  planned: {
    id: 'planned' as RankingType,
    label: "Il Pianificatore",
    icon: "📅",
    desc: "L'Hype Rank! Chi ha la lista d'attesa più lunga? Questi utenti hanno pianificato o messo in 'Da Guardare' una montagna di titoli.",
    unitLabel: "in lista",
    format: (val: number) => `${val}` // Numero intero
  }
};

export default function Ranking() {
  const [currentType, setCurrentType] = useState<RankingType>('time');
  const [range, setRange] = useState<TimeRange>('all');
  const [users, setUsers] = useState<RankingUser[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchRanking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, currentType]);

  const fetchRanking = async () => {
    setLoading(true);
    let rpcName = '';

    // Mappiamo il tipo di classifica alla funzione SQL corretta
    switch (currentType) {
        case 'avg_rating':
            rpcName = 'get_ranking_avg_rating'; 
            break;
        case 'planned':
            rpcName = 'get_ranking_planned'; 
            break;
        case 'time':
        default:
            rpcName = 'get_ranking'; // La funzione originale per il tempo
            break;
    }

    try {
        // Passiamo sempre time_range, anche se per alcune (es. planned) potrebbe essere ignorato dalla SQL se non serve
        const { data, error } = await supabase.rpc(rpcName, { time_range: range });

        if (error) throw error;

        if (data) {
            // Normalizziamo i dati in arrivo
            const mappedData = data.map((u: any) => ({
                username: u.username,
                avatar_url: u.avatar_url,
                // Il campo del valore può chiamarsi diversamente nelle varie RPC
                score: u.total_minutes ?? u.avg_score ?? u.item_count ?? 0,
                rank: u.rank
            }));
            setUsers(mappedData);
        }
    } catch (err) {
        console.error("Errore classifica:", err);
        // Fallback vuoto per evitare crash
        setUsers([]); 
    } finally {
        setLoading(false);
    }
  };

  const formatUserName = (name: string) => {
    if (!name) return "Utente SFA";
    if (name.includes("@")) return name.split("@")[0].substring(0, 3) + "***";
    return name.length > 12 ? name.substring(0, 10) + "..." : name;
  };

  const getLevelLabel = (score: number) => {
    if (currentType === 'time') {
        const h = Math.floor(score / 60);
        if (h > 500) return "👑 Divinità";
        if (h > 200) return "🎬 Cinefilo";
        return "👀 Spettatore";
    }
    if (currentType === 'avg_rating') {
        if (score >= 9) return "💖 Cuore d'Oro";
        if (score >= 7) return "⚖️ Equilibrato";
        if (score > 0 && score < 5) return "🔪 Spietato";
        return "🖊️ Recensore";
    }
    if (currentType === 'planned') {
        if (score > 100) return "🔮 Visionario";
        if (score > 50) return "📝 Organizzato";
        return "curioso";
    }
    return "";
  };

  const activeConfig = CATEGORIES[currentType];
  const top3 = users.slice(0, 3);
  const rest = users.slice(3);
  const [first, second, third] = top3;

  return (
    <div className="ranking-container">
      <div className="ranking-header">
        <h1>Classifiche</h1>
        
        {/* MENU CATEGORIE */}
        <div className="ranking-categories">
            {Object.values(CATEGORIES).map((cat) => (
                <button 
                    key={cat.id}
                    className={`category-btn ${currentType === cat.id ? 'active' : ''}`}
                    onClick={() => setCurrentType(cat.id)}
                >
                    <span>{cat.icon}</span> {cat.label}
                </button>
            ))}
        </div>

        {/* DESCRIZIONE BOX */}
        <div className="ranking-description">
            {activeConfig.desc}
        </div>
        
        {/* FILTRI TEMPO (Ha senso nasconderli per "Pianificatore" se è una lista statica, ma lo lasciamo per coerenza) */}
        <div className="ranking-tabs">
          <button className={`rank-tab ${range === 'week' ? 'active' : ''}`} onClick={() => setRange('week')}>Settimanale</button>
          <button className={`rank-tab ${range === 'month' ? 'active' : ''}`} onClick={() => setRange('month')}>Mensile</button>
          <button className={`rank-tab ${range === 'all' ? 'active' : ''}`} onClick={() => setRange('all')}>Totale</button>
        </div>
      </div>

      {loading ? (
        <div style={{textAlign:'center', padding:50, color: '#4ae8ff'}}>Caricamento dati...</div>
      ) : (
        <>
          {users.length > 0 ? (
            <div className="podium-container">
              
              {/* 2° POSTO */}
              {second && (
                <div className="podium-place second">
                  <div className="podium-avatar-wrapper">
                    <img src={second.avatar_url} alt="User" className="podium-avatar" />
                    <div className="rank-badge">2</div>
                  </div>
                  <div className="podium-name">{formatUserName(second.username)}</div>
                  <div className="podium-score">
                      {activeConfig.format(second.score)} {currentType === 'planned' ? 'titoli' : ''}
                  </div>
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
                  <div className="podium-name">{formatUserName(first.username)}</div>
                  <div className="podium-score">
                    {activeConfig.format(first.score)} {currentType === 'planned' ? 'titoli' : ''}
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
                  <div className="podium-name">{formatUserName(third.username)}</div>
                  <div className="podium-score">
                      {activeConfig.format(third.score)} {currentType === 'planned' ? 'titoli' : ''}
                  </div>
                </div>
              )}
            </div>
          ) : (
             <div style={{textAlign:'center', padding: 40, color:'#666', border: '1px dashed #333', borderRadius: 10}}>
                Nessun dato trovato per questa classifica.
             </div>
          )}

         {/* LISTA DAL 4° IN POI */}
          <div className="ranking-list">
            {rest.map((u, index) => (
              <div key={index} className="ranking-item">
                {/* CORREZIONE QUI:
                   Invece di usare {u.rank}, calcoliamo il numero manualmente.
                   Siccome 'rest' parte dopo i primi 3, il primo elemento è il 4°.
                   Quindi: index (0) + 4 = 4.
                */}
                <div className="rank-number">{index + 4}</div>
                
                <img src={u.avatar_url} alt="User" className="list-avatar" />
                <div className="list-info">
                  <div className="list-name">{formatUserName(u.username)}</div>
                  <div className="list-desc">{getLevelLabel(u.score)}</div>
                </div>
                <div className="list-stats">
                  <div className="score-big">{activeConfig.format(u.score)}</div>
                  <div className="score-label">{activeConfig.unitLabel}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}