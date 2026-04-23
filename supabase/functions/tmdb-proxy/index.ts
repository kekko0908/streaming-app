import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.8";
import { corsHeaders } from "../_shared/cors.ts";

type MediaType = "movie" | "tv";

type SearchPayload = { action: "search"; query: string; type: MediaType };
type DetailsPayload = { action: "details"; tmdbId: string; type: MediaType };
type CollectionPayload = { action: "collection"; endpoint: string };
type GenrePayload = { action: "genre"; genreId: number; type?: MediaType };
type PopularTVPayload = { action: "popular_tv" };
type NowPlayingPayload = { action: "now_playing"; region?: string };
type RecommendationsPayload = { action: "recommendations"; tmdbId: string; type: MediaType };
type DiscoverPayload = {
  action: "discover";
  type: MediaType;
  sort: string;
  genre?: string;
  year?: string;
  vote?: string;
  providers?: string;
  runtimeMin?: number;
  runtimeMax?: number;
  page?: number;
};
type PersonCreditsPayload = { action: "person_credits"; personId: number };
type TrailerPayload = { action: "trailer"; tmdbId: string; type: MediaType };
type CreditsPayload = { action: "credits"; tmdbId: string; type: MediaType };
type SeasonEpisodesPayload = { action: "season_episodes"; tvId: string | number; seasonNumber: number };

type RequestPayload =
  | SearchPayload
  | DetailsPayload
  | CollectionPayload
  | GenrePayload
  | PopularTVPayload
  | NowPlayingPayload
  | RecommendationsPayload
  | DiscoverPayload
  | PersonCreditsPayload
  | TrailerPayload
  | CreditsPayload
  | SeasonEpisodesPayload;

type TmdbItem = {
  tmdbId: string;
  type: MediaType;
  title: string;
  year: string;
  releaseDateFull?: string;
  overview: string;
  poster: string;
  backdrop: string;
  rating: number;
  runtime?: string;
  genres?: string[];
  seasons?: number;
  seasonsDetails?: { season_number: number; episode_count: number }[];
  popularity?: number;
  collection?: {
    id: number;
    name: string;
    parts: TmdbItem[];
  };
};

