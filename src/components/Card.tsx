import "../css/card.css";
import "../css/archive.css"; 
import { TmdbItem } from "../types/types"; // Assicurati che l'import sia corretto verso il tuo file types

interface CardProps {
  item: TmdbItem;
  onClick: () => void;
  progress?: { season: number; episode: number };
  onRemove?: () => void;
  isUpcoming?: boolean;
  showRating?: boolean;
  formatDate?: (d?: string) => string;
}

function getRatingColor(rating: number) {
  if (rating === 10) return "masterpiece"; 
  if (rating >= 7.5) return "#00e676";
  if (rating >= 6) return "#ff9100";
  return "#ff1744";
}

export default function Card({ item, onClick, progress, onRemove, isUpcoming, showRating, formatDate }: CardProps) {
  
  const hasValidRating = (item.rating || 0) > 0;
  const shouldDisplayRating = hasValidRating && (showRating || (item.rating || 0) > 0);
  
  // Logica badge serie
  let isCompleted = false;
  let hasNewEpisodes = false;
  
  // Calcoliamo lo stato solo se è una TV e abbiamo progresso
  if (item.type === 'tv' && progress) {
    const isMarkedCompleted = item.status === 'visto' || (item as any).status === 'gia-guardato';
    if (item.seasons && item.seasons > progress.season) { 
        hasNewEpisodes = true; 
    } else if (isMarkedCompleted) { 
        isCompleted = true; 
    }
  }
  
  // Se ci sono nuovi episodi, non può essere considerata completata visivamente
  if (hasNewEpisodes) isCompleted = false;

  // LOGICA COLORE VOTO
  const currentRating = item.rating || 0;
  const ratingStyle = getRatingColor(currentRating);
  const isMasterpiece = currentRating === 10;

  return (
    <article className={`card ${isCompleted ? 'is-completed' : ''}`} onClick={onClick}>
      {/* Gestione poster sicuro */}
      <img 
        src={item.posterPath ? `https://image.tmdb.org/t/p/w500${item.posterPath}` : (item.poster || "https://via.placeholder.com/500x750")} 
        alt={item.title} 
        loading="lazy" 
      />
      
      {isCompleted && <div className="center-status-overlay"><span className="status-label-completed">COMPLETATA</span></div>}
      {hasNewEpisodes && <div className="center-status-overlay"><span className="status-label-new">NUOVI EPISODI</span></div>}
      
      {/* --- BADGE VOTO CON CORONA --- */}
      {shouldDisplayRating && !isCompleted && (
         <div 
           className={`rating-badge ${isMasterpiece ? 'masterpiece' : ''}`}
           style={!isMasterpiece ? { backgroundColor: ratingStyle } : undefined}
         >
           {isMasterpiece && <span className="crown-icon">👑</span>}
           {currentRating.toFixed(1)}
         </div>
      )}

      {/* --- MODIFICA QUI: Controllo item.type === 'tv' --- */}
      {item.type === 'tv' && progress && !isCompleted && !hasNewEpisodes && (
        <div className="progress-badge">S:{progress.season} E:{progress.episode}</div>
      )}

      {isUpcoming && item.releaseDateFull && formatDate && (
         <div className="upcoming-date">{formatDate(item.releaseDateFull)}</div>
      )}

      <div className="card-info-overlay">
        <h3>{item.title}</h3>
        {onRemove && (
          <button className="pill tiny danger" onClick={(e) => { e.stopPropagation(); onRemove(); }} style={{ marginTop: '5px' }}>Rimuovi</button>
        )}
      </div>
    </article>
  );
}