import { useState, useEffect } from "react";
import "../css/hero.css";
import { TmdbItem, SavedItem, WatchStatus, STATUS_SECTIONS } from "../types/types";
import StarRating from "./StarRating";
import TrailerModal from "./TrailerModal";
import { fetchTrailer } from "../utils/api";

interface HeroProps {
  item: TmdbItem;
  myList: SavedItem[];
  progress: { season: number; episode: number };
  onPlay: (season: number, episode: number) => void;
  onAddToList: (status: WatchStatus) => void;
  onRate: (rating: number) => void;
  onClose: () => void;
  // Aggiungiamo callback opzionale per cambiare film dalla collezione
  onSelectCollectionItem?: (item: TmdbItem) => void;
}

export default function Hero({ item, myList, progress, onPlay, onAddToList, onRate, onClose, onSelectCollectionItem }: HeroProps) {
  const [uiSelectedSeason, setUiSelectedSeason] = useState(progress.season);
  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [showTrailer, setShowTrailer] = useState(false);

  const savedItem = myList.find(m => m.tmdbId === item.tmdbId);
  const userRating = savedItem ? savedItem.rating : 0;

  useEffect(() => {
    setUiSelectedSeason(progress.season);
    setTrailerKey(null);
    fetchTrailer(item.tmdbId, item.type).then(setTrailerKey);
  }, [item.tmdbId, progress.season, item.type]);

  const isActiveInList = (statusId: string) => myList.find(m => m.tmdbId === item.tmdbId && m.status === statusId);

  return (
    <section className="hero">
      <div className="hero-overlay" />
      <img src={item.backdrop} alt={item.title} className="hero-bg" />
      
      <div className="hero-content">
        <h1>{item.title}</h1>
        
        {/* --- 1. GENERI --- */}
        {item.genres && item.genres.length > 0 && (
          <div className="hero-genres">
            {item.genres.map((g, i) => (
              <span key={i} className="genre-tag">{g}</span>
            ))}
          </div>
        )}

        {/* METADATI */}
        <div className="meta-row">
            <span className="meta-badge year">{item.year || "N/D"}</span>
            <span className="meta-badge tmdb">TMDB {item.rating.toFixed(1)}</span>
            <span className="meta-badge type">{item.type === "movie" ? "FILM" : "SERIE TV"}</span>
            {item.type === 'movie' && item.runtime && <span className="meta-badge info">{item.runtime}</span>}
            {item.type === 'tv' && item.seasons && <span className="meta-badge info">{item.seasons} Stagioni</span>}
        </div>

        <p style={{ maxWidth: '600px', lineHeight: '1.6', marginBottom: '20px', fontSize: '1.1rem', color: '#e0e0e0', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
            {item.overview}
        </p>

        {/* RATING */}
        <div style={{ marginBottom: '25px' }}>
           <StarRating initialRating={userRating} onRate={onRate} />
        </div>

        {/* AZIONI */}
        <div className="hero-actions">
          <button className="cta" onClick={() => onPlay(progress.season, progress.episode)}>
            ▶ Riproduci {item.type === 'tv' ? `S${progress.season}:E${progress.episode}` : ""}
          </button>

          {trailerKey && (
            <button className="trailer-btn" onClick={() => setShowTrailer(true)}>
               ▶ Trailer
            </button>
          )}

          {STATUS_SECTIONS.map(s => (
            <button
              key={s.id}
              className={`status-btn ${isActiveInList(s.id) ? "active" : ""}`}
              onClick={() => onAddToList(s.id)}
            >
              {isActiveInList(s.id) && <span>✓</span>} {s.label}
            </button>
          ))}
          
          <button className="status-btn" onClick={onClose}>Chiudi</button>
        </div>

        {/* CONTROLLI SERIE TV */}
        {item.type === 'tv' && item.seasonsDetails && (
          <div className="player-controls">
            <p className="eyebrow" style={{ marginBottom: '10px' }}>Seleziona Stagione</p>
            <div className="season-selector">
              {item.seasonsDetails.map((s) => (
                <button
                  key={s.season_number}
                  className={`season-btn ${uiSelectedSeason === s.season_number ? 'active' : ''}`}
                  onClick={() => setUiSelectedSeason(s.season_number)}
                >
                  Stagione {s.season_number}
                </button>
              ))}
            </div>
            <p className="eyebrow" style={{ marginBottom: '10px' }}>Episodi (Stagione {uiSelectedSeason})</p>
            <div className="episode-grid">
              {Array.from({ length: item.seasonsDetails.find(s => s.season_number === uiSelectedSeason)?.episode_count || 0 }).map((_, idx) => {
                const epNum = idx + 1;
                const isWatched = (uiSelectedSeason < progress.season) || (uiSelectedSeason === progress.season && epNum <= progress.episode);
                const isCurrent = uiSelectedSeason === progress.season && epNum === progress.episode;
                return (
                  <button
                    key={epNum}
                    className={`episode-btn ${isWatched ? 'watched' : ''} ${isCurrent ? 'current' : ''}`}
                    onClick={() => onPlay(uiSelectedSeason, epNum)}
                  >
                    {epNum}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* --- 2. SEZIONE COLLEZIONE / SAGA --- */}
        {item.collection && (
          <div className="collection-container">
             <div className="collection-title">
                <span className="collection-badge">SAGA COMPLETA</span>
                {item.collection.name}
             </div>
             <div className="collection-scroll">
                {item.collection.parts.map(part => (
                   <div 
                      key={part.tmdbId} 
                      className="collection-item"
                      // Se abbiamo passato la funzione per selezionare, la usiamo.
                      // Altrimenti, se onSelectCollectionItem non c'è, non fa nulla (o potremmo usare un default).
                      // Nota: Dobbiamo passare questa prop da App.tsx
                      onClick={() => onSelectCollectionItem && onSelectCollectionItem(part)}
                   >
                      <img src={part.poster} alt={part.title} className="collection-poster" />
                      <div className="collection-year">{part.year}</div>
                   </div>
                ))}
             </div>
          </div>
        )}

      </div>

      {showTrailer && trailerKey && <TrailerModal ytKey={trailerKey} onClose={() => setShowTrailer(false)} />}
    </section>
  );
}