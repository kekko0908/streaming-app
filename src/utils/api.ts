import { supabase } from "../supabaseClient";
import { MediaType, ReleaseInfo, TmdbItem } from "../types/types";
import { getDateKey } from "./release";

const CATALOG_TTL_MS = 30 * 60 * 1000;
const RELEASE_TTL_MS = 15 * 60 * 1000;
const CALENDAR_TTL_MS = 6 * 60 * 60 * 1000;
const requestCache = new Map<string, { expiresAt: number; value: Promise<unknown> }>();

function getCached<T>(key: string, ttlMs: number, loader: () => Promise<T>, force = false): Promise<T> {
  const cached = requestCache.get(key);
  if (!force && cached && cached.expiresAt > Date.now()) return cached.value as Promise<T>;

  const nextValue = loader().catch((error) => {
    requestCache.delete(key);
    throw error;
  });

  requestCache.set(key, { expiresAt: Date.now() + ttlMs, value: nextValue });
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

export async function fetchDetails(tmdbId: string, type: MediaType, force = false): Promise<TmdbItem> {
  return getCached(`details:${type}:${tmdbId}`, CATALOG_TTL_MS, () =>
    invokeTmdb<TmdbItem>({ action: "details", tmdbId, type })
  , force);
}

export async function fetchTrending(): Promise<TmdbItem[]> {
  return getCached("trending:all:day", CATALOG_TTL_MS, () =>
    invokeTmdb<TmdbItem[]>({ action: "trending" })
  );
}

export async function fetchReleaseInfo(tmdbId: string, region = "IT", force = false): Promise<ReleaseInfo> {
  return getCached(`release:${region}:${tmdbId}`, RELEASE_TTL_MS, () =>
    invokeTmdb<ReleaseInfo>({ action: "release_info", tmdbId, region })
  , force);
}

export async function fetchByGenre(genreId: number, type: MediaType = "movie"): Promise<TmdbItem[]> {
  return getCached(`genre:${type}:${genreId}`, CATALOG_TTL_MS, () =>
    invokeTmdb<TmdbItem[]>({ action: "genre", genreId, type })
  );
}

export async function fetchPopularMovies(region: string = "IT"): Promise<TmdbItem[]> {
  return getCached(`popular-movies:${region}`, CATALOG_TTL_MS, () =>
    invokeTmdb<TmdbItem[]>({ action: "popular_movies", region })
  );
}

export async function fetchPopularTV(): Promise<TmdbItem[]> {
  return getCached("popular-tv", CATALOG_TTL_MS, () => invokeTmdb<TmdbItem[]>({ action: "popular_tv" }));
}

export async function fetchCommunityTopTitles(periodDays = 30): Promise<TmdbItem[]> {
  const safePeriod = Math.min(365, Math.max(1, Math.round(periodDays)));
  return getCached(`community-top:${safePeriod}`, CATALOG_TTL_MS, async () => {
    const { data, error } = await supabase.rpc("get_community_top_titles", { period_days: safePeriod });
    if (error) throw error;
    return (Array.isArray(data) ? data : []).map((row: any) => ({
      tmdbId: String(row.tmdb_id),
      type: row.media_type === "tv" ? "tv" : "movie",
      title: String(row.title || ""),
      year: "",
      overview: "",
      poster: String(row.poster_path || ""),
      backdrop: "",
      rating: Number(row.community_rating || 0),
      communityWatched: Number(row.watched_count || 0),
      communityCompleted: Number(row.completed_count || 0),
    } as TmdbItem));
  });
}

export async function fetchUpcoming(region: string = "IT"): Promise<TmdbItem[]> {
  return getCached(`upcoming:${region}`, CATALOG_TTL_MS, () =>
    invokeTmdb<TmdbItem[]>({ action: "upcoming", region })
  );
}

export async function fetchCalendarUpcoming(region: string = "IT"): Promise<TmdbItem[]> {
  return getCached(`calendar-upcoming:${region}`, CALENDAR_TTL_MS, () =>
    invokeTmdb<TmdbItem[]>({ action: "calendar_upcoming", region })
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
    releaseInfo: {
      date: row.release_date || undefined,
      region: row.region || "IT",
      kind: row.release_kind || "unknown",
      verification: row.verification || "unknown",
      phase: row.release_status === "released" ? "released" : row.release_status === "upcoming" ? "upcoming" : "unknown",
      checkedAt: row.last_checked_at || undefined,
    },
  } as TmdbItem;
}

export async function fetchUpcomingReleases(region: string = "IT"): Promise<TmdbItem[]> {
  const todayKey = getDateKey();

  const { data, error } = await supabase
    .from("upcoming_releases")
    .select("tmdb_id, media_type, title, poster, backdrop, release_date, region, release_kind, verification, release_status, last_checked_at, item_snapshot")
    .eq("region", region)
    .eq("release_status", "upcoming")
    .gte("release_date", todayKey)
    .order("release_date", { ascending: true })
    .limit(80);

  if (error) throw error;
  return (data || []).map(mapUpcomingReleaseRow);
}

export async function fetchRecentlyReleasedDigital(region: string = "IT"): Promise<TmdbItem[]> {
  const todayKey = getDateKey();
  const since = new Date(`${todayKey}T12:00:00Z`);
  since.setUTCDate(since.getUTCDate() - 120);
  const { data, error } = await supabase
    .from("upcoming_releases")
    .select("tmdb_id, media_type, title, poster, backdrop, release_date, region, release_kind, verification, release_status, last_checked_at, item_snapshot")
    .eq("region", region)
    .eq("release_status", "released")
    .eq("release_kind", "digital")
    .eq("verification", "verified_it")
    .gte("release_date", since.toISOString().slice(0, 10))
    .lte("release_date", todayKey)
    .order("release_date", { ascending: false })
    .limit(40);
  if (error) throw error;
  return (data || []).map(mapUpcomingReleaseRow);
}

export async function fetchUpcomingReleaseByTmdbId(tmdbId: string, region: string = "IT"): Promise<TmdbItem | null> {
  const { data, error } = await supabase
    .from("upcoming_releases")
    .select("tmdb_id, media_type, title, poster, backdrop, release_date, region, release_kind, verification, release_status, last_checked_at, item_snapshot")
    .eq("region", region)
    .eq("media_type", "movie")
    .eq("tmdb_id", parseInt(tmdbId, 10))
    .eq("release_status", "upcoming")
    .maybeSingle();

  if (error) throw error;
  return data ? mapUpcomingReleaseRow(data) : null;
}

export async function fetchUpcomingFromStore(region: string = "IT"): Promise<TmdbItem[]> {
  return getCached(`upcoming-store:${region}`, CATALOG_TTL_MS, async () => {
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
  return getCached(`now-playing:${region}`, CATALOG_TTL_MS, () =>
    invokeTmdb<TmdbItem[]>({ action: "now_playing", region })
  );
}

export async function fetchRecommendations(tmdbId: string, type: MediaType): Promise<TmdbItem[]> {
  return getCached(`recommendations:${type}:${tmdbId}`, CATALOG_TTL_MS, () =>
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
  return getCached(`trailer:${type}:${tmdbId}`, CATALOG_TTL_MS, () =>
    invokeTmdb<string | null>({ action: "trailer", tmdbId, type })
  );
}

export async function fetchTitleLogo(tmdbId: string, type: MediaType): Promise<string | null> {
  return getCached(`logo:${type}:${tmdbId}`, CATALOG_TTL_MS, () =>
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
  return getCached(`credits:${type}:${tmdbId}`, CATALOG_TTL_MS, () =>
    invokeTmdb<CastMember[]>({ action: "credits", tmdbId, type })
  );
}

export async function fetchSeasonEpisodes(tvId: string | number, seasonNumber: number): Promise<any[]> {
  return getCached(`season:${tvId}:${seasonNumber}`, CATALOG_TTL_MS, () =>
    invokeTmdb<any[]>({ action: "season_episodes", tvId, seasonNumber })
  );
}
