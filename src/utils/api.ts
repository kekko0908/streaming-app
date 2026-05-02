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
