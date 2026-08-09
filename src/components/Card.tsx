import "../css/card.css";
import "../css/archive.css"; 
import { MediaType, TmdbItem, WatchStatus } from "../types/types"; 
import { useState, useRef, useEffect } from "react";
import { fetchDetails, fetchTitleLogo, fetchTrailer } from "../utils/api";
import { getTmdbImageUrl } from "../utils/helper";
import { logDevError } from "../utils/logging";
import YouTube from 'react-youtube';
import { useExclusiveTrailerPlayback } from "../hooks/useExclusiveTrailerPlayback";
import { Icon } from "./ui/Icon";
import { CardActions } from "./card/CardActions";

interface CardProps {
  item: TmdbItem;
  onClick: () => void;
  progress?: { season: number; episode: number; watchedEpisodes?: number; totalEpisodes?: number; progressSeconds?: number; progressMinutes?: number };
  onRemove?: () => void;
  isUpcoming?: boolean;
  showRating?: boolean;
  formatDate?: (d?: string) => string;
  onTypeChange?: (nextType: MediaType) => void;
  variant?: "portrait" | "landscape" | "ranked";
  rank?: number;
}

function getRatingColor(rating: number) {
  if (rating === 10) return "masterpiece"; 
  if (rating >= 7.5) return "#00e676";
  if (rating >= 6) return "#ff9100";
  return "#ff1744";
}

const NAV_HOVER_GUARD_PX = 12;

