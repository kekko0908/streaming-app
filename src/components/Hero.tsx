/* src/components/Hero.tsx */
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import YouTube from 'react-youtube';
import "../css/hero.css";
import { TmdbItem, SavedItem, WatchStatus, STATUS_SECTIONS, Episode } from "../types/types";
import StarRating from "./StarRating";
import TrailerModal from "./TrailerModal";
import { fetchTitleLogo, fetchTrailer, fetchSeasonEpisodes } from "../utils/api";
import { useExclusiveTrailerPlayback } from "../hooks/useExclusiveTrailerPlayback";

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
  isUILocked: boolean;
  toggleUILock: () => void;
}

function CustomStatusDropdown({
  currentStatus,
  onAddToList,
  onRemoveFromList
}: {
  currentStatus?: WatchStatus;
  onAddToList: (s: WatchStatus) => void;
  onRemoveFromList: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const activeLabel = currentStatus ? STATUS_SECTIONS.find(s => s.id === currentStatus)?.label : "+ Aggiungi alla lista";

  return (
    <div className="custom-dropdown-container">
      <button
        className={`circle-btn ${currentStatus ? "active" : ""}`}
        onClick={() => setIsOpen(!isOpen)}
        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
        title={activeLabel}
      >
        {currentStatus ? "✓" : "+"}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="custom-dropdown-menu"
            style={{ top: '110%', bottom: 'auto' }}
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            {STATUS_SECTIONS.map(s => (
              <div
                key={s.id}
                className={`dropdown-item ${currentStatus === s.id ? 'selected' : ''}`}
                onClick={() => { onAddToList(s.id); setIsOpen(false); }}
              >
                {currentStatus === s.id && <span>✓ </span>} {s.label}
              </div>
            ))}
            {currentStatus && (
              <div
                className="dropdown-item remove"
                onClick={() => { onRemoveFromList(); setIsOpen(false); }}
              >
                ✕ Rimuovi dalla lista
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StarRatingDropdown({ rating, onRate }: { rating: number; onRate: (r: number) => void; }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="custom-dropdown-container" style={{ display: 'flex', alignItems: 'center' }}>
      <button className="circle-btn" onClick={() => setIsOpen(!isOpen)} onBlur={() => setTimeout(() => setIsOpen(false), 200)} title="Vota">
        ★
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div className="custom-dropdown-menu" style={{ minWidth: 'fit-content', padding: '10px 15px', left: '110%', top: '50%', transform: 'translateY(-50%)', bottom: 'auto', display: 'flex', whiteSpace: 'nowrap' }}
            initial={{ opacity: 0, x: -20, scale: 0.95 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: -20, scale: 0.95 }} transition={{ duration: 0.2 }}>
            <StarRating initialRating={rating} onRate={onRate} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Hero({
  item, myList, progress, onPlay, onAddToList, onRate,
  onRemoveFromList, onClose, onSelectCollectionItem,
  isUILocked, toggleUILock
}: HeroProps) {

  const savedItem = myList.find(s => s.tmdbId === item.tmdbId);
  const userRating = savedItem?.rating || 0;
  const currentListStatus = savedItem?.status as WatchStatus | undefined;
  const runtimeLabel = item.runtime
    ? item.runtime.toLowerCase().includes("min")
      ? item.runtime
      : `${item.runtime} min`
    : "";

  const [uiSelectedSeason, setUiSelectedSeason] = useState<number>(progress.season || 1);
  const [episodesList, setEpisodesList] = useState<Episode[]>([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const [showTrailer, setShowTrailer] = useState(false);
  const [activeTab, setActiveTab] = useState<'panoramica' | 'episodi' | 'dettagli'>('panoramica');

  const episodeListRef = useRef<HTMLDivElement>(null);
  const hasEpisodes = item.type === 'tv' && item.seasonsDetails && item.seasonsDetails.length > 0;
  const [showBgVideo, setShowBgVideo] = useState(false);
  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [volume, setVolume] = useState(60);
  const ytPlayerRef = useRef<any>(null);
  const isBgTrailerActive = useExclusiveTrailerPlayback(
    `hero-${item.type}-${item.tmdbId}`,
    showBgVideo && Boolean(trailerKey)
  );

  // 1. Reset al cambio film
  useEffect(() => {
    setUiSelectedSeason(progress.season);
    setTrailerKey(null);
    setLogoUrl(item.logo || null);
    setShowBgVideo(false);
    fetchTrailer(item.tmdbId, item.type).then(setTrailerKey);
    fetchTitleLogo(item.tmdbId, item.type)
      .then((logo) => setLogoUrl(logo || item.logo || null))
      .catch(() => setLogoUrl(item.logo || null));
  }, [item.tmdbId, progress.season, item.type, item.logo]);

  useEffect(() => {
    if (trailerKey) {
      const timer = setTimeout(() => setShowBgVideo(true), 2500);
      return () => clearTimeout(timer);
    }
  }, [trailerKey]);

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
  // Appena la tab episodi è attiva e il caricamento è finito, scrolliamo
  useEffect(() => {
    if (activeTab === 'episodi' && !loadingEpisodes && episodesList.length > 0) {
      setTimeout(() => {
        const currentCard = document.getElementById("current-episode-anchor");

        if (currentCard && episodeListRef.current) {
          const container = episodeListRef.current;

          // Calcolo matematico per centrare l'elemento
          const scrollPos = currentCard.offsetLeft - (container.clientWidth / 2) + (currentCard.clientWidth / 2);

          // Esegui lo scroll fluido
          container.scrollTo({
            left: Math.max(0, scrollPos),
            behavior: 'smooth'
          });
        }
      }, 300); // Ritardo per far completare l'animazione di montaggio della Tab
    }
  }, [loadingEpisodes, episodesList, activeTab, uiSelectedSeason]);

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
    today.setHours(0, 0, 0, 0);
    airDate.setHours(0, 0, 0, 0);
    return airDate <= today;
  };

  const isActiveInList = (statusId: string) => savedItem?.status === statusId;

  return (
    <section className="hero">
      <div className="hero-overlay" />
      <img src={item.backdrop} alt={item.title} className={`hero-bg ${isBgTrailerActive ? 'fade-out' : ''}`} />

      {isBgTrailerActive && trailerKey && (
        <div className="hero-bg-video">
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
                mute: 1, // DEFAULT INSTART MUTED! Così non si resetta quando cambiamo toggleMute se non lo leghiamo allo stato
                playlist: trailerKey
              }
            }}
            onReady={(e: any) => {
              ytPlayerRef.current = e.target;
              e.target.setVolume(volume);
              if (!isMuted) e.target.unMute();
            }}
            style={{ width: '100%', height: '100%' }}
            iframeClassName="video-frame"
            title="Sfondo Trailer"
          />
        </div>
      )}

      {isBgTrailerActive && trailerKey && (
        <div
          className="volume-control-wrapper"
          style={{ transition: 'width 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)' }}
        >
          <button
            className="circle-btn"
            onClick={() => {
              const newMute = !isMuted;
              setIsMuted(newMute);
              if (ytPlayerRef.current) {
                if (newMute) {
                  ytPlayerRef.current.mute();
                } else {
                  ytPlayerRef.current.unMute();
                  if (volume === 0) {
                    setVolume(60);
                    ytPlayerRef.current.setVolume(60);
                  }
                }
              }
            }}
            title={isMuted ? "Attiva Audio" : "Disattiva Audio"}
          >
            {isMuted || volume === 0 ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
            )}
          </button>
          <input
            type="range"
            min="0"
            max="100"
            value={isMuted ? 0 : volume}
            onChange={(e) => {
              const val = Number(e.target.value);
              setVolume(val);
              if (ytPlayerRef.current) {
                ytPlayerRef.current.setVolume(val);
                if (val === 0 && !isMuted) {
                  setIsMuted(true);
                  ytPlayerRef.current.mute();
                } else if (val > 0 && isMuted) {
                  setIsMuted(false);
                  ytPlayerRef.current.unMute();
                }
              }
            }}
            className="volume-slider"
          />
        </div>
      )}

      <div className={`hero-content tab-${activeTab}`}>
        <div className="hero-title-lockup">
          {logoUrl ? (
            <img className="hero-logo-art" src={logoUrl} alt={item.title} />
          ) : !isBgTrailerActive ? (
            <h1 className="netflix-title">{item.title}</h1>
          ) : null}
        </div>

        <div className="netflix-meta">
          <span>{item.year || "N/D"}</span>
          <span className="separator">•</span>
          {item.type === 'movie' && runtimeLabel && <span>{runtimeLabel}</span>}
          {item.type === 'tv' && item.seasons && <span>{item.seasons} stagioni</span>}
          <span className="separator">•</span>
          <span>{item.type === "movie" ? "Film" : "Serie TV"}</span>
        </div>

        {/* --- AZIONI PRINCIPALI --- */}
        <div className="hero-actions">
          <button className="cta netflix-play" onClick={() => onPlay(progress.season, progress.episode)}>
            {item.progressSeconds && item.progressSeconds > 15 ? (
              <>↺ Riprendi <span className="hero-resume-time">{Math.floor(item.progressSeconds / 60)}:{(Math.floor(item.progressSeconds % 60)).toString().padStart(2, '0')}</span></>
            ) : (
              <>▶ Riproduci</>
            )}
            {item.type === 'tv' ? ` - S${progress.season}:E${progress.episode}` : ""}
          </button>

          <div className="circle-btn rating" title="TMDB Rating">
            {item.rating.toFixed(1)}
          </div>

          <CustomStatusDropdown
            currentStatus={currentListStatus}
            onAddToList={onAddToList}
            onRemoveFromList={onRemoveFromList}
          />

          <StarRatingDropdown rating={userRating} onRate={onRate} />

          <button 
            className={`circle-btn zen-mode-btn ${isUILocked ? 'active' : ''}`} 
            onClick={toggleUILock} 
            title={isUILocked ? "Sblocca Interfaccia" : "Blocca Interfaccia (Zen Mode)"}
            style={{ marginLeft: 'auto' }}
          >
            {isUILocked ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg>
            )}
          </button>

          <button className="circle-btn close-btn" onClick={onClose} title="Chiudi">
            ✕
          </button>
        </div>

        {/* TABS NAVIGATION */}
        <div className="hero-tabs-nav">
          <button className={`hero-tab ${activeTab === 'panoramica' ? 'active' : ''}`} onClick={() => setActiveTab('panoramica')}>
            PANORAMICA
          </button>
          {hasEpisodes && (
            <button className={`hero-tab ${activeTab === 'episodi' ? 'active' : ''}`} onClick={() => setActiveTab('episodi')}>
              EPISODI
            </button>
          )}
          {item.collection && (
            <button className={`hero-tab ${activeTab === 'dettagli' ? 'active' : ''}`} onClick={() => setActiveTab('dettagli')}>
              SAGA
            </button>
          )}
        </div>

        {/* TAB CONTENTS */}
        <div className="hero-tab-content">
          {activeTab === 'panoramica' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="tab-panoramica">
              <p className="hero-overview netflix-overview">
                {item.overview}
              </p>

              {item.genres && item.genres.length > 0 && (
                <div className="hero-extra-info">
                  <span className="info-label">Generi:</span> {item.genres.join(', ')}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'dettagli' && item.collection && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="tab-dettagli">
              <div className="collection-container">
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
            </motion.div>
          )}

          {activeTab === 'episodi' && hasEpisodes && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="tab-episodi">

              <div className="episodes-header">
                <h3>Nuovi Episodi</h3>
                <div className="netflix-season-select-wrapper">
                  <select
                    className="netflix-season-select"
                    value={uiSelectedSeason}
                    onChange={(e) => setUiSelectedSeason(Number(e.target.value))}
                  >
                    {item.seasonsDetails!.map((s) => (
                      <option key={s.season_number} value={s.season_number}>
                        Stagione {s.season_number}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="episode-carousel-wrapper netflix-carousel">
                {/* Freccia Sinistra */}
                <button className="ep-nav-btn left" onClick={() => scrollEpisodes('left')}>❮</button>

                <div className="episode-grid" ref={episodeListRef}>
                  {loadingEpisodes ? (
                    <p style={{ color: '#888', fontStyle: 'italic', padding: '20px' }}>Caricamento episodi...</p>
                  ) : episodesList.length > 0 ? (
                    episodesList.map((ep) => {
                      const released = isEpisodeReleased(ep);
                      const isCurrent = uiSelectedSeason === progress.season && ep.episode_number === progress.episode;
                      const isWatched = (uiSelectedSeason < progress.season) || (uiSelectedSeason === progress.season && ep.episode_number < progress.episode);

                      const imgUrl = ep.still_path
                        ? `https://image.tmdb.org/t/p/w500${ep.still_path}`
                        : (item.backdrop || "https://via.placeholder.com/500x280?text=No+Image");

                      return (
                        <div
                          key={ep.id}
                          id={isCurrent ? "current-episode-anchor" : undefined}
                          className={`episode-card netflix-ep-card ${isCurrent ? 'current' : ''} ${isWatched ? 'watched' : ''} ${!released ? 'locked' : ''}`}
                          onClick={() => { if (released) onPlay(uiSelectedSeason, ep.episode_number); }}
                          title={!released ? `Esce il ${ep.air_date}` : ep.name}
                        >
                          <div className="episode-img-container">
                            <img src={imgUrl} alt={ep.name} className="episode-img" loading="lazy" />

                            {/* NUMERO EPISODIO GIGANTE IN BASSO A SINISTRA (Netflix Style) */}
                            <div className="netflix-ep-number">{ep.episode_number}</div>

                            {isWatched && (
                              <div className="watched-overlay">
                                <span className="checkmark">✔</span>
                              </div>
                            )}

                            {!released && (
                              <div className="locked-overlay">
                                <span style={{ fontSize: '1.5rem' }}>🔒</span>
                                <span className="locked-text">{ep.air_date}</span>
                              </div>
                            )}
                          </div>
                          <div className="episode-info">
                            <h4 className="episode-title" style={isWatched ? { color: '#888' } : {}}>
                              {ep.name || `Episodio ${ep.episode_number}`}
                            </h4>
                            <p className="episode-desc">{ep.overview || "Nessuna trama disponibile."}</p>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p style={{ color: '#666', padding: '20px' }}>Nessun episodio disponibile.</p>
                  )}
                </div>

                {/* Freccia Destra */}
                <button className="ep-nav-btn right" onClick={() => scrollEpisodes('right')}>❯</button>
              </div>
            </motion.div>
          )}

        </div>
      </div>

      {showTrailer && trailerKey && <TrailerModal ytKey={trailerKey} onClose={() => setShowTrailer(false)} />}
    </section>
  );
}
