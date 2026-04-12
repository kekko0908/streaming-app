import "../css/card.css";
import "../css/archive.css"; 
import { MediaType, TmdbItem } from "../types/types"; 
import { useState, useRef, useEffect } from "react";
import { fetchTrailer } from "../utils/api";
import YouTube from 'react-youtube';

interface CardProps {
  item: TmdbItem;
  onClick: () => void;
  progress?: { season: number; episode: number; watchedEpisodes?: number; totalEpisodes?: number };
  onRemove?: () => void;
  isUpcoming?: boolean;
  showRating?: boolean;
  formatDate?: (d?: string) => string;
  onTypeChange?: (nextType: MediaType) => void;
}

function getRatingColor(rating: number) {
  if (rating === 10) return "masterpiece"; 
  if (rating >= 7.5) return "#00e676";
  if (rating >= 6) return "#ff9100";
  return "#ff1744";
}

export default function Card({ item, onClick, progress, onRemove, isUpcoming, showRating, formatDate, onTypeChange }: CardProps) {
  
  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(async () => {
      setIsExpanded(true);
      try {
        const key = await fetchTrailer(item.tmdbId, item.type);
        if (key && hoverTimeoutRef.current) setTrailerKey(key);
      } catch(e) {}
    }, 800); 
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = null;
    }
    setIsExpanded(false);
    setTrailerKey(null);
    setIsMuted(true);
  };

  const handleDirectPlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent('play_direct', {
      detail: { 
        item, 
        season: progress?.season || 1, 
        episode: progress?.episode || 1 
      }
    }));
  };

  useEffect(() => {
    return () => {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  const hasValidRating = (item.rating || 0) > 0;
  const shouldDisplayRating = hasValidRating && (showRating || (item.rating || 0) > 0);
  
  // Logica badge serie
  let isCompleted = false;
  let hasNewEpisodes = false;
  
  // Calcoliamo lo stato solo se è una TV e abbiamo progresso
  if (item.type === 'tv' && progress) {
    const isMarkedCompleted = item.status === 'gia-guardato';
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

  const isMovieInProgress = item.type === "movie" && item.status === "in-corso";
  const runtimeMinutes = isMovieInProgress && item.runtime ? parseInt(item.runtime, 10) || 0 : 0;
  const watchedMinutes = isMovieInProgress ? Math.max(0, Math.floor(item.progressMinutes || 0)) : 0;
  const movieProgress = runtimeMinutes > 0 && watchedMinutes > 0
    ? Math.min(1, watchedMinutes / runtimeMinutes)
    : 0;

  // Progresso Serie TV: episodi visti / episodi totali
  const tvProgress =
    item.type === 'tv' &&
    progress?.watchedEpisodes && progress.watchedEpisodes > 0 &&
    progress?.totalEpisodes && progress.totalEpisodes > 0
      ? Math.min(1, progress.watchedEpisodes / progress.totalEpisodes)
      : null;

  // Valore finale per la barra
  const effectiveProgress = item.type === 'movie' ? movieProgress : tvProgress;

  return (
    <div className="card-wrapper" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
        <article 
            className={`card ${isCompleted ? 'is-completed' : ''}`} 
            onClick={onClick}
        >
          <img 
            src={item.poster ? `https://image.tmdb.org/t/p/w500${item.poster}` : (item.poster || "https://via.placeholder.com/500x750")} 
            alt={item.title} 
            loading="lazy" 
          />
          
          {isCompleted && <div className="center-status-overlay"><span className="status-label-completed">COMPLETATA</span></div>}
          {hasNewEpisodes && <div className="center-status-overlay"><span className="status-label-new">NUOVI EPISODI</span></div>}
          
          {shouldDisplayRating && !isCompleted && (
             <div 
               className={`rating-badge ${isMasterpiece ? 'masterpiece' : ''}`}
               style={!isMasterpiece ? { backgroundColor: ratingStyle } : undefined}
             >
               {isMasterpiece && <span className="crown-icon">👑</span>}
               {currentRating.toFixed(1)}
             </div>
          )}

          {item.type === 'tv' && progress && !isCompleted && !hasNewEpisodes && (
            <div className="progress-badge">S:{progress.season} E:{progress.episode}</div>
          )}

          {isUpcoming && item.releaseDateFull && formatDate && (
             <div className="upcoming-date">{formatDate(item.releaseDateFull)}</div>
          )}

          {(effectiveProgress !== null && effectiveProgress !== undefined && (effectiveProgress > 0 || (item.type === 'tv' && progress))) && (
            <div className="elegant-progress-container" aria-hidden="true">
              <div className="elegant-progress-bar">
                <span
                  className="elegant-progress-fill"
                  style={{ width: `${Math.max(3, Math.round((effectiveProgress || 0.03) * 100))}%` }}
                />
              </div>
            </div>
          )}

          <div className="card-info-overlay">
            <h3>{item.title}</h3>
            {onRemove && (
              <button className="pill tiny danger" onClick={(e) => { e.stopPropagation(); onRemove(); }} style={{ marginTop: '5px' }}>Rimuovi</button>
            )}
          </div>
        </article>

        {isExpanded && (
            <div className="card-expanded-modal">
                <div className="expanded-video-container" onClick={handleDirectPlay}>
                    {trailerKey ? (
                        <YouTube
                            videoId={trailerKey}
                            opts={{
                                width: '100%',
                                height: '100%',
                                playerVars: {
                                    autoplay: 1,
                                    controls: 0,
                                    showinfo: 0,
                                    rel: 0,
                                    loop: 1,
                                    mute: isMuted ? 1 : 0,
                                    playlist: trailerKey
                                }
                            }}
                            onReady={(e: any) => {
                                e.target.setVolume(60);
                            }}
                            iframeClassName="card-expanded-video"
                            style={{ width: '100%', height: '100%' }}
                        />
                    ) : (
                        <img 
                            src={item.poster ? `https://image.tmdb.org/t/p/w500${item.poster}` : (item.poster || "https://via.placeholder.com/500x750")} 
                            alt={item.title} 
                            loading="lazy"
                            className="expanded-fallback-img"
                        />
                    )}
                    
                    {trailerKey && (
                        <button 
                            className="expanded-mute-btn" 
                            onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }}
                        >
                            {isMuted ? '🔇' : '🔊'}
                        </button>
                    )}
                </div>
                
                <div className="expanded-info-container">
                    <div className="expanded-actions-row">
                        <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                            <button className="exp-btn-play" onClick={handleDirectPlay}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="black"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                            </button>
                            <span className="exp-title">{item.title}</span>
                        </div>
                        <button className="exp-btn-open" onClick={onClick} title="Altre Info">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
                        </button>
                    </div>
                    
                    <div className="expanded-meta-row">
                        <span className="match-score">Match {(item.rating * 10).toFixed(0)}%</span>
                        <span>{item.year || (item.releaseDateFull ? item.releaseDateFull.substring(0,4) : 'N/D')}</span>
                        {item.type === 'movie' && item.runtime && <span>{parseInt(item.runtime, 10)} min</span>}
                        {item.type === 'tv' && item.seasons && <span>{item.seasons} Stagioni</span>}
                        <span className="hd-badge">HD</span>
                    </div>

                    {item.genres && item.genres.length > 0 && (
                        <div className="expanded-genres-row">
                           {item.genres.join(" • ")}
                        </div>
                    )}
                </div>
            </div>
        )}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <article className="skeleton-card">
      <div className="skeleton-shimmer" />
    </article>
  );
}