function formatProgressTime(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export default function Card({ item, onClick, progress, onRemove, isUpcoming, showRating, formatDate, onTypeChange, variant = "portrait", rank }: CardProps) {
  
  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [expandedDetails, setExpandedDetails] = useState<TmdbItem | null>(null);
  const [expandedDetailsReady, setExpandedDetailsReady] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [expandedAlignment, setExpandedAlignment] = useState<"center" | "left" | "right">("center");
  const [isHoverBlocked, setIsHoverBlocked] = useState(false);
  const [isInList, setIsInList] = useState(Boolean(item.status));
  const [hasReleaseNotification, setHasReleaseNotification] = useState(false);
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
    setExpandedDetails(null);
    setExpandedDetailsReady(false);
    setIsMuted(true);
    setExpandedAlignment("center");
    setShowListMenu(false);
  };

  const handleMouseEnter = () => {
    if (variant !== "portrait") return;
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
        const [key, logo, details] = await Promise.all([
          fetchTrailer(item.tmdbId, item.type),
          fetchTitleLogo(item.tmdbId, item.type),
          fetchDetails(item.tmdbId, item.type),
        ]);
        if (key && hoverTimeoutRef.current) setTrailerKey(key);
        if (logo && hoverTimeoutRef.current) setLogoUrl(logo);
        if (details && hoverTimeoutRef.current) setExpandedDetails(details);
      } catch (error) {
        logDevError("Errore caricamento hover card", error);
      } finally {
        if (hoverTimeoutRef.current) setExpandedDetailsReady(true);
      }
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

  const handleNotificationClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextEnabled = !hasReleaseNotification;
    setHasReleaseNotification(nextEnabled);

    if (nextEnabled && !isInList) {
      setIsInList(true);
      window.dispatchEvent(new CustomEvent('add_to_list_direct', {
        detail: {
          item,
          status: "da-guardare"
        }
      }));
    }

    window.dispatchEvent(new CustomEvent('toggle_release_notifications', {
      detail: {
        item,
        enabled: nextEnabled
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
    const key = `${item.type}:${item.tmdbId}`;
    const handleNotificationState = (event: Event) => {
      const customEvent = event as CustomEvent<{ enabledKeys?: string[] }>;
      setHasReleaseNotification(Boolean(customEvent.detail.enabledKeys?.includes(key)));
    };

    const currentKeys = (window as any).sfaReleaseNotificationKeys as string[] | undefined;
    setHasReleaseNotification(Boolean(currentKeys?.includes(key)));
    window.addEventListener("release_notification_state_changed", handleNotificationState);
    return () => window.removeEventListener("release_notification_state_changed", handleNotificationState);
  }, [item.type, item.tmdbId]);

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
  const displayItem = expandedDetailsReady ? (expandedDetails ?? item) : item;
  const expandedYear = displayItem.year || displayItem.releaseDateFull?.slice(0, 4) || "";
  const expandedRuntime = displayItem.runtime
    ? displayItem.runtime.toLowerCase().includes("min") ? displayItem.runtime : `${displayItem.runtime} min`
    : "";

  // Progresso Serie TV: episodi visti / episodi totali
  const tvProgress =
    item.type === 'tv' &&
    progress?.totalEpisodes && progress.totalEpisodes > 0
      ? Math.min(1, (progress.watchedEpisodes || 0) / progress.totalEpisodes)
      : null;
  const tvResumeSeconds = item.type === "tv" ? Math.max(0, progress?.progressSeconds || item.progressSeconds || 0) : 0;
  const showTvResumeBadge = item.type === "tv" && tvResumeSeconds > 15 && !isCompleted;

  // Valore finale per la barra
  const effectiveProgress = item.type === 'movie' ? movieProgress : tvProgress;

  return (
    <div
      className={`card-wrapper card-wrapper--${variant} ${isHoverBlocked ? 'is-hover-blocked' : ''}`}
      ref={cardWrapperRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
        <article 
            className={`card card--${variant} ${isCompleted ? 'is-completed' : ''}`}
            onClick={onClick}
        >
          <img 
            src={getTmdbImageUrl(variant === "landscape" ? (item.backdrop || item.poster) : item.poster, variant === "landscape" ? "w780" : "w500", "https://via.placeholder.com/500x750")}
            alt={item.title} 
            loading="lazy" 
            decoding="async"
          />

          {variant === "ranked" && rank && <span className="card-rank" aria-label={`Posizione ${rank}`}>{rank}</span>}

          <span
            className={`card-notification-button ${hasReleaseNotification ? "active" : ""}`}
            aria-hidden="true"
            title={hasReleaseNotification ? "Notifiche attive" : "Avvisami sulle uscite"}
          >
            <Icon name="bell" size={16} />
          </span>

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
               {isMasterpiece && <Icon name="crown" size={16} className="crown-icon" />}
               {currentRating.toFixed(1)}
             </div>
          )}

          {item.type === 'tv' && progress && !isCompleted && !hasNewEpisodes && (
            <div className={`progress-badge ${hasReleaseNotification ? "with-notification" : ""}`}>S:{progress.season} E:{progress.episode}</div>
          )}

          {showTvResumeBadge && (
            <div className="resume-progress-badge">Riprendi da {formatProgressTime(tvResumeSeconds)}</div>
          )}

          {isUpcoming && item.releaseInfo?.date && formatDate && (
             <div className="upcoming-date">{formatDate(item.releaseInfo.date)}</div>
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
              <button className="pill tiny danger card-remove-button" onClick={(e) => { e.stopPropagation(); onRemove(); }}>Rimuovi</button>
            )}
          </div>

          {variant === "landscape" && (
            <div className="card-landscape-panel" onClick={(event) => event.stopPropagation()}>
              <CardActions
                item={item}
                isInList={isInList}
                showListMenu={showListMenu}
                hasNotification={hasReleaseNotification}
                onPlay={handleDirectPlay}
                onToggleList={handleListBtnClick}
                onSelectStatus={handleSelectStatus}
                onRemove={handleRemoveFromListClick}
                onToggleNotification={handleNotificationClick}
                onInfo={(event) => { event.stopPropagation(); onClick(); }}
              />
              <div className="card-landscape-meta">
                {item.year && <span>{item.year}</span>}
                {item.rating > 0 && <strong>{item.rating.toFixed(1)}</strong>}
                {item.genres?.slice(0, 2).map((genre) => <span key={genre}>{genre}</span>)}
              </div>
            </div>
          )}
        </article>

        {isExpanded && variant === "portrait" && (
            <div
              ref={expandedModalRef}
              className={`card-expanded-modal card-expanded-modal--${expandedAlignment}`}
            >
                <div
                  className={`expanded-video-container ${trailerKey && isTrailerActive ? "has-youtube-trailer" : ""}`}
                  onClick={handleDirectPlay}
                >
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
                        />
                    ) : (
                        <img 
                            src={getTmdbImageUrl(item.poster, "w500", "https://via.placeholder.com/500x750")} 
                            alt={item.title} 
                            loading="lazy"
                            decoding="async"
                            className="expanded-fallback-img"
                        />
                    )}
                    
                    {trailerKey && isTrailerActive && logoUrl && (
                        <img className="expanded-logo-art" src={logoUrl} alt={item.title} loading="eager" decoding="async" />
                    )}

                    {trailerKey && isTrailerActive && (
                        <button 
                            className="expanded-mute-btn" 
                            onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }}
                        >
                            <Icon name={isMuted ? "volume-off" : "volume"} size={18} />
                        </button>
                    )}
                </div>
                <div className="expanded-info-container">
                    <CardActions
                      item={item}
                      isInList={isInList}
                      showListMenu={showListMenu}
                      hasNotification={hasReleaseNotification}
                      onPlay={handleDirectPlay}
                      onToggleList={handleListBtnClick}
                      onSelectStatus={handleSelectStatus}
                      onRemove={handleRemoveFromListClick}
                      onToggleNotification={handleNotificationClick}
                      onInfo={(event) => { event.stopPropagation(); onClick(); }}
                    />

                    {expandedDetailsReady ? (
                        <div className="expanded-details-header">
                            <span className="expanded-match">Valutazione {(displayItem.rating || 0).toFixed(1)}</span>
                            {expandedYear && (
                                 <span className="expanded-date">{expandedYear}</span>
                            )}
                            {displayItem.type === 'movie' && expandedRuntime && (
                                 <span className="expanded-duration">{expandedRuntime}</span>
                            )}
                            {displayItem.type === 'tv' && displayItem.seasons && (
                                 <span className="expanded-duration">{displayItem.seasons} Stagion{displayItem.seasons > 1 ? 'i' : 'e'}</span>
                            )}
                            <span className="expanded-resolution">HD</span>
                        </div>
                    ) : (
                        <div className="expanded-details-placeholder" aria-hidden="true">
                            <span />
                            <span />
                            <span />
                        </div>
                    )}

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
