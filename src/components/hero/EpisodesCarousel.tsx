import { useEffect, useRef, useState } from "react";
import { Episode, TmdbItem } from "../../types/types";
import { fetchSeasonEpisodes } from "../../utils/api";
import { isEpisodeReleased } from "../../utils/episodeAvailability";
import { logDevError } from "../../utils/logging";
import { Icon } from "../ui/Icon";

function formatProgressTime(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function EpisodesCarousel({
  item,
  progress,
  onPlay,
  onEffectiveEpisodeChange,
}: {
  item: TmdbItem;
  progress: { season: number; episode: number; watchedEpisodes?: number; progressSeconds?: number };
  onPlay: (season: number, episode: number) => void;
  onEffectiveEpisodeChange: (episode: number) => void;
}) {
  const [uiSelectedSeason, setUiSelectedSeason] = useState<number>(progress.season || 1);
  const [episodesList, setEpisodesList] = useState<Episode[]>([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const episodeListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setUiSelectedSeason(progress.season || 1);
  }, [item.tmdbId, progress.season]);

  useEffect(() => {
    if (item.type !== "tv") return;

    let isActive = true;
    setLoadingEpisodes(true);
    episodeListRef.current?.scrollTo({ left: 0 });

    fetchSeasonEpisodes(item.tmdbId, uiSelectedSeason)
      .then((data) => {
        if (!isActive) return;
        setEpisodesList(data);
      })
      .catch((error) => {
        logDevError("Errore caricamento episodi hero", error);
        if (isActive) setEpisodesList([]);
      })
      .finally(() => {
        if (isActive) setLoadingEpisodes(false);
      });

    return () => {
      isActive = false;
    };
  }, [item.tmdbId, uiSelectedSeason, item.type]);

  const releasedEpisodesInCurrentSeason = uiSelectedSeason === progress.season
    ? episodesList.filter((ep) => isEpisodeReleased(ep, item, uiSelectedSeason))
    : [];
  const latestReleasedEpisodeNumber = releasedEpisodesInCurrentSeason.length > 0
    ? Math.max(...releasedEpisodesInCurrentSeason.map((ep) => ep.episode_number))
    : null;
  const hasUnavailableResumeTarget =
    item.type === "tv" &&
    uiSelectedSeason === progress.season &&
    latestReleasedEpisodeNumber !== null &&
    progress.episode > latestReleasedEpisodeNumber;
  const effectiveProgressEpisode = hasUnavailableResumeTarget && latestReleasedEpisodeNumber
    ? latestReleasedEpisodeNumber
    : progress.episode;

  useEffect(() => {
    onEffectiveEpisodeChange(effectiveProgressEpisode);
  }, [effectiveProgressEpisode, onEffectiveEpisodeChange]);

  useEffect(() => {
    if (loadingEpisodes || episodesList.length === 0) return;

    const timer = setTimeout(() => {
      const currentCard = document.getElementById("current-episode-anchor");
      const container = episodeListRef.current;
      if (!currentCard || !container) return;

      const scrollPos = currentCard.offsetLeft - container.clientWidth / 2 + currentCard.clientWidth / 2;
      container.scrollTo({ left: Math.max(0, scrollPos), behavior: "smooth" });
    }, 300);

    return () => clearTimeout(timer);
  }, [loadingEpisodes, episodesList, uiSelectedSeason]);

  const scrollEpisodes = (direction: "left" | "right") => {
    const current = episodeListRef.current;
    if (!current) return;

    const scrollAmount = 320;
    current.scrollTo({
      left: direction === "left" ? current.scrollLeft - scrollAmount : current.scrollLeft + scrollAmount,
      behavior: "smooth",
    });
  };

  return (
    <>
      <div className="episodes-header">
        <h3>Nuovi Episodi</h3>
        <div className="netflix-season-select-wrapper">
          <select className="netflix-season-select" value={uiSelectedSeason} onChange={(event) => setUiSelectedSeason(Number(event.target.value))}>
            {item.seasonsDetails!.map((season) => (
              <option key={season.season_number} value={season.season_number}>
                Stagione {season.season_number}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="episode-carousel-wrapper netflix-carousel">
        <button className="ep-nav-btn left" onClick={() => scrollEpisodes("left")} aria-label="Episodi precedenti">
          <Icon name="chevron-left" size={24} />
        </button>

        <div className="episode-grid" ref={episodeListRef}>
          {loadingEpisodes ? (
            <p className="episode-loading-message">Caricamento episodi...</p>
          ) : episodesList.length > 0 ? (
            episodesList.map((ep) => {
              const released = isEpisodeReleased(ep, item, uiSelectedSeason);
              const isCurrent = uiSelectedSeason === progress.season && ep.episode_number === effectiveProgressEpisode;
              const episodesBeforeSeason =
                item.seasonsDetails
                  ?.filter((season) => season.season_number < uiSelectedSeason)
                  .reduce((total, season) => total + season.episode_count, 0) || 0;
              const episodeAbsoluteNumber = episodesBeforeSeason + ep.episode_number;
              const isWatched =
                released &&
                (progress.watchedEpisodes
                  ? episodeAbsoluteNumber <= progress.watchedEpisodes
                  : uiSelectedSeason < progress.season || (uiSelectedSeason === progress.season && ep.episode_number < effectiveProgressEpisode));
              const runtimeMinutes = Number.parseInt(item.runtime || "", 10);
              const episodeDurationSeconds = (Number.isFinite(runtimeMinutes) && runtimeMinutes > 0 ? runtimeMinutes : 45) * 60;
              const episodeProgressSeconds = released && isCurrent ? progress.progressSeconds || 0 : 0;
              const partialProgressPercent = !isWatched && episodeProgressSeconds
                ? Math.min(98, Math.max(0, (episodeProgressSeconds / episodeDurationSeconds) * 100))
                : 0;
              const imgUrl = ep.still_path ? `https://image.tmdb.org/t/p/w500${ep.still_path}` : item.backdrop || "https://via.placeholder.com/500x280?text=No+Image";

              return (
                <div
                  key={ep.id}
                  id={isCurrent ? "current-episode-anchor" : undefined}
                  className={`episode-card netflix-ep-card ${isCurrent ? "current" : ""} ${isWatched ? "watched" : ""} ${!released ? "locked" : ""}`}
                  onClick={() => {
                    if (released) onPlay(uiSelectedSeason, ep.episode_number);
                  }}
                  title={!released ? (ep.air_date ? `Esce il ${ep.air_date}` : "Data non confermata") : ep.name}
                >
                  <div className="episode-img-container">
                    <img src={imgUrl} alt={ep.name} className="episode-img" loading="lazy" decoding="async" />
                    <div className="netflix-ep-number">{ep.episode_number}</div>

                    {isWatched && (
                      <div className="watched-overlay">
                        <Icon name="check" size={22} className="checkmark" />
                      </div>
                    )}

                    {!released && (
                      <div className="locked-overlay">
                        <Icon name="lock" size={24} />
                        <span className="locked-text">{ep.air_date || "Data non confermata"}</span>
                      </div>
                    )}
                    {isCurrent && !isWatched && episodeProgressSeconds > 15 && (
                      <div className="episode-resume-badge">Riprendi da {formatProgressTime(episodeProgressSeconds)}</div>
                    )}
                    {(isWatched || partialProgressPercent > 0) && (
                      <div className="episode-neon-progress" aria-hidden="true">
                        <div className={`episode-neon-progress-fill ${isWatched ? "complete" : ""}`} style={{ width: `${isWatched ? 100 : partialProgressPercent}%` }} />
                      </div>
                    )}
                  </div>
                  <div className="episode-info">
                    <h4 className={`episode-title ${isWatched ? "is-watched" : ""}`}>{ep.name || `Episodio ${ep.episode_number}`}</h4>
                    <p className="episode-desc">{ep.overview || "Nessuna trama disponibile."}</p>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="episode-empty-message">Nessun episodio disponibile.</p>
          )}
        </div>

        <button className="ep-nav-btn right" onClick={() => scrollEpisodes("right")} aria-label="Episodi successivi">
          <Icon name="chevron-right" size={24} />
        </button>
      </div>
    </>
  );
}
