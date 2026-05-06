import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.8";
import { corsHeaders } from "../_shared/cors.ts";

type MediaType = "movie" | "tv";

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
  popularity?: number;
  genres?: string[];
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const TMDB_API_KEY = Deno.env.get("TMDB_API_KEY") ?? "";

const GENRES_MAP: Record<number, string> = {
  28: "Azione", 12: "Avventura", 16: "Animazione", 35: "Commedia", 80: "Crime",
  99: "Documentario", 18: "Dramma", 10751: "Famiglia", 14: "Fantasy", 36: "Storia",
  27: "Horror", 10402: "Musica", 9648: "Mistero", 10749: "Romance", 878: "Fantascienza",
  10770: "Film TV", 53: "Thriller", 10752: "Guerra", 37: "Western",
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

function imagePath(path: string | null | undefined, size: string) {
  if (!path) return "";
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

function pickYear(date?: string) {
  return date ? date.slice(0, 4) : "";
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addMonths(date: Date, months: number) {
  const nextDate = new Date(date);
  nextDate.setMonth(nextDate.getMonth() + months);
  return nextDate;
}

async function fetchJson(path: string, params?: URLSearchParams) {
  if (!TMDB_API_KEY) throw new Error("Missing TMDB_API_KEY secret");
  const query = params ? `&${params.toString()}` : "";
  const response = await fetch(`https://api.themoviedb.org/3/${path}?api_key=${TMDB_API_KEY}${query}`);
  if (!response.ok) throw new Error(`TMDB request failed with status ${response.status}`);
  return response.json();
}

function mapMovie(raw: Record<string, unknown>): TmdbItem {
  const releaseDate = String(raw.release_date ?? "");
  const genres = Array.isArray(raw.genre_ids)
    ? raw.genre_ids.map((id) => GENRES_MAP[Number(id)]).filter(Boolean)
    : [];

  return {
    tmdbId: String(raw.id),
    type: "movie",
    title: String(raw.title ?? ""),
    year: pickYear(releaseDate),
    releaseDateFull: releaseDate,
    overview: String(raw.overview ?? "Trama non disponibile in italiano."),
    poster: imagePath(String(raw.poster_path ?? ""), "w500"),
    backdrop: imagePath(String(raw.backdrop_path ?? ""), "original"),
    rating: Number(raw.vote_average ?? 0),
    popularity: Number(raw.popularity ?? 0),
    genres,
  };
}

async function fetchMultiplePages(path: string, maxPages: number, params: URLSearchParams) {
  const pages = Array.from({ length: maxPages }, (_, index) => index + 1);
  const results = await Promise.all(
    pages.map((page) => {
      const nextParams = new URLSearchParams(params);
      nextParams.set("page", String(page));
      return fetchJson(path, nextParams);
    })
  );

  const allItems = results.flatMap((data: any) => data.results || []);
  return Array.from(new Map(allItems.map((item: any) => [item.id, item])).values()).map((item: any) => mapMovie(item));
}

function sortAndLimitUpcoming(items: TmdbItem[], limit = 80) {
  const today = toIsoDate(new Date());
  const uniqueItems = Array.from(new Map(items.map((item) => [item.tmdbId, item])).values());

  return uniqueItems
    .filter((item) => item.releaseDateFull && item.releaseDateFull > today)
    .sort((a, b) => {
      const dateCompare = String(a.releaseDateFull).localeCompare(String(b.releaseDateFull));
      if (dateCompare !== 0) return dateCompare;
      return (b.popularity ?? 0) - (a.popularity ?? 0);
    })
    .slice(0, limit);
}

async function fetchUpcoming(region: string) {
  const today = toIsoDate(new Date());
  const maxDate = toIsoDate(addMonths(new Date(), 12));

  const [officialUpcoming, discoveredUpcoming] = await Promise.all([
    fetchMultiplePages("movie/upcoming", 3, new URLSearchParams({ language: "it-IT", region })),
    fetchMultiplePages(
      "discover/movie",
      3,
      new URLSearchParams({
        language: "it-IT",
        region,
        include_adult: "false",
        include_video: "false",
        sort_by: "primary_release_date.asc",
        "release_date.gte": today,
        "release_date.lte": maxDate,
        with_release_type: "2|3",
      })
    ),
  ]);

  return sortAndLimitUpcoming([...officialUpcoming, ...discoveredUpcoming]);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse(405, { error: "Method not allowed" });

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse(500, { error: "Missing Supabase function secrets" });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return jsonResponse(401, { error: "Missing Authorization header" });

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return jsonResponse(401, { error: "Invalid JWT" });

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let region = "IT";
  try {
    const payload = await req.json().catch(() => ({}));
    if (typeof payload.region === "string" && payload.region.trim()) region = payload.region.trim().toUpperCase();
  } catch {
    return jsonResponse(400, { error: "Invalid JSON payload" });
  }

  try {
    const now = new Date().toISOString();
    const today = toIsoDate(new Date());
    const upcoming = await fetchUpcoming(region);

    const rows = upcoming.map((item) => ({
      tmdb_id: Number(item.tmdbId),
      media_type: item.type,
      title: item.title,
      poster: item.poster || "",
      backdrop: item.backdrop || "",
      release_date: item.releaseDateFull,
      region,
      source: "tmdb_upcoming",
      release_status: "upcoming",
      item_snapshot: item,
      last_checked_at: now,
      updated_at: now,
    }));

    if (rows.length > 0) {
      const { error } = await adminClient
        .from("upcoming_releases")
        .upsert(rows, { onConflict: "tmdb_id,media_type,region" });
      if (error) return jsonResponse(500, { error: error.message });
    }

    const { error: releasedError } = await adminClient
      .from("upcoming_releases")
      .update({ release_status: "released", last_checked_at: now, updated_at: now })
      .eq("region", region)
      .eq("release_status", "upcoming")
      .lte("release_date", today);
    if (releasedError) return jsonResponse(500, { error: releasedError.message });

    return jsonResponse(200, { ok: true, region, count: rows.length, items: upcoming });
  } catch (error) {
    return jsonResponse(500, { error: error instanceof Error ? error.message : "Refresh failed" });
  }
});
