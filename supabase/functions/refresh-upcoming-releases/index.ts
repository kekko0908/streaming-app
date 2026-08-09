import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.8";
import { getCorsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const TMDB_API_KEY = Deno.env.get("TMDB_API_KEY") ?? "";
const RELEASE_REFRESH_SECRET = Deno.env.get("RELEASE_REFRESH_SECRET") ?? "";

function response(status: number, body: unknown, corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function todayInRome() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

async function fetchTmdb(path: string, params = new URLSearchParams()) {
  if (!TMDB_API_KEY) throw new Error("Missing TMDB secret");
  const result = await fetch(`https://api.themoviedb.org/3/${path}?api_key=${TMDB_API_KEY}&${params}`);
  if (!result.ok) throw new Error(`TMDB ${result.status}`);
  return result.json();
}

function image(path: unknown, size: string) {
  return path ? `https://image.tmdb.org/t/p/${size}${String(path)}` : "";
}

function mapMovie(raw: any) {
  return {
    tmdbId: String(raw.id), type: "movie", title: String(raw.title ?? ""),
    year: String(raw.release_date ?? "").slice(0, 4), releaseDateFull: String(raw.release_date ?? ""),
    overview: String(raw.overview ?? ""), poster: image(raw.poster_path, "w500"),
    backdrop: image(raw.backdrop_path, "original"), rating: Number(raw.vote_average ?? 0),
    popularity: Number(raw.popularity ?? 0),
  };
}

async function digitalDate(tmdbId: number, region: string) {
  const data = await fetchTmdb(`movie/${tmdbId}/release_dates`);
  const country = (data.results || []).find((entry: any) => entry.iso_3166_1 === region);
  return (country?.release_dates || [])
    .filter((entry: any) => Number(entry.type) === 4 && entry.release_date)
    .map((entry: any) => String(entry.release_date).slice(0, 10))
    .filter((date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date))
    .sort()[0] as string | undefined;
}

async function discoverCandidates(region: string) {
  const today = todayInRome();
  const end = new Date(`${today}T12:00:00Z`);
  end.setUTCFullYear(end.getUTCFullYear() + 1);
  const pages = await Promise.all([1, 2, 3].map((page) => fetchTmdb("discover/movie", new URLSearchParams({
    language: "it-IT", region, include_adult: "false", include_video: "false",
    sort_by: "release_date.asc", with_release_type: "4", "release_date.gte": today,
    "release_date.lte": end.toISOString().slice(0, 10), page: String(page),
  }))));
  const movies = pages.flatMap((page: any) => page.results || []).map(mapMovie);
  return Array.from(new Map(movies.map((movie: any) => [movie.tmdbId, movie])).values());
}

async function authorize(req: Request, adminClient: ReturnType<typeof createClient>) {
  const suppliedSecret = req.headers.get("x-cron-secret") ?? "";
  if (RELEASE_REFRESH_SECRET && suppliedSecret === RELEASE_REFRESH_SECRET) return true;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return false;
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return false;
  const { data } = await adminClient.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
  return data?.is_admin === true;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const jsonResponse = (status: number, body: unknown) => response(status, body, corsHeaders);
  if (req.method !== "POST") return jsonResponse(405, { error: "Method not allowed" });
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse(500, { error: "Service configuration unavailable" });
  }

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  if (!(await authorize(req, adminClient))) return jsonResponse(403, { error: "Forbidden" });

  const requestId = crypto.randomUUID();
  try {
    const payload = await req.json().catch(() => ({}));
    const region = String(payload.region ?? "IT").trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(region)) return jsonResponse(400, { error: "Invalid region", requestId });

    const now = new Date().toISOString();
    const today = todayInRome();
    const [{ data: existing, error: existingError }, candidates] = await Promise.all([
      adminClient.from("upcoming_releases").select("tmdb_id, item_snapshot").eq("region", region),
      discoverCandidates(region),
    ]);
    if (existingError) throw existingError;

    const candidateMap = new Map(candidates.map((item: any) => [Number(item.tmdbId), item]));
    const ids = Array.from(new Set([
      ...candidates.map((item: any) => Number(item.tmdbId)),
      ...(existing || []).map((row: any) => Number(row.tmdb_id)),
    ])).slice(0, 160);

    const rows: any[] = [];
    for (let offset = 0; offset < ids.length; offset += 8) {
      const chunk = ids.slice(offset, offset + 8);
      const verified = await Promise.all(chunk.map(async (tmdbId) => {
        try {
          return { tmdbId, date: await digitalDate(tmdbId, region), checked: true };
        } catch {
          return { tmdbId, date: undefined, checked: false };
        }
      }));
      for (const result of verified) {
        const previous = (existing || []).find((row: any) => Number(row.tmdb_id) === result.tmdbId);
        const item = candidateMap.get(result.tmdbId) ?? previous?.item_snapshot ?? {};
        if (!result.checked) continue;
        if (!result.date) {
          if (previous) rows.push({
            tmdb_id: result.tmdbId, media_type: "movie", region,
            title: item.title || "Titolo non disponibile", poster: item.poster || "", backdrop: item.backdrop || "",
            release_date: item.releaseInfo?.date || item.releaseDateFull || today,
            source: "tmdb_release_dates", release_kind: "digital", verification: "unknown",
            release_status: "removed", item_snapshot: item, last_checked_at: now, last_seen_at: now, updated_at: now,
          });
          continue;
        }
        const releaseInfo = {
          date: result.date, region, kind: "digital", verification: "verified_it",
          phase: result.date <= today ? "released" : "upcoming", checkedAt: now,
        };
        const snapshot = { ...item, tmdbId: String(result.tmdbId), type: "movie", releaseDateFull: result.date, releaseInfo };
        rows.push({
          tmdb_id: result.tmdbId, media_type: "movie", region,
          title: snapshot.title || "Titolo non disponibile", poster: snapshot.poster || "", backdrop: snapshot.backdrop || "",
          release_date: result.date, source: "tmdb_release_dates", release_kind: "digital", verification: "verified_it",
          release_status: releaseInfo.phase, item_snapshot: snapshot, last_checked_at: now, last_seen_at: now, updated_at: now,
        });
      }
    }

    if (rows.length) {
      const { error } = await adminClient.from("upcoming_releases").upsert(rows, {
        onConflict: "tmdb_id,media_type,region",
      });
      if (error) throw error;
    }
    return jsonResponse(200, { ok: true, region, checked: ids.length, updated: rows.length, requestId });
  } catch (error) {
    console.error("refresh-upcoming-releases", requestId, error);
    return jsonResponse(500, { error: "Release refresh failed", requestId });
  }
});
