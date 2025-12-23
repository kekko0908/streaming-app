import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { SavedItem, WatchStatus, TmdbItem } from "../types/types";

export function useStore() {
  const [myList, setMyList] = useState<SavedItem[]>([]);
  const [watchProgress, setWatchProgress] = useState<Record<string, { season: number; episode: number }>>({});
  const [loading, setLoading] = useState(false);

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
      .select(`*, media_items ( title, media_type, runtime, poster_path, genres )`);

    if (data) {
      const formattedList: SavedItem[] = data.map((row: any) => {
        const progressMinutes = Number(
          row.current_time ??
          row.current_minute ??
          row.progress_minutes ??
          row.watched_minutes ??
          0
        ) || 0;

        return ({
        tmdbId: String(row.tmdb_id),
        type: row.media_items?.media_type || 'movie',
        title: row.media_items?.title || 'Sconosciuto',
        status: row.status,
        addedAt: row.added_at,
        rating: row.rating || 0,
        poster: row.media_items?.poster_path || "",
        runtime: row.media_items?.runtime ? `${row.media_items.runtime} min` : "",
        genres: row.media_items?.genres || [],
        year: "", overview: "", backdrop: "",
        progressMinutes
      });
      });
      
      formattedList.sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
      setMyList(formattedList);

      const progressMap: any = {};
      data.forEach((row: any) => {
        if (row.media_items?.media_type === 'tv') {
          progressMap[String(row.tmdb_id)] = { season: row.current_season || 1, episode: row.current_episode || 1 };
        }
      });
      setWatchProgress(progressMap);
    }
    setLoading(false);
  }

  // Helper durata
  const parseRuntime = (runtimeStr?: string) => {
    if (!runtimeStr) return 0;
    return parseInt(runtimeStr.split(" ")[0]) || 0;
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

    const runtimeVal = parseRuntime(item.runtime);
    
    // 1. Aggiorna Media (con durata corretta)
    await supabase.from('media_items').upsert({
        tmdb_id: parseInt(item.tmdbId),
        title: item.title,
        media_type: item.type,
        runtime: runtimeVal,
        poster_path: item.poster,
        genres: item.genres || [] 
    }, { onConflict: 'tmdb_id' });

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

        // Aggiorna UI locale
        setWatchProgress(prev => ({ ...prev, [item.tmdbId]: { season, episode } }));
    }

    const { error } = await supabase.from('user_library').upsert(updates, { onConflict: 'user_id, tmdb_id' });
    if (!error) fetchLibrary();
  };

  const removeFromList = async (tmdbId: string) => {
    setMyList((prev) => prev.filter((m) => m.tmdbId !== tmdbId));
    await supabase.from('user_library').delete().eq('tmdb_id', parseInt(tmdbId));
  };

  const rateItem = async (item: TmdbItem, rating: number) => {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) return;
    
    setMyList(prev => prev.map(m => m.tmdbId === item.tmdbId ? { ...m, rating } : m));
    
    await supabase.from('media_items').upsert({
        tmdb_id: parseInt(item.tmdbId),
        title: item.title,
        media_type: item.type,
        runtime: parseRuntime(item.runtime),
        poster_path: item.poster,
        genres: item.genres || []
    }, { onConflict: 'tmdb_id' });

    await supabase.from('user_library').upsert({ user_id: userId, tmdb_id: parseInt(item.tmdbId), rating: rating }, { onConflict: 'user_id, tmdb_id' });
  };

  // --- UPDATE PROGRESS (Click sui quadratini) ---
  const updateProgress = async (item: TmdbItem, season: number, episode: number) => {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) return;

    setWatchProgress((prev: any) => ({ ...prev, [item.tmdbId]: { season, episode } }));

    // Calcolo preciso degli episodi totali visti fino a questo click
    const totalEpisodes = calculateTotalEpisodes(item, season, episode);

    // Upsert media
    await supabase.from('media_items').upsert({ 
        tmdb_id: parseInt(item.tmdbId), 
        title: item.title, 
        media_type: 'tv',
        runtime: parseRuntime(item.runtime),
        poster_path: item.poster,
        genres: item.genres || []
    }, { onConflict: 'tmdb_id' });

    // Upsert Library
    await supabase.from('user_library').upsert({
        user_id: userId,
        tmdb_id: parseInt(item.tmdbId),
        current_season: season,
        current_episode: episode,
        total_watched_episodes: totalEpisodes // <--- SALVIAMO IL TOTALE ANCHE QUI
    }, { onConflict: 'user_id, tmdb_id' });
  };

  const getProgress = (tmdbId: string) => watchProgress[tmdbId] || { season: 1, episode: 1 };

  const fetchStats = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase.rpc('get_profile_stats', { target_user_id: user.id });
    if (error) { console.error(error); return null; }
    return {
        ...data,
        joinDate: new Date(user.created_at).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
    };
  };

  return { myList, addToList, removeFromList, rateItem, updateProgress, getProgress, fetchStats, loading };
}
