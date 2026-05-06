import { supabase } from "../supabaseClient";
import { MediaType, TmdbItem } from "../types/types";

const requestCache = new Map<string, Promise<unknown>>();

function getCached<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const cached = requestCache.get(key) as Promise<T> | undefined;
  if (cached) return cached;

  const nextValue = loader().catch((error) => {
    requestCache.delete(key);
    throw error;
  });

  requestCache.set(key, nextValue);
  return nextValue;
}

async function invokeTmdb<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("tmdb-proxy", { body });
  if (error) throw error;
  return data as T;
}

export async function searchTmdb(query: string, type: MediaType) {
  return invokeTmdb<TmdbItem[]>({ action: "search", query, type });
}

export async function fetchDetails(tmdbId: string, type: MediaType): Promise<TmdbItem> {
  return getCached(`details:${type}:${tmdbId}`, () =>
    invokeTmdb<TmdbItem>({ action: "details", tmdbId, type })
  );
}

export async function fetchCollection(endpoint: string): Promise<TmdbItem[]> {
  return getCached(`collection:${endpoint}`, () =>
    invokeTmdb<TmdbItem[]>({ action: "collection", endpoint })
  );
}

export async function fetchByGenre(genreId: number, type: MediaType = "movie"): Promise<TmdbItem[]> {
  return getCached(`genre:${type}:${genreId}`, () =>
    invokeTmdb<TmdbItem[]>({ action: "genre", genreId, type })
  );
}

export async function fetchPopularMovies(region: string = "IT"): Promise<TmdbItem[]> {
  return getCached(`popular-movies:${region}`, () =>
    invokeTmdb<TmdbItem[]>({ action: "popular_movies", region })
  );
}

export async function fetchPopularTV(): Promise<TmdbItem[]> {
  return getCached("popular-tv", () => invokeTmdb<TmdbItem[]>({ action: "popular_tv" }));
}

export async function fetchUpcoming(region: string = "IT"): Promise<TmdbItem[]> {
  return getCached(`upcoming:${region}`, () =>
    invokeTmdb<TmdbItem[]>({ action: "upcoming", region })
  );
}

function mapUpcomingReleaseRow(row: any): TmdbItem {
  const snapshot = row.item_snapshot && typeof row.item_snapshot === "object" ? row.item_snapshot : {};
  return {
    ...snapshot,
    tmdbId: String(row.tmdb_id),
    type: row.media_type,
    title: row.title || snapshot.title || "",
    releaseDateFull: row.release_date || snapshot.releaseDateFull || "",
    year: row.release_date ? String(row.release_date).slice(0, 4) : snapshot.year || "",
    poster: row.poster || snapshot.poster || "",
    backdrop: row.backdrop || snapshot.backdrop || "",
    overview: snapshot.overview || "",
    rating: Number(snapshot.rating || 0),
  } as TmdbItem;
}

export async function fetchUpcomingReleases(region: string = "IT"): Promise<TmdbItem[]> {
  const today = new Date();
  const todayKey = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");

  const { data, error } = await supabase
    .from("upcoming_releases")
    .select("tmdb_id, media_type, title, poster, backdrop, release_date, item_snapshot")
    .eq("region", region)
    .eq("release_status", "upcoming")
    .gt("release_date", todayKey)
    .order("release_date", { ascending: true })
    .limit(80);

  if (error) throw error;
  return (data || []).map(mapUpcomingReleaseRow);
}

export async function fetchUpcomingReleaseByTmdbId(tmdbId: string, region: string = "IT"): Promise<TmdbItem | null> {
  const { data, error } = await supabase
    .from("upcoming_releases")
    .select("tmdb_id, media_type, title, poster, backdrop, release_date, item_snapshot")
    .eq("region", region)
    .eq("media_type", "movie")
    .eq("tmdb_id", parseInt(tmdbId, 10))
    .eq("release_status", "upcoming")
    .maybeSingle();

  if (error) throw error;
  return data ? mapUpcomingReleaseRow(data) : null;
}

export async function refreshUpcomingReleases(region: string = "IT"): Promise<TmdbItem[]> {
  const { data, error } = await supabase.functions.invoke("refresh-upcoming-releases", {
    body: { region },
  });
  if (error) throw error;
  const items = Array.isArray((data as any)?.items) ? (data as any).items : [];
  return items as TmdbItem[];
}

export async function fetchUpcomingFromStore(region: string = "IT"): Promise<TmdbItem[]> {
  return getCached(`upcoming-store:${region}`, async () => {
    try {
      const refreshed = await refreshUpcomingReleases(region);
      if (refreshed.length > 0) return refreshed;
    } catch (error) {
      console.warn("Refresh upcoming releases non disponibile, uso tabella/fallback TMDB", error);
    }

    try {
      const stored = await fetchUpcomingReleases(region);
      if (stored.length > 0) return stored;
    } catch (error) {
      console.warn("Tabella upcoming_releases non disponibile, uso fallback TMDB", error);
    }

    return fetchUpcoming(region);
  });
}

export async function fetchNowPlaying(region: string = "IT"): Promise<TmdbItem[]> {
  return getCached(`now-playing:${region}`, () =>
    invokeTmdb<TmdbItem[]>({ action: "now_playing", region })
  );
}

export async function fetchRecommendations(tmdbId: string, type: MediaType): Promise<TmdbItem[]> {
  return getCached(`recommendations:${type}:${tmdbId}`, () =>
    invokeTmdb<TmdbItem[]>({ action: "recommendations", tmdbId, type })
  );
}

export async function discoverContent(
  type: MediaType,
  sort: string,
  genre?: string,
  year?: string,
  vote?: string,
  providers?: string,
  runtimeMin?: number,
  runtimeMax?: number,
  page: number = 1
): Promise<TmdbItem[]> {
  return invokeTmdb<TmdbItem[]>({
    action: "discover",
    type,
    sort,
    genre,
    year,
    vote,
    providers,
    runtimeMin,
    runtimeMax,
    page,
  });
}

export async function fetchPersonCredits(personId: number): Promise<TmdbItem[]> {
  return invokeTmdb<TmdbItem[]>({ action: "person_credits", personId });
}

export async function fetchTrailer(tmdbId: string, type: MediaType): Promise<string | null> {
  return getCached(`trailer:${type}:${tmdbId}`, () =>
    invokeTmdb<string | null>({ action: "trailer", tmdbId, type })
  );
}

export async function fetchTitleLogo(tmdbId: string, type: MediaType): Promise<string | null> {
  return getCached(`logo:${type}:${tmdbId}`, () =>
    invokeTmdb<string | null>({ action: "logo", tmdbId, type })
  );
}

export interface CastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
}

export async function fetchCredits(tmdbId: string, type: MediaType): Promise<CastMember[]> {
  return getCached(`credits:${type}:${tmdbId}`, () =>
    invokeTmdb<CastMember[]>({ action: "credits", tmdbId, type })
  );
}

export async function fetchSeasonEpisodes(tvId: string | number, seasonNumber: number): Promise<any[]> {
  return getCached(`season:${tvId}:${seasonNumber}`, () =>
    invokeTmdb<any[]>({ action: "season_episodes", tvId, seasonNumber })
  );
}
