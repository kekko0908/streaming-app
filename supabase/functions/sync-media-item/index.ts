import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.8";
import { corsHeaders } from "../_shared/cors.ts";

type MediaType = "movie" | "tv";

type SyncPayload = {
  action: "sync";
  tmdbId: number;
  type: MediaType;
};

type UpdateTypePayload = {
  action: "update_type";
  tmdbId: number;
  mediaType: MediaType;
};

type RequestPayload = SyncPayload | UpdateTypePayload;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const TMDB_API_KEY = Deno.env.get("TMDB_API_KEY") ?? "";

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

function parseRuntime(data: Record<string, unknown>, type: MediaType) {
  if (type === "movie") {
    return typeof data.runtime === "number" ? data.runtime : 0;
  }

  const episodeRunTime = Array.isArray(data.episode_run_time) ? data.episode_run_time : [];
  if (typeof episodeRunTime[0] === "number") return episodeRunTime[0];

  const lastEpisode = typeof data.last_episode_to_air === "object" && data.last_episode_to_air !== null
    ? data.last_episode_to_air as Record<string, unknown>
    : null;

  if (lastEpisode && typeof lastEpisode.runtime === "number") {
    return lastEpisode.runtime;
  }

  return 45;
}

async function fetchTmdbMedia(tmdbId: number, type: MediaType) {
  if (!TMDB_API_KEY) {
    throw new Error("Missing TMDB_API_KEY secret");
  }

  const response = await fetch(
    `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_API_KEY}&language=it-IT`
  );

  if (!response.ok) {
    throw new Error(`TMDB request failed with status ${response.status}`);
  }

  const data = await response.json();
  const genres = Array.isArray(data.genres)
    ? data.genres
        .map((genre: Record<string, unknown>) => genre.name)
        .filter((name: unknown): name is string => typeof name === "string")
    : [];

  const seasonsDetails = Array.isArray(data.seasons)
    ? data.seasons.filter((season: Record<string, unknown>) => Number(season.season_number) > 0)
    : [];

  const totalEpisodes =
    type === "tv"
      ? seasonsDetails.reduce((total: number, season: Record<string, unknown>) => {
          const episodeCount = Number(season.episode_count) || 0;
          return total + episodeCount;
        }, 0)
      : null;

  return {
    tmdb_id: Number(data.id),
    title: String(type === "movie" ? data.title : data.name),
    media_type: type,
    runtime: parseRuntime(data, type),
    poster_path: data.poster_path ? `https://image.tmdb.org/t/p/w780${data.poster_path}` : "",
    genres,
    ...(totalEpisodes !== null ? { total_episodes: totalEpisodes } : {}),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse(500, { error: "Missing Supabase function secrets" });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse(401, { error: "Missing Authorization header" });
  }

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();

  if (userError || !user) {
    return jsonResponse(401, { error: "Invalid JWT" });
  }

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  let payload: RequestPayload;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse(400, { error: "Invalid JSON payload" });
  }

  if (payload.action === "sync") {
    if (!Number.isInteger(payload.tmdbId) || payload.tmdbId <= 0 || !isMediaType(payload.type)) {
      return jsonResponse(400, { error: "Invalid sync payload" });
    }

    try {
      const mediaItem = await fetchTmdbMedia(payload.tmdbId, payload.type);
      const { error } = await adminClient
        .from("media_items")
        .upsert(mediaItem, { onConflict: "tmdb_id" });

      if (error) {
        return jsonResponse(500, { error: error.message });
      }

      return jsonResponse(200, { ok: true, mediaItem });
    } catch (error) {
      return jsonResponse(500, { error: error instanceof Error ? error.message : "Sync failed" });
    }
  }

  if (payload.action === "update_type") {
    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      return jsonResponse(500, { error: profileError.message });
    }

    if (!profile?.is_admin) {
      return jsonResponse(403, { error: "Forbidden" });
    }

    if (!Number.isInteger(payload.tmdbId) || payload.tmdbId <= 0 || !isMediaType(payload.mediaType)) {
      return jsonResponse(400, { error: "Invalid update_type payload" });
    }

    const { error } = await adminClient
      .from("media_items")
      .update({ media_type: payload.mediaType })
      .eq("tmdb_id", payload.tmdbId);

    if (error) {
      return jsonResponse(500, { error: error.message });
    }

    return jsonResponse(200, { ok: true });
  }

  return jsonResponse(400, { error: "Unsupported action" });
});
