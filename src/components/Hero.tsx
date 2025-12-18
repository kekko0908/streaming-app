/* src/components/Hero.tsx */
import { useState, useEffect, useRef } from "react";
import "../css/hero.css";
import { TmdbItem, SavedItem, WatchStatus, STATUS_SECTIONS, Episode } from "../types/types";
import StarRating from "./StarRating";
import TrailerModal from "./TrailerModal";
import { fetchTrailer, fetchSeasonEpisodes } from "../utils/api";

interface HeroProps {
  item: TmdbItem;
  myList: SavedItem[];
  progress: { season: number; episode: number };
  onPlay: (season: number, episode: number) => void;
  onAddToList: (status: WatchStatus) => void;
  onRate: (rating: number) => void;
  onRemoveFromList: () => void;
  onClose: () => void;
  onSelectCollectionItem?: (item: TmdbItem) => void;
}

export default function Hero({ 
  item, myList, progress, onPlay, onAddToList, onRate, 
  onRemoveFromList, onClose, onSelectCollectionItem 
}: HeroProps) {
  
  const [uiSelectedSeason, setUiSelectedSeason] = useState(progress.season);
  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [showTrailer, setShowTrailer] = useState(false);
  
  // STATI PER GLI EPISODI
  const [episodesList, setEpisodesList] = useState<Episode[]>([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);

  // REF PER LO SCROLL ORIZZONTALE
  const episodeListRef = useRef<HTMLDivElement>(null);

  const savedItem = myList.find(m => m.tmdbId === item.tmdbId);
  const userRating = savedItem ? savedItem.rating : 0;
  const currentListStatus = savedItem?.status;

  // 1. Reset al cambio film
  useEffect(() => {
    setUiSelectedSeason(progress.season);
    setTrailerKey(null);
    fetchTrailer(item.tmdbId, item.type).then(setTrailerKey);
  }, [item.tmdbId, progress.season, item.type]);

  // 2. Scarica episodi al cambio stagione
  useEffect(() => {
    if (item.type === 'tv') {
      setLoadingEpisodes(true);
      
      // Reset momentaneo scroll
      if (episodeListRef.current) episodeListRef.current.scrollTo({ left: 0 });
      
      fetchSeasonEpisodes(item.tmdbId, uiSelectedSeason).then((data) => {
        setEpisodesList(data);
        setLoadingEpisodes(false);
      });
    }
  }, [item.tmdbId, uiSelectedSeason, item.type]);

  // 3. AUTO-SCROLL (IL TELETRASPORTO 🚀)
  // Appena finisce il caricamento, cerca l'episodio corrente e centra la vista su di lui
  useEffect(() => {
    if (!loadingEpisodes && episodesList.length > 0) {
        // Cerchiamo l'elemento nel DOM con l'ID specifico
        const currentCard = document.getElementById("current-episode-anchor");
        
        if (currentCard && episodeListRef.current) {
            const container = episodeListRef.current;
            
            // Calcolo matematico per centrare l'elemento
            // Posizione Card - Metà Schermo + Metà Larghezza Card
            const scrollPos = currentCard.offsetLeft - (container.clientWidth / 2) + (currentCard.clientWidth / 2);

            // Esegui lo scroll fluido
            container.scrollTo({
                left: Math.max(0, scrollPos), // Evita valori negativi
                behavior: 'smooth'
            });
        }
    }
  }, [loadingEpisodes, episodesList]);

  // Funzione scroll manuale con le frecce
  const scrollEpisodes = (direction: 'left' | 'right') => {
    if (episodeListRef.current) {
      const { current } = episodeListRef;
      const scrollAmount = 320; // Larghezza card + gap
      const target = direction === 'left' 
        ? current.scrollLeft - scrollAmount 
        : current.scrollLeft + scrollAmount;
        
      current.scrollTo({ left: target, behavior: 'smooth' });
    }
  };

  const isEpisodeReleased = (ep: Episode) => {
    if (!ep.air_date) return false; 
    const today = new Date();
    const airDate = new Date(ep.air_date);
    today.setHours(0,0,0,0);
    airDate.setHours(0,0,0,0);
    return airDate <= today;
  };

  const isActiveInList = (statusId: string) => savedItem?.status === statusId;

  return (
    <section className="hero">
      <div className="hero-overlay" />
      <img src={item.backdrop} alt={item.title} className="hero-bg" />
      
      <div className="hero-content">
        <h1>{item.title}</h1>
        
        {item.genres && item.genres.length > 0 && (
          <div className="hero-genres">
            {item.genres.map((g, i) => <span key={i} className="genre-tag">{g}</span>)}
          </div>
        )}

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

        <div style={{ marginBottom: '25px' }}>
           <StarRating initialRating={userRating} onRate={onRate} />
        </div>

        {/* --- AZIONI PRINCIPALI --- */}
        <div className="hero-actions">
          <button className="cta" onClick={() => onPlay(progress.season, progress.episode)}>
            ▶ Riproduci {item.type === 'tv' ? `S${progress.season}:E${progress.episode}` : ""}
          </button>

          {trailerKey && (
            <button className="trailer-btn" onClick={() => setShowTrailer(true)}>▶ Trailer</button>
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
          
          {currentListStatus && (
            <button 
                className="status-btn remove" 
                onClick={onRemoveFromList}
                title="Rimuovi dalla lista"
            >
                ✕ Rimuovi
            </button>
          )}
          
          <button className="status-btn" onClick={onClose}>Chiudi</button>
        </div>

        {/* --- CONTROLLI SERIE TV (CAROSELLO EPISODI) --- */}
        {item.type === 'tv' && item.seasonsDetails && (
          <div className="player-controls">
            
            {/* Selettore Stagione */}
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
            
            {/* Carosello Episodi */}
            <p className="eyebrow" style={{ marginBottom: '10px' }}>Episodi (Stagione {uiSelectedSeason})</p>
            
            <div className="episode-carousel-wrapper">
                
                {/* Freccia Sinistra */}
                <button className="ep-nav-btn left" onClick={() => scrollEpisodes('left')}>❮</button>

                <div className="episode-grid" ref={episodeListRef}>
                  {loadingEpisodes ? (
                     <p style={{color:'#888', fontStyle:'italic', padding:'20px'}}>Caricamento episodi...</p>
                  ) : episodesList.length > 0 ? (
                     episodesList.map((ep) => {
                        const released = isEpisodeReleased(ep);
                        
                        // LOGICA EPISODIO CORRENTE
                        const isCurrent = uiSelectedSeason === progress.season && ep.episode_number === progress.episode;
                        
                        // LOGICA EPISODIO VISTO (Precedente)
                        const isWatched = 
                            (uiSelectedSeason < progress.season) || 
                            (uiSelectedSeason === progress.season && ep.episode_number < progress.episode);

                        const imgUrl = ep.still_path 
                            ? `https://image.tmdb.org/t/p/w500${ep.still_path}`
                            : (item.backdrop || "https://via.placeholder.com/500x280?text=No+Image");

                        return (
                            <div
                                key={ep.id}
                                // ASSEGNIAMO UN ID UNIVOCO ALL'EPISODIO CORRENTE PER IL TELETRASPORTO
                                id={isCurrent ? "current-episode-anchor" : undefined}
                                className={`episode-card ${isCurrent ? 'current' : ''} ${isWatched ? 'watched' : ''} ${!released ? 'locked' : ''}`}
                                onClick={() => { if (released) onPlay(uiSelectedSeason, ep.episode_number); }}
                                title={!released ? `Esce il ${ep.air_date}` : ep.name}
                            >
                                <div className="episode-img-container">
                                    <img src={imgUrl} alt={ep.name} className="episode-img" loading="lazy" />
                                    <div className="episode-number-badge">{ep.episode_number}</div>
                                    
                                    {/* Overlay "Visto" */}
                                    {isWatched && (
                                        <div className="watched-overlay">
                                            <span className="checkmark">✔</span>
                                        </div>
                                    )}

                                    {!released && (
                                        <div className="locked-overlay">
                                            <span style={{fontSize:'1.5rem'}}>🔒</span>
                                            <span className="locked-text">{ep.air_date}</span>
                                        </div>
                                    )}
                                </div>
                                <div className="episode-info">
                                    <h4 className="episode-title" style={isWatched ? {color: '#888'} : {}}>
                                        {ep.name || `Episodio ${ep.episode_number}`}
                                    </h4>
                                    <p className="episode-desc">{ep.overview || "Nessuna trama disponibile."}</p>
                                </div>
                            </div>
                        );
                     })
                  ) : (
                     <p style={{color:'#666', padding:'20px'}}>Nessun episodio disponibile.</p>
                  )}
                </div>

                {/* Freccia Destra */}
                <button className="ep-nav-btn right" onClick={() => scrollEpisodes('right')}>❯</button>
            </div>
          </div>
        )}

        {/* --- SAGA COLLECTION --- */}
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