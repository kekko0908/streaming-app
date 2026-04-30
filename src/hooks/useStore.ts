import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { MediaType, SavedItem, WatchStatus, TmdbItem } from "../types/types";
import { ProfileStats } from "../types/profileStats";

export function useStore() {
  const [myList, setMyList] = useState<SavedItem[]>([]);
  const [watchProgress, setWatchProgress] = useState<Record<string, { season: number; episode: number; watchedEpisodes?: number; totalEpisodes?: number }>>({});
  const [loading, setLoading] = useState(false);
  const [isUILocked, setIsUILocked] = useState(() => {
    return localStorage.getItem("sfa_ui_locked") === "true";
  });

  useEffect(() => {
    fetchLibrary();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) fetchLibrary();
      else { setMyList([]); setWatchProgress({}); }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function fetchLibrary() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    setLoading(true);
    const { data } = await supabase
      .from('user_library')
      .select(`*, media_items ( title, media_type, runtime, poster_path, genres, total_episodes )`);

    if (data) {
      const formattedList: SavedItem[] = data.map((row: any) => {
        const progressSeconds = Number(row.progress_seconds ?? row.current_time ?? 0) || 0;
        const progressMinutes = Number(
          (row.progress_minutes ??
          row.current_minute ??
          row.watched_minutes ??
          (progressSeconds / 60)) ||
          0
        ) || 0;
        const hasTvProgress =
          row.current_season !== null && row.current_season !== undefined ||
          row.current_episode !== null && row.current_episode !== undefined ||
          row.total_watched_episodes !== null && row.total_watched_episodes !== undefined;
        const mediaType = row.media_items?.media_type;
        const normalizedMediaType = mediaType === "movie" || mediaType === "tv" ? mediaType : undefined;
        const inferredType = normalizedMediaType ?? (hasTvProgress ? "tv" : "movie");

        return ({
        tmdbId: String(row.tmdb_id),
        type: inferredType,
        title: row.media_items?.title || 'Sconosciuto',
        status: row.status,
        addedAt: row.added_at,
        rating: row.rating || 0,
        poster: row.media_items?.poster_path || "",
        runtime: row.media_items?.runtime ? `${row.media_items.runtime} min` : "",
        genres: row.media_items?.genres || [],
        year: "", overview: "", backdrop: "",
        progressMinutes,
        progressSeconds
      });
      });
      
      formattedList.sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
      setMyList(formattedList);

      const progressMap: any = {};
      data.forEach((row: any) => {
        const hasTvProgress =
          row.current_season !== null && row.current_season !== undefined ||
          row.current_episode !== null && row.current_episode !== undefined ||
          row.total_watched_episodes !== null && row.total_watched_episodes !== undefined;
        const mediaType = row.media_items?.media_type;
        const normalizedMediaType = mediaType === "movie" || mediaType === "tv" ? mediaType : undefined;
        const inferredType = normalizedMediaType ?? (hasTvProgress ? "tv" : "movie");
        if (inferredType === "tv" && hasTvProgress) {
          progressMap[String(row.tmdb_id)] = {
            season: row.current_season || 1,
            episode: row.current_episode || 1,
            watchedEpisodes: row.total_watched_episodes || 0,
            totalEpisodes: row.media_items?.total_episodes || 0
          };
        }
      });
      setWatchProgress(progressMap);
    }
    setLoading(false);
  }

  const syncMediaItem = async (item: TmdbItem) => {
    const { error } = await supabase.functions.invoke("sync-media-item", {
      body: {
        action: "sync",
        tmdbId: parseInt(item.tmdbId, 10),
        type: item.type,
      },
    });

    if (error) throw error;
  };

  const syncMediaType = async (tmdbId: string, mediaType: MediaType) => {
    const { error } = await supabase.functions.invoke("sync-media-item", {
      body: {
        action: "update_type",
        tmdbId: parseInt(tmdbId, 10),
        mediaType,
      },
    });

    if (error) throw error;
  };

  const parseRuntimeMinutes = (runtime?: string | number, fallback = 0) => {
    if (typeof runtime === "number") return Number.isFinite(runtime) ? runtime : fallback;
    if (!runtime) return fallback;
    const parsed = parseInt(runtime, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const getTotalEpisodesFromItem = (item: TmdbItem) => {
    if (!item.seasonsDetails) return 0;
    return item.seasonsDetails.reduce((total, season) => total + (season.episode_count || 0), 0);
  };

  const recordWatchEvent = async ({
    userId,
    item,
    season,
    episode,
    episodesCount,
    minutesCount,
    eventType,
  }: {
    userId: string;
    item: TmdbItem;
    season?: number | null;
    episode?: number | null;
    episodesCount: number;
    minutesCount: number;
    eventType: "tv_progress" | "movie_completed";
  }) => {
    if (episodesCount <= 0 && minutesCount <= 0) return;

    const tmdbId = parseInt(item.tmdbId, 10);
    const normalizedSeason = season ?? null;
    const normalizedEpisode = episode ?? null;

    let duplicateCheck = supabase
      .from("watch_events")
      .select("id")
      .eq("user_id", userId)
      .eq("tmdb_id", tmdbId)
      .eq("media_type", item.type)
      .eq("event_type", eventType)
      .limit(1);

    if (eventType === "tv_progress") {
      duplicateCheck = duplicateCheck
        .eq("season_number", normalizedSeason)
        .eq("episode_number", normalizedEpisode);
    } else {
      duplicateCheck = duplicateCheck
        .is("season_number", null)
        .is("episode_number", null);
    }

    const { data: existingEvents, error: duplicateError } = await duplicateCheck;
    if (duplicateError) {
      console.error("Errore controllo evento visione duplicato:", duplicateError);
    }
    if (existingEvents && existingEvents.length > 0) return;

    const { error } = await supabase.from("watch_events").insert({
      user_id: userId,
      tmdb_id: tmdbId,
      media_type: item.type,
      season_number: normalizedSeason,
      episode_number: normalizedEpisode,
      episodes_count: Math.max(0, Math.floor(episodesCount)),
      minutes_count: Math.max(0, Math.floor(minutesCount)),
      event_type: eventType,
      watched_at: new Date().toISOString(),
    });

    if (error) console.error("Errore salvataggio evento visione:", error);
  };

  // Funzione Helper per calcolare episodi totali visti fino a S:X E:Y
  const calculateTotalEpisodes = (item: TmdbItem, currentSeason: number, currentEpisode: number) => {
      if (!item.seasonsDetails) return currentEpisode; // Fallback
      
      let total = 0;
      // Somma episodi delle stagioni completate
      item.seasonsDetails.forEach(s => {
          if (s.season_number < currentSeason) {
              total += s.episode_count;
          }
      });
      // Aggiungi episodi della stagione corrente
      total += currentEpisode;
      return total;
  };

  // --- ADD / UPDATE ---
  const addToList = async (item: TmdbItem, status: WatchStatus) => {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) return;
    await syncMediaItem(item);
    const existingItem = myList.find((saved) => saved.tmdbId === item.tmdbId);
    let pendingWatchEvent: null | {
      season?: number | null;
      episode?: number | null;
      episodesCount: number;
      minutesCount: number;
      eventType: "tv_progress" | "movie_completed";
    } = null;

    // 2. Prepara aggiornamento Utente
    const updates: any = { 
        user_id: userId, 
        tmdb_id: parseInt(item.tmdbId), 
        status: status, 
        added_at: new Date().toISOString() 
    };

    // LOGICA SERIE TV
    if (item.type === 'tv') {
        let season = 1;
        let episode = 1;
        let totalWatched = 0;

        // Caso A: Già Guardato (Tutto visto)
        if (status === 'gia-guardato' && item.seasonsDetails) {
            const lastSeason = item.seasonsDetails[item.seasonsDetails.length - 1];
            if (lastSeason) {
                season = lastSeason.season_number;
                episode = lastSeason.episode_count;
                // Calcola somma totale di TUTTI gli episodi
                totalWatched = item.seasonsDetails.reduce((acc, curr) => acc + curr.episode_count, 0);
            }
        } 
        // Caso B: In Corso / Da Guardare (Mantieni progresso attuale o inizia da 0)
        else {
            const current = watchProgress[item.tmdbId] || { season: 1, episode: 1 };
            season = current.season;
            episode = current.episode;
            // Ricalcola il totale basato sul punto dove sei arrivato
            totalWatched = calculateTotalEpisodes(item, season, episode);
        }

        updates.current_season = season;
        updates.current_episode = episode;
        updates.total_watched_episodes = totalWatched; // <--- ORA SALVIAMO SEMPRE IL TOTALE

        const previousWatched = watchProgress[item.tmdbId]?.watchedEpisodes || 0;
        const deltaEpisodes = status === "gia-guardato" ? Math.max(0, totalWatched - previousWatched) : 0;
        if (deltaEpisodes > 0) {
          const runtimeMinutes = parseRuntimeMinutes(item.runtime, 45);
          pendingWatchEvent = {
            season,
            episode,
            episodesCount: deltaEpisodes,
            minutesCount: deltaEpisodes * runtimeMinutes,
            eventType: "tv_progress",
          };
        }

        // Aggiorna UI locale
        setWatchProgress(prev => ({
          ...prev,
          [item.tmdbId]: {
            season,
            episode,
            watchedEpisodes: totalWatched,
            totalEpisodes: getTotalEpisodesFromItem(item) || prev[item.tmdbId]?.totalEpisodes || 0
          }
        }));
    } else if (item.type === "movie" && status === "gia-guardato" && existingItem?.status !== "gia-guardato") {
        const runtimeMinutes = parseRuntimeMinutes(item.runtime, 0);
        if (runtimeMinutes > 0) {
          pendingWatchEvent = {
            season: null,
            episode: null,
            episodesCount: 0,
            minutesCount: runtimeMinutes,
            eventType: "movie_completed",
          };
        }
    }

    const { error } = await supabase.from('user_library').upsert(updates, { onConflict: 'user_id, tmdb_id' });
    if (!error) {
      if (pendingWatchEvent) {
        await recordWatchEvent({ userId, item, ...pendingWatchEvent });
      }
      fetchLibrary();
    }
  };

  const removeFromList = async (tmdbId: string) => {
    setMyList((prev) => prev.filter((m) => m.tmdbId !== tmdbId));
    await supabase.from('user_library').delete().eq('tmdb_id', parseInt(tmdbId));
  };

  const rateItem = async (item: TmdbItem, rating: number) => {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) return;
    
    setMyList(prev => prev.map(m => m.tmdbId === item.tmdbId ? { ...m, rating } : m));
    await syncMediaItem(item);

    await supabase.from('user_library').upsert({ user_id: userId, tmdb_id: parseInt(item.tmdbId), rating: rating }, { onConflict: 'user_id, tmdb_id' });
  };

  // --- UPDATE PROGRESS (Click sui quadratini) ---
  const updateProgress = async (item: TmdbItem, season: number, episode: number, seconds?: number) => {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) return;

    // Se stiamo aggiornando solo i secondi (auto-save)
    if (seconds !== undefined) {
         setMyList(prev => prev.map(m => m.tmdbId === item.tmdbId ? { ...m, progressSeconds: seconds, progressMinutes: seconds / 60 } : m));
         await supabase.from('user_library').upsert({
             user_id: userId,
             tmdb_id: parseInt(item.tmdbId),
             progress_seconds: Math.floor(seconds),
             current_time: Math.floor(seconds), // Backup per retrocompatibilità
             last_watched_at: new Date().toISOString()
         }, { onConflict: 'user_id, tmdb_id' });
         return;
    }

    if (item.type !== "tv") {
      await syncMediaItem(item);

      if (typeof item.progressMinutes === "number") {
        await supabase.from('user_library').upsert({
            user_id: userId,
            tmdb_id: parseInt(item.tmdbId),
            progress_minutes: Math.max(0, Math.floor(item.progressMinutes))
        }, { onConflict: 'user_id, tmdb_id' });
      }

      return;
    }

    const currentProgress = watchProgress[item.tmdbId];

    // Calcolo preciso degli episodi totali visti fino a questo click
    const totalEpisodes = calculateTotalEpisodes(item, season, episode);
    const previousWatched = currentProgress?.watchedEpisodes || 0;
    const deltaEpisodes = Math.max(0, totalEpisodes - previousWatched);
    const totalKnownEpisodes = getTotalEpisodesFromItem(item) || currentProgress?.totalEpisodes || 0;

    setWatchProgress((prev: any) => ({
      ...prev,
      [item.tmdbId]: {
        season,
        episode,
        watchedEpisodes: totalEpisodes,
        totalEpisodes: totalKnownEpisodes
      }
    }));
    await syncMediaItem(item);

    // Determinare automaticamente lo stato
    let newStatus = 'in-corso';
    if (item.seasonsDetails && item.seasonsDetails.length > 0) {
        const sortedSeasons = [...item.seasonsDetails].sort((a,b) => a.season_number - b.season_number);
        const lastSeason = sortedSeasons[sortedSeasons.length - 1];
        if (season === lastSeason.season_number && episode >= lastSeason.episode_count) {
             newStatus = 'gia-guardato';
        }
    }

    // Upsert Library
    const { error } = await supabase.from('user_library').upsert({
        user_id: userId,
        tmdb_id: parseInt(item.tmdbId),
        current_season: season,
        current_episode: episode,
        total_watched_episodes: totalEpisodes, // <--- SALVIAMO IL TOTALE ANCHE QUI
        status: newStatus
    }, { onConflict: 'user_id, tmdb_id' });

    if (!error && deltaEpisodes > 0) {
      const runtimeMinutes = parseRuntimeMinutes(item.runtime, 45);
      await recordWatchEvent({
        userId,
        item,
        season,
        episode,
        episodesCount: deltaEpisodes,
        minutesCount: deltaEpisodes * runtimeMinutes,
        eventType: "tv_progress",
      });
    }
  };

  const updateMediaType = async (tmdbId: string, mediaType: MediaType) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setMyList(prev => prev.map(item => (
      item.tmdbId === tmdbId ? { ...item, type: mediaType } : item
    )));

    if (mediaType === "movie") {
      setWatchProgress(prev => {
        const { [tmdbId]: _removed, ...rest } = prev;
        return rest;
      });
    }

    await syncMediaType(tmdbId, mediaType);

    if (mediaType === "movie") {
      await supabase
        .from('user_library')
        .update({ current_season: null, current_episode: null, total_watched_episodes: null })
        .eq('user_id', user.id)
        .eq('tmdb_id', parseInt(tmdbId));
    }

    fetchLibrary();
  };

  const getProgress = (tmdbId: string) => watchProgress[tmdbId] || { season: 1, episode: 1, watchedEpisodes: 0, totalEpisodes: 0 };

  const fetchStats = async (): Promise<ProfileStats | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    let data: any = null;
    let error: any = null;

    const primaryResult = await supabase.rpc('get_profile_stats');
    data = primaryResult.data;
    error = primaryResult.error;

    if (error) {
      const fallbackResult = await supabase.rpc('get_profile_stats', { target_user_id: user.id });
      data = fallbackResult.data;
      error = fallbackResult.error;
    }

    if (error) {
      console.error(error);
      return {
        movie_minutes: 0,
        tv_minutes: 0,
        total_minutes: 0,
        genres: {},
        advanced_stats: {
          episodes_total: 0,
          completed_series: 0,
          active_series: 0,
          watched_movies: 0,
          library_total: 0,
          watchlist_total: 0,
          rated_titles: 0,
          avg_rating: 0,
          movie_share_percent: 0,
          tv_share_percent: 0,
          longest_series_title: "",
          longest_series_poster: "",
          longest_series_episodes: 0,
          heaviest_title: "",
          heaviest_poster: "",
          heaviest_media_type: "",
          heaviest_minutes: 0,
          longest_movie_title: "",
          longest_movie_poster: "",
          longest_movie_minutes: 0,
        },
        personal_records: {
          max_episodes_day: 0,
          max_episodes_day_date: "",
          max_same_series_day: 0,
          max_same_series_title: "",
          max_minutes_day: 0,
          max_minutes_day_date: "",
          top_binge_series_title: "",
          top_binge_series_episodes: 0,
          watch_streak_days: 0,
        },
        joinDate: new Date(user.created_at).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
      };
    }
    return {
        ...data,
        advanced_stats: {
          episodes_total: 0,
          completed_series: 0,
          active_series: 0,
          watched_movies: 0,
          library_total: 0,
          watchlist_total: 0,
          rated_titles: 0,
          avg_rating: 0,
          movie_share_percent: 0,
          tv_share_percent: 0,
          longest_series_title: "",
          longest_series_poster: "",
          longest_series_episodes: 0,
          heaviest_title: "",
          heaviest_poster: "",
          heaviest_media_type: "",
          heaviest_minutes: 0,
          longest_movie_title: "",
          longest_movie_poster: "",
          longest_movie_minutes: 0,
          ...(data?.advanced_stats || {}),
        },
        personal_records: {
          max_episodes_day: 0,
          max_episodes_day_date: "",
          max_same_series_day: 0,
          max_same_series_title: "",
          max_minutes_day: 0,
          max_minutes_day_date: "",
          top_binge_series_title: "",
          top_binge_series_episodes: 0,
          watch_streak_days: 0,
          ...(data?.personal_records || {}),
        },
        joinDate: new Date(user.created_at).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
    };
  };

  const toggleUILock = () => {
    setIsUILocked(prev => {
      const newState = !prev;
      localStorage.setItem("sfa_ui_locked", newState.toString());
      return newState;
    });
  };

  return { myList, addToList, removeFromList, rateItem, updateProgress, updateMediaType, getProgress, fetchStats, loading, isUILocked, toggleUILock };
}
