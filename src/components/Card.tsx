import "../css/card.css";
import "../css/archive.css"; 
import { MediaType, TmdbItem, WatchStatus } from "../types/types"; 
import { useState, useRef, useEffect } from "react";
import { fetchTitleLogo, fetchTrailer } from "../utils/api";
import YouTube from 'react-youtube';
import { useExclusiveTrailerPlayback } from "../hooks/useExclusiveTrailerPlayback";

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

function resolvePosterSrc(poster?: string) {
  if (!poster) return "https://via.placeholder.com/500x750";
  if (poster.startsWith("http://") || poster.startsWith("https://")) return poster;
  return `https://image.tmdb.org/t/p/w500${poster}`;
}

const NAV_HOVER_GUARD_PX = 12;

export default function Card({ item, onClick, progress, onRemove, isUpcoming, showRating, formatDate, onTypeChange }: CardProps) {
  
  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [expandedAlignment, setExpandedAlignment] = useState<"center" | "left" | "right">("center");
  const [isHoverBlocked, setIsHoverBlocked] = useState(false);
  const [isInList, setIsInList] = useState(Boolean(item.status));
  const [showListMenu, setShowListMenu] = useState(false);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trailerPlaybackIdRef = useRef(`card-${item.type}-${item.tmdbId}-${Math.random().toString(36).slice(2)}`);
  const cardWrapperRef = useRef<HTMLDivElement | null>(null);
  const expandedModalRef = useRef<HTMLDivElement | null>(null);
  const isTrailerActive = useExclusiveTrailerPlayback(
    trailerPlaybackIdRef.current,
    isExpanded && Boolean(trailerKey)
  );

  const updateExpandedAlignment = () => {
    const wrapper = cardWrapperRef.current;
    if (!wrapper) return;

    const track = wrapper.closest(".carousel-track") as HTMLElement | null;
    const wrapperRect = wrapper.getBoundingClientRect();
    const modalWidth = expandedModalRef.current?.offsetWidth ?? (window.innerWidth <= 1024 ? 380 : 440);
    const trackRect = track?.getBoundingClientRect();
    const leftBoundary = trackRect?.left ?? 0;
    const rightBoundary = trackRect?.right ?? window.innerWidth;
    const centeredLeft = wrapperRect.left + (wrapperRect.width / 2) - (modalWidth / 2);
    const centeredRight = centeredLeft + modalWidth;
    const edgePadding = 8;

    if (centeredLeft < leftBoundary + edgePadding) {
      setExpandedAlignment("left");
      return;
    }

    if (centeredRight > rightBoundary - edgePadding) {
      setExpandedAlignment("right");
      return;
    }

    setExpandedAlignment("center");
  };

  const isCoveredByNav = () => {
    const wrapper = cardWrapperRef.current;
    const nav = document.querySelector<HTMLElement>(".nav");
    if (!wrapper || !nav) return false;

    const wrapperRect = wrapper.getBoundingClientRect();
    const navRect = nav.getBoundingClientRect();
    const navBottom = Math.max(0, navRect.bottom);

    if (navBottom <= 0 || navRect.top >= window.innerHeight) return false;

    return wrapperRect.top < navBottom + NAV_HOVER_GUARD_PX && wrapperRect.bottom > navRect.top;
  };

  const resetHoverState = () => {
    if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = null;
    }
    setIsExpanded(false);
    setTrailerKey(null);
    setLogoUrl(null);
    setIsMuted(true);
    setExpandedAlignment("center");
    setShowListMenu(false);
  };

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    if (isCoveredByNav()) {
      setIsHoverBlocked(true);
      resetHoverState();
      return;
    }

    setIsHoverBlocked(false);
    hoverTimeoutRef.current = setTimeout(async () => {
      if (isCoveredByNav()) {
        setIsHoverBlocked(true);
        resetHoverState();
        return;
      }

      setIsExpanded(true);
      try {
        const [key, logo] = await Promise.all([
          fetchTrailer(item.tmdbId, item.type),
          fetchTitleLogo(item.tmdbId, item.type),
        ]);
        if (key && hoverTimeoutRef.current) setTrailerKey(key);
        if (logo && hoverTimeoutRef.current) setLogoUrl(logo);
      } catch(e) {}
    }, 800); 
  };

  const handleMouseLeave = () => {
    setIsHoverBlocked(false);
    resetHoverState();
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

  const handleListBtnClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowListMenu(!showListMenu);
  };

  const handleSelectStatus = (e: React.MouseEvent, status: WatchStatus) => {
    e.stopPropagation();
    setIsInList(true);
    setShowListMenu(false);
    window.dispatchEvent(new CustomEvent('add_to_list_direct', {
      detail: {
        item,
        status: status
      }
    }));
  };

  const handleRemoveFromListClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsInList(false);
    setShowListMenu(false);
    window.dispatchEvent(new CustomEvent('remove_from_list_direct', {
      detail: {
        tmdbId: item.tmdbId
      }
    }));
  };

  useEffect(() => {
    return () => {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    setIsInList(Boolean(item.status));
  }, [item.status, item.tmdbId]);

  useEffect(() => {
    if (!isExpanded) return;

    const closeIfCoveredByNav = () => {
      if (isCoveredByNav()) {
        setIsHoverBlocked(true);
        resetHoverState();
        return;
      }

      updateExpandedAlignment();
    };

    const frameId = window.requestAnimationFrame(closeIfCoveredByNav);
    const track = cardWrapperRef.current?.closest(".carousel-track") as HTMLElement | null;

    window.addEventListener("resize", closeIfCoveredByNav);
    window.addEventListener("scroll", closeIfCoveredByNav, { passive: true });
    track?.addEventListener("scroll", closeIfCoveredByNav, { passive: true });

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", closeIfCoveredByNav);
      window.removeEventListener("scroll", closeIfCoveredByNav);
      track?.removeEventListener("scroll", closeIfCoveredByNav);
    };
  }, [isExpanded]);

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
  const hasCommunityStats = typeof item.communityWatched === "number" || typeof item.communityRating === "number";
  const communityBadge =
    item.communitySortMode === "loved" && (item.communityRating || 0) > 0
      ? `Voto ${item.communityRating?.toFixed(1)}`
      : `${item.communityWatched || 0} visti`;
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
    <div
      className={`card-wrapper ${isHoverBlocked ? 'is-hover-blocked' : ''}`}
      ref={cardWrapperRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
        <article 
            className={`card ${isCompleted ? 'is-completed' : ''}`} 
            onClick={onClick}
        >
          <img 
            src={resolvePosterSrc(item.poster)} 
            alt={item.title} 
            loading="lazy" 
          />

          {hasCommunityStats && (
            <div className={`community-badge ${item.communitySortMode === "loved" ? "is-loved" : ""}`}>
              {communityBadge}
            </div>
          )}
          
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
            <div
              ref={expandedModalRef}
              className={`card-expanded-modal card-expanded-modal--${expandedAlignment}`}
            >
                <div className="expanded-video-container" onClick={handleDirectPlay}>
                    {trailerKey && isTrailerActive ? (
                        <YouTube
                            videoId={trailerKey}
                            className="card-expanded-player"
                            opts={{
                                width: '100%',
                                height: '100%',
                                host: 'https://www.youtube-nocookie.com',
                                playerVars: {
                                    autoplay: 1,
                                    controls: 0,
                                    rel: 0,
                                    loop: 1,
                                    modestbranding: 1,
                                    iv_load_policy: 3,
                                    cc_load_policy: 0,
                                    disablekb: 1,
                                    fs: 0,
                                    playsinline: 1,
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
                            src={resolvePosterSrc(item.poster)} 
                            alt={item.title} 
                            loading="lazy"
                            className="expanded-fallback-img"
                        />
                    )}
                    
                    {trailerKey && isTrailerActive && logoUrl && (
                        <img className="expanded-logo-art" src={logoUrl} alt={item.title} />
                    )}

                    {trailerKey && isTrailerActive && (
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
                        <div className="expanded-primary-actions">
                            <button className="exp-btn-play" onClick={handleDirectPlay} title="Riproduci">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="black"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                            </button>
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                <button className={`exp-btn-list ${isInList ? "active" : ""}`} type="button" onClick={handleListBtnClick} title="Gestisci lista">
                                    {isInList ? (
                                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                    ) : (
                                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                    )}
                                </button>
                                
                                {showListMenu && (
                                    <div className="list-dropdown-menu" onClick={e => e.stopPropagation()}>
                                        <button 
                                            className={item.status === 'da-guardare' ? 'active-status' : ''} 
                                            onClick={(e) => handleSelectStatus(e, 'da-guardare')}
                                        >
                                            Da guardare
                                        </button>
                                        <button 
                                            className={item.status === 'in-corso' ? 'active-status' : ''} 
                                            onClick={(e) => handleSelectStatus(e, 'in-corso')}
                                        >
                                            In corso
                                        </button>
                                        <button 
                                            className={item.status === 'pianificato' ? 'active-status' : ''} 
                                            onClick={(e) => handleSelectStatus(e, 'pianificato')}
                                        >
                                            Pianificato
                                        </button>
                                        <button 
                                            className={item.status === 'gia-guardato' ? 'active-status' : ''} 
                                            onClick={(e) => handleSelectStatus(e, 'gia-guardato')}
                                        >
                                            Già guardato
                                        </button>
                                        
                                        {isInList && (
                                            <button className="remove-btn" onClick={handleRemoveFromListClick}>
                                                Rimuovi dalla lista
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="expanded-title-text" title={item.title}>
                                {item.title}
                            </div>
                        </div>
                        <div className="expanded-secondary-actions">
                            <button className="exp-btn-info" onClick={(e) => { e.stopPropagation(); onClick(); }} title="Altre info">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                            </button>
                        </div>
                    </div>

                    <div className="expanded-details-header">
                        <span className="expanded-match">Match {Math.round((item.rating || 0) * 10)}%</span>
                        <span className="expanded-resolution">HD</span>
                        {item.type === 'movie' && item.runtime && (
                             <span className="expanded-duration">{item.runtime} m</span>
                        )}
                        {item.type === 'tv' && item.seasons && (
                             <span className="expanded-duration">{item.seasons} Stagion{item.seasons > 1 ? 'i' : 'e'}</span>
                        )}
                    </div>

                    <div className="expanded-genres">
                        {item.genres && item.genres.length > 0 ? item.genres.join(" • ") : (item.type === 'tv' ? 'Serie TV • Drammatico' : 'Film • Azione')}
                    </div>
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
