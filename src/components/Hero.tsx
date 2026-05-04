import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import "../css/hero.css";
import { SavedItem, TmdbItem, WatchStatus } from "../types/types";
import { fetchTitleLogo, fetchTrailer } from "../utils/api";
import { logDevError } from "../utils/logging";
import { preloadImage } from "../utils/images";
import { useExclusiveTrailerPlayback } from "../hooks/useExclusiveTrailerPlayback";
import { CollectionStrip } from "./hero/CollectionStrip";
import { EpisodesCarousel } from "./hero/EpisodesCarousel";
import { HeroActions } from "./hero/HeroActions";
import { HeroBackground } from "./hero/HeroBackground";
import { HeroTab, HeroTabs } from "./hero/HeroTabs";

interface HeroProps {
  item: TmdbItem;
  myList: SavedItem[];
  progress: { season: number; episode: number; watchedEpisodes?: number; totalEpisodes?: number; progressSeconds?: number; progressMinutes?: number };
  onPlay: (season: number, episode: number) => void;
  onAddToList: (status: WatchStatus) => void;
  onRate: (rating: number) => void;
  onRemoveFromList: () => void;
  onClose: () => void;
  onSelectCollectionItem?: (item: TmdbItem) => void;
  isUILocked: boolean;
  toggleUILock: () => void;
}

export default function Hero({
  item,
  myList,
  progress,
  onPlay,
  onAddToList,
  onRate,
  onRemoveFromList,
  onClose,
  onSelectCollectionItem,
  isUILocked,
  toggleUILock,
}: HeroProps) {
  const savedItem = myList.find((saved) => saved.tmdbId === item.tmdbId);
  const userRating = savedItem?.rating || 0;
  const currentListStatus = savedItem?.status as WatchStatus | undefined;
  const runtimeLabel = item.runtime ? (item.runtime.toLowerCase().includes("min") ? item.runtime : `${item.runtime} min`) : "";
  const hasEpisodes = item.type === "tv" && Boolean(item.seasonsDetails?.length);

  const [activeTab, setActiveTab] = useState<HeroTab>("panoramica");
  const [showBgVideo, setShowBgVideo] = useState(false);
  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [isLogoLoading, setIsLogoLoading] = useState(false);
  const [effectiveProgressEpisode, setEffectiveProgressEpisode] = useState(progress.episode);

  const isBgTrailerActive = useExclusiveTrailerPlayback(
    `hero-${item.type}-${item.tmdbId}`,
    showBgVideo && Boolean(trailerKey)
  );

  useEffect(() => {
    let isMounted = true;
    setActiveTab("panoramica");
    setEffectiveProgressEpisode(progress.episode);
    setTrailerKey(null);
    setLogoUrl(item.logo || null);
    setIsLogoLoading(!item.logo);
    setShowBgVideo(false);

    fetchTrailer(item.tmdbId, item.type)
      .then((key) => {
        if (isMounted) setTrailerKey(key);
      })
      .catch((error) => {
        logDevError("Errore caricamento trailer hero", error);
        if (isMounted) setTrailerKey(null);
      });

    fetchTitleLogo(item.tmdbId, item.type)
      .then(async (logo) => {
        const nextLogo = logo || item.logo || null;
        if (nextLogo) await preloadImage(nextLogo);
        if (!isMounted) return;
        setLogoUrl(nextLogo);
        setIsLogoLoading(false);
      })
      .catch((error) => {
        logDevError("Errore caricamento logo hero", error);
        if (!isMounted) return;
        setLogoUrl(item.logo || null);
        setIsLogoLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [item.tmdbId, progress.episode, item.type, item.logo]);

  useEffect(() => {
    if (!trailerKey) return;
    const timer = setTimeout(() => setShowBgVideo(true), 2500);
    return () => clearTimeout(timer);
  }, [trailerKey]);

  const handleEffectiveEpisodeChange = useCallback((episode: number) => {
    setEffectiveProgressEpisode(episode);
  }, []);

  const seriesResumeSeconds = item.type === "tv" ? Math.max(0, progress.progressSeconds || item.progressSeconds || 0) : 0;
  const hasSeriesResume =
    item.type === "tv" &&
    (seriesResumeSeconds > 15 ||
      (progress.watchedEpisodes || 0) > 0 ||
      progress.season > 1 ||
      progress.episode > 1 ||
      currentListStatus === "in-corso");
  const primarySeriesLabel = hasSeriesResume
    ? `Riprendi S${progress.season}:E${progress.episode}`
    : `Guarda S${progress.season}:E${progress.episode}`;
  const effectivePrimarySeriesLabel =
    effectiveProgressEpisode !== progress.episode
      ? `Ultimo disponibile S${progress.season}:E${effectiveProgressEpisode}`
      : primarySeriesLabel;

  return (
    <section className="hero">
      <HeroBackground item={item} trailerKey={trailerKey} isBgTrailerActive={isBgTrailerActive} />

      <div className={`hero-content tab-${activeTab}`}>
        <div className="hero-title-lockup">
          {logoUrl ? (
            <img className="hero-logo-art" src={logoUrl} alt={item.title} loading="eager" decoding="async" />
          ) : isLogoLoading ? (
            <div className="hero-logo-skeleton" aria-hidden="true" />
          ) : !isBgTrailerActive ? (
            <h1 className="netflix-title">{item.title}</h1>
          ) : null}
        </div>

        <div className="netflix-meta">
          <span>{item.year || "N/D"}</span>
          <span className="separator">•</span>
          {item.type === "movie" && runtimeLabel && <span>{runtimeLabel}</span>}
          {item.type === "tv" && item.seasons && <span>{item.seasons} stagioni</span>}
          <span className="separator">•</span>
          <span>{item.type === "movie" ? "Film" : "Serie TV"}</span>
        </div>

        <HeroActions
          item={item}
          progress={progress}
          primaryLabel={effectivePrimarySeriesLabel}
          currentListStatus={currentListStatus}
          userRating={userRating}
          isUILocked={isUILocked}
          onPlay={onPlay}
          onAddToList={onAddToList}
          onRate={onRate}
          onRemoveFromList={onRemoveFromList}
          onToggleUILock={toggleUILock}
          onClose={onClose}
        />

        <HeroTabs activeTab={activeTab} hasEpisodes={hasEpisodes} hasCollection={Boolean(item.collection)} onChange={setActiveTab} />

        <div className="hero-tab-content">
          {activeTab === "panoramica" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="tab-panoramica">
              <p className="hero-overview netflix-overview">{item.overview}</p>

              {item.genres && item.genres.length > 0 && (
                <div className="hero-extra-info">
                  <span className="info-label">Generi:</span> {item.genres.join(", ")}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === "dettagli" && item.collection && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="tab-dettagli">
              <CollectionStrip parts={item.collection.parts} onSelect={onSelectCollectionItem} />
            </motion.div>
          )}

          {activeTab === "episodi" && hasEpisodes && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="tab-episodi">
              <EpisodesCarousel item={item} progress={progress} onPlay={onPlay} onEffectiveEpisodeChange={handleEffectiveEpisodeChange} />
            </motion.div>
          )}
        </div>
      </div>
    </section>
  );
}
