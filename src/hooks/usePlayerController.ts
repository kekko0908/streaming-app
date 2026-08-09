import { useEffect, useState } from "react";
import { TmdbItem } from "../types/types";
import { fetchDetails, fetchReleaseInfo } from "../utils/api";
import { isVerifiedFutureDigitalRelease } from "../utils/release";
import { setTrailerPlaybackBlocked } from "../utils/trailerPlayback";
import { useDirectActions } from "./useDirectActions";
import { supabase } from "../supabaseClient";

type ProgressGetter = (tmdbId: string) => {
  season: number;
  episode: number;
  watchedEpisodes?: number;
  totalEpisodes?: number;
  progressSeconds?: number;
  progressMinutes?: number;
};

export function usePlayerController({
  session,
  navigate,
  myList,
  addToList,
  removeFromList,
  updateProgress,
  getProgress,
  selected,
  setSelected,
}: {
  session: { user?: unknown } | null;
  navigate: (path: string) => void;
  myList: TmdbItem[];
  addToList: (item: TmdbItem, status: any) => void;
  removeFromList: (tmdbId: string) => void;
  updateProgress: (item: TmdbItem, season: number, episode: number, seconds?: number) => Promise<void> | void;
  getProgress: ProgressGetter;
  selected: TmdbItem | null;
  setSelected: (item: TmdbItem | null) => void;
}) {
  const [playingItem, setPlayingItem] = useState<TmdbItem | null>(null);
  const [showPlayer, setShowPlayer] = useState(false);
  const [isPipMode, setIsPipMode] = useState(false);
  const [playerState, setPlayerState] = useState<{ season: number; episode: number; startAt?: number } | null>(null);
  const [unavailableItem, setUnavailableItem] = useState<TmdbItem | null>(null);

  useEffect(() => {
    const syncTrailerPlaybackState = () => {
      setTrailerPlaybackBlocked(showPlayer || document.hidden);
    };

    syncTrailerPlaybackState();
    document.addEventListener("visibilitychange", syncTrailerPlaybackState);

    return () => {
      document.removeEventListener("visibilitychange", syncTrailerPlaybackState);
    };
  }, [showPlayer]);

  const getPlayableMovieItem = async (item: TmdbItem) => {
    if (item.type !== "movie") return item;
    const freshItem = await fetchDetails(item.tmdbId, item.type).catch(() => item);
    const releaseInfo = await fetchReleaseInfo(item.tmdbId, "IT").catch((error) => {
      console.warn("Verifica uscita digitale non riuscita: Play resta disponibile", error);
      return {
        date: undefined, region: "IT", kind: "unknown", verification: "unknown", phase: "unknown",
        checkedAt: new Date().toISOString(),
      } as const;
    });
    return {
      ...item,
      ...freshItem,
      releaseInfo,
      releaseDateFull: releaseInfo.date || freshItem.releaseDateFull || item.releaseDateFull,
      progressMinutes: item.progressMinutes,
      progressSeconds: item.progressSeconds,
    };
  };

  const handlePlay = async (season: number, episode: number, item: TmdbItem) => {
    if (!session) {
      alert("Devi accedere!");
      navigate("/auth");
      return;
    }

    const playableItem = await getPlayableMovieItem(item);

    if (isVerifiedFutureDigitalRelease(playableItem)) {
      setUnavailableItem(playableItem);
      return;
    }

    const storedProgress = playableItem.type === "tv" ? getProgress(playableItem.tmdbId) : null;
    const savedSeconds = storedProgress?.season === season && storedProgress?.episode === episode
      ? storedProgress.progressSeconds || playableItem.progressSeconds || 0
      : playableItem.progressSeconds || 0;
    const startAt = savedSeconds > 15 ? savedSeconds : 0;

    setTrailerPlaybackBlocked(true);
    setPlayingItem(playableItem);
    setPlayerState({ season, episode, startAt });
    setShowPlayer(true);
    if (playableItem.type === "movie" || startAt > 0) {
      updateProgress(playableItem, season, episode, startAt);
    }
    if (!myList.find((listItem) => listItem.tmdbId === playableItem.tmdbId)) addToList(playableItem, "in-corso");
  };

  useDirectActions({
    onPlayDirect: async ({ item, season, episode }) => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (!currentSession) {
          navigate("/auth");
          return;
        }

        const fullItem = await getPlayableMovieItem(await fetchDetails(item.tmdbId, item.type));
        if (typeof item.progressMinutes === "number") fullItem.progressMinutes = item.progressMinutes;
        if (typeof item.progressSeconds === "number") fullItem.progressSeconds = item.progressSeconds;
        setSelected(fullItem);

        if (isVerifiedFutureDigitalRelease(fullItem)) {
          setUnavailableItem(fullItem);
          return;
        }

        setPlayingItem(fullItem);
        const startAt = fullItem.progressSeconds && fullItem.progressSeconds > 15 ? fullItem.progressSeconds : 0;
        setTrailerPlaybackBlocked(true);
        setPlayerState({ season, episode, startAt });
        setShowPlayer(true);
        if (fullItem.type === "movie" || startAt > 0) {
          updateProgress(fullItem, season, episode, startAt);
        }
      } catch (error) {
        console.error("Errore Play Diretto", error);
      }
    },
    onAddToListDirect: async ({ item, status = "da-guardare" }) => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (!currentSession) {
          alert("Devi accedere!");
          navigate("/auth");
          return;
        }

        const fullItem = await fetchDetails(item.tmdbId, item.type);
        addToList(fullItem, status);
      } catch (error) {
        console.error("Errore aggiunta diretta alla lista", error);
      }
    },
    onRemoveFromListDirect: ({ tmdbId }) => {
      removeFromList(tmdbId);
    },
  });

  const closePlayer = () => {
    setShowPlayer(false);
    setIsPipMode(false);
    setPlayingItem(null);
  };

  const clearAllPlayerState = () => {
    closePlayer();
    setUnavailableItem(null);
  };

  return {
    playingItem,
    showPlayer,
    isPipMode,
    setIsPipMode,
    playerState,
    unavailableItem,
    setUnavailableItem,
    handlePlay,
    closePlayer,
    clearAllPlayerState,
    playerOverlayProps: {
      showPlayer,
      playerState,
      playingItem,
      isPipMode,
      unavailableItem,
      onClosePlayer: closePlayer,
      onTogglePip: () => setIsPipMode((current) => !current),
      onNavigateEpisode: (season: number, episode: number) => {
        if (playingItem) handlePlay(season, episode, playingItem);
      },
      onProgressUpdate: (seconds: number) => {
        if (playingItem && playerState) updateProgress(playingItem, playerState.season, playerState.episode, seconds);
      },
      onEpisodeWatched: async (season: number, episode: number, nextTarget?: { season: number; episode: number } | null) => {
        if (!playingItem) return;
        await updateProgress(playingItem, season, episode);
        if (nextTarget) {
          await updateProgress(playingItem, nextTarget.season, nextTarget.episode, 0);
        }
      },
      onCloseUnavailable: () => setUnavailableItem(null),
    },
  };
}
