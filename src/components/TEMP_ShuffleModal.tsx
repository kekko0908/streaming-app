import { TmdbItem } from "../types/types";
import "../css/shuffle.css";

interface ShuffleModalProps {
  item: TmdbItem;
  onPlay: () => void;
  onRetry: () => void;
  onClose: () => void;
}

export default function ShuffleModal({ item, onPlay, onRetry, onClose }: ShuffleModalProps) {
  
  const getPoster = () => {
    const path = item.poster;
    if (!path) return "https://via.placeholder.com/500x300";
    return `https://image.tmdb.org/t/p/w780${path}`;
  };

  return (
    <div className="shuffle-overlay" onClick={onClose}>
      <div className="shuffle-card" onClick={(e) => e.stopPropagation()}>
        
        <button className="close-shuffle" onClick={onClose}>✕</button>

        <img src={getPoster()} alt={item.title} className="shuffle-poster" />

        <div className="shuffle-content">
          <div className="shuffle-winner-badge">🎲 Scelto per te</div>
          
          <h2 className="shuffle-title">{item.title}</h2>
          
          <div className="shuffle-meta">
             <span>{item.year || "N/A"}</span>
             <span>{item.type === 'movie' ? 'Film' : 'Serie TV'}</span>
          </div>

          <p style={{fontSize:'0.9rem', color:'#ccc', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden'}}>
             {item.overview || "Nessuna trama disponibile."}
          </p>

          <div className="shuffle-actions">
             <button className="btn-shuffle-play" onClick={onPlay}>
               ▶ Guarda Ora
             </button>
             <button className="btn-shuffle-retry" onClick={onRetry} title="Pesca un altro">
               🎲
             </button>
          </div>
        </div>

      </div>
    </div>
  );
}