type CastMember = {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const TMDB_API_KEY = Deno.env.get("TMDB_API_KEY") ?? "";

const GENRES_MAP: Record<number, string> = {
  28: "Azione", 12: "Avventura", 16: "Animazione", 35: "Commedia", 80: "Crime",
  99: "Documentario", 18: "Dramma", 10751: "Famiglia", 14: "Fantasy", 36: "Storia",
  27: "Horror", 10402: "Musica", 9648: "Mistero", 10749: "Romance", 878: "Fantascienza",
  10770: "Film TV", 53: "Thriller", 10752: "Guerra", 37: "Western",
  10759: "Action & Adventure", 10762: "Kids", 10763: "News", 10764: "Reality",
  10765: "Sci-Fi & Fantasy", 10766: "Soap", 10767: "Talk", 10768: "War & Politics"
};

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function isMediaType(value: unknown): value is MediaType {
  return value === "movie" || value === "tv";
}

function pickYear(date?: string) {
  if (!date) return "";
  return date.slice(0, 4);
}

function imagePath(path: string | null | undefined, size: string) {
  if (!path) return "";
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

async function fetchJson(path: string, params?: URLSearchParams) {
  if (!TMDB_API_KEY) {
    throw new Error("Missing TMDB_API_KEY secret");
  }

  const query = params ? `&${params.toString()}` : "";
  const response = await fetch(
    `https://api.themoviedb.org/3/${path}?api_key=${TMDB_API_KEY}${query}`
  );

  if (!response.ok) {
    throw new Error(`TMDB request failed with status ${response.status}`);
  }

  return response.json();
}

function mapSearchItem(raw: Record<string, unknown>, type: MediaType): TmdbItem {
  const genres = Array.isArray(raw.genre_ids)
    ? raw.genre_ids.map((id) => GENRES_MAP[Number(id)]).filter(Boolean)
    : [];

  return {
    tmdbId: String(raw.id),
    type,
    title: type === "movie" ? String(raw.title ?? "") : String(raw.name ?? ""),
    year: pickYear(type === "movie" ? String(raw.release_date ?? "") : String(raw.first_air_date ?? "")),
    releaseDateFull: type === "movie" ? String(raw.release_date ?? "") : String(raw.first_air_date ?? ""),
    overview: String(raw.overview ?? "Trama non disponibile in italiano."),
    poster: imagePath(String(raw.poster_path ?? ""), "w500"),
    backdrop: imagePath(String(raw.backdrop_path ?? ""), "original"),
    rating: Number(raw.vote_average ?? 0),
    popularity: Number(raw.popularity ?? 0),
    genres,
  };
}

async function fetchMultiplePages(path: string, type: MediaType, maxPages = 1, params?: URLSearchParams) {
  const pages = Array.from({ length: maxPages }, (_, index) => index + 1);
  const results = await Promise.all(
    pages.map((page) => {
      const nextParams = new URLSearchParams(params);
      nextParams.set("page", String(page));
      return fetchJson(path, nextParams);
    })
  );

  const allItems = results.flatMap((data: any) => data.results || []);
  const uniqueItems = Array.from(new Map(allItems.map((item: any) => [item.id, item])).values());
  return uniqueItems.map((item: any) => mapSearchItem(item, type));
}

async function fetchDetails(tmdbId: string, type: MediaType): Promise<TmdbItem> {
  const data = await fetchJson(`${type}/${tmdbId}`, new URLSearchParams({ language: "it-IT" }));

  let runtime = "";
  if (type === "movie") {
    runtime = data.runtime ? `${data.runtime} min` : "";
  } else if (Array.isArray(data.episode_run_time) && data.episode_run_time.length > 0) {
    runtime = `${data.episode_run_time[0]} min`;
  } else if (data.last_episode_to_air?.runtime) {
    runtime = `${data.last_episode_to_air.runtime} min`;
  } else {
    runtime = "45 min";
  }

  const genresList = Array.isArray(data.genres) ? data.genres.map((genre: any) => genre.name) : [];

  let collectionData = undefined;
  if (data.belongs_to_collection?.id) {
    try {
      const collection = await fetchJson(
        `collection/${data.belongs_to_collection.id}`,
        new URLSearchParams({ language: "it-IT" })
      );

      collectionData = {
        id: collection.id,
        name: collection.name,
        parts: (collection.parts || [])
          .map((part: any) => mapSearchItem(part, "movie"))
          .sort((a: TmdbItem, b: TmdbItem) => (a.year || "0").localeCompare(b.year || "0")),
      };
    } catch (error) {
      console.error("Errore collezione", error);
    }
  }

  return {
    tmdbId: String(data.id),
    type,
    title: type === "movie" ? String(data.title ?? "") : String(data.name ?? ""),
    year: pickYear(type === "movie" ? String(data.release_date ?? "") : String(data.first_air_date ?? "")),
    releaseDateFull: type === "movie" ? String(data.release_date ?? "") : String(data.first_air_date ?? ""),
    overview: String(data.overview ?? "Trama non disponibile in italiano."),
    poster: imagePath(String(data.poster_path ?? ""), "w780"),
    backdrop: imagePath(String(data.backdrop_path ?? ""), "original"),
    rating: Number(data.vote_average ?? 0),
    runtime,
    genres: genresList,
    seasons: Number(data.number_of_seasons ?? 0),
    seasonsDetails: Array.isArray(data.seasons)
      ? data.seasons
          .map((season: any) => ({
            season_number: season.season_number,
            episode_count: season.episode_count,
          }))
          .filter((season: any) => season.season_number > 0)
      : [],
    popularity: Number(data.popularity ?? 0),
    collection: collectionData,
  };
}

async function fetchCredits(tmdbId: string, type: MediaType): Promise<CastMember[]> {
  const data = await fetchJson(`${type}/${tmdbId}/credits`, new URLSearchParams({ language: "it-IT" }));
  return (data.cast || []).slice(0, 10).map((actor: any) => ({
    id: actor.id,
    name: actor.name,
    character: actor.character,
    profile_path: actor.profile_path ? `https://image.tmdb.org/t/p/w185${actor.profile_path}` : null,
  }));
}

async function fetchTrailer(tmdbId: string, type: MediaType) {
  const data = await fetchJson(`${type}/${tmdbId}/videos`, new URLSearchParams({ language: "it-IT" }));
  let trailer = data.results?.find((video: any) => video.site === "YouTube" && video.type === "Trailer");

  if (!trailer) {
    const dataEn = await fetchJson(`${type}/${tmdbId}/videos`, new URLSearchParams({ language: "en-US" }));
    trailer = dataEn.results?.find((video: any) => video.site === "YouTube" && video.type === "Trailer");
  }

  return trailer ? trailer.key : null;
}

async function fetchPersonCredits(personId: number) {
  const data = await fetchJson(`person/${personId}/combined_credits`, new URLSearchParams({ language: "it-IT" }));
  const credits = (data.cast || [])
    .filter((item: any) => item.media_type === "movie" || item.media_type === "tv")
    .map((item: any) => mapSearchItem(item, item.media_type as MediaType));
  const uniqueMap = new Map(credits.map((item: TmdbItem) => [`${item.type}-${item.tmdbId}`, item]));
  return Array.from(uniqueMap.values()).sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse(405, { error: "Method not allowed" });

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return jsonResponse(500, { error: "Missing Supabase function secrets" });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return jsonResponse(401, { error: "Missing Authorization header" });

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return jsonResponse(401, { error: "Invalid JWT" });

  let payload: RequestPayload;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse(400, { error: "Invalid JSON payload" });
  }

  try {
    switch (payload.action) {
      case "search": {
        if (!payload.query || !isMediaType(payload.type)) return jsonResponse(400, { error: "Invalid search payload" });
        const data = await fetchJson(`search/${payload.type}`, new URLSearchParams({ language: "it-IT", query: payload.query }));
        return jsonResponse(200, (data.results || []).map((item: any) => mapSearchItem(item, payload.type)));
      }
      case "details":
        return jsonResponse(200, await fetchDetails(payload.tmdbId, payload.type));
      case "collection":
        return jsonResponse(200, await fetchMultiplePages(
          payload.endpoint,
          payload.endpoint.includes("tv") ? "tv" : "movie",
          1,
          new URLSearchParams({ language: "it-IT" })
        ));
      case "genre":
        return jsonResponse(200, await fetchMultiplePages(
          `discover/${payload.type ?? "movie"}`,
          payload.type ?? "movie",
          1,
          new URLSearchParams({
            language: "it-IT",
            sort_by: "popularity.desc",
            with_genres: String(payload.genreId),
          })
        ));
      case "popular_tv":
        return jsonResponse(200, await fetchMultiplePages("tv/popular", "tv", 1, new URLSearchParams({ language: "it-IT" })));
      case "now_playing":
        return jsonResponse(200, await fetchMultiplePages(
          "movie/now_playing",
          "movie",
          1,
          new URLSearchParams({ language: "it-IT", region: payload.region ?? "IT" })
        ));
      case "recommendations":
        return jsonResponse(200, await fetchMultiplePages(
          `${payload.type}/${payload.tmdbId}/recommendations`,
          payload.type,
          2,
          new URLSearchParams({ language: "it-IT" })
        ));
      case "discover": {
        const params = new URLSearchParams({
          language: "it-IT",
          sort_by: payload.sort,
          include_adult: "false",
          page: String(payload.page ?? 1),
          "vote_count.gte": "50",
        });
        if (payload.genre) params.append("with_genres", payload.genre);
        if (payload.vote) params.append("vote_average.gte", payload.vote);
        if (payload.providers) {
          params.append("with_watch_providers", payload.providers);
          params.append("watch_region", "IT");
        }
        if (typeof payload.runtimeMin === "number") params.append("with_runtime.gte", String(payload.runtimeMin));
        if (typeof payload.runtimeMax === "number") params.append("with_runtime.lte", String(payload.runtimeMax));
        if (payload.year) {
          if (payload.type === "movie") params.append("primary_release_year", payload.year);
          else params.append("first_air_date_year", payload.year);
        }
        const data = await fetchJson(`discover/${payload.type}`, params);
        return jsonResponse(200, (data.results || []).map((item: any) => mapSearchItem(item, payload.type)));
      }
      case "person_credits":
        return jsonResponse(200, await fetchPersonCredits(payload.personId));
      case "trailer":
        return jsonResponse(200, await fetchTrailer(payload.tmdbId, payload.type));
      case "credits":
        return jsonResponse(200, await fetchCredits(payload.tmdbId, payload.type));
      case "season_episodes": {
        const data = await fetchJson(
          `tv/${payload.tvId}/season/${payload.seasonNumber}`,
          new URLSearchParams({ language: "it-IT" })
        );
        return jsonResponse(200, data.episodes || []);
      }
      default:
        return jsonResponse(400, { error: "Unsupported action" });
    }
  } catch (error) {
    return jsonResponse(500, { error: error instanceof Error ? error.message : "Proxy failed" });
  }
});
