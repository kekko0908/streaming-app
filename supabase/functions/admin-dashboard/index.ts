import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.8";
import { corsHeaders } from "../_shared/cors.ts";

type MediaType = "movie" | "tv";
type WatchStatus = "da-guardare" | "in-corso" | "pianificato" | "gia-guardato";

type RequestPayload =
  | { action: "overview" }
  | { action: "users"; search?: string; page?: number; pageSize?: number }
  | { action: "user_detail"; userId: string }
  | { action: "delete_suggestion"; suggestionId: number }
  | { action: "set_admin_role"; userId: string; isAdmin: boolean };

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const DEFAULT_AVATAR = "https://api.dicebear.com/7.x/adventurer/svg?seed=Default";

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function normalizeString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function getAvatar(profile: Record<string, unknown> | null | undefined, user: Record<string, unknown> | null | undefined) {
  const profileAvatar = normalizeString(profile?.avatar_url, "");
  if (profileAvatar) return profileAvatar;

  const metadata = typeof user?.user_metadata === "object" && user?.user_metadata !== null
    ? user.user_metadata as Record<string, unknown>
    : null;

  return normalizeString(metadata?.avatar_url, normalizeString(metadata?.picture, DEFAULT_AVATAR));
}

function getUsername(profile: Record<string, unknown> | null | undefined, user: Record<string, unknown> | null | undefined) {
  const profileName = normalizeString(profile?.username, "");
  if (profileName) return profileName;

  const metadata = typeof user?.user_metadata === "object" && user?.user_metadata !== null
    ? user.user_metadata as Record<string, unknown>
    : null;

  const fullName = normalizeString(metadata?.full_name, "");
  if (fullName) return fullName;

  const email = normalizeString(user?.email, "");
  if (email.includes("@")) return email.split("@")[0];
  return "Utente";
}

async function getAllUsers(adminClient: ReturnType<typeof createClient>) {
  const allUsers: Record<string, unknown>[] = [];
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new Error(error.message);
    }

    const users = (data?.users ?? []) as Record<string, unknown>[];
    allUsers.push(...users);
    if (users.length < perPage) break;
    page += 1;
  }

  return allUsers;
}

async function ensureAdmin(adminClient: ReturnType<typeof createClient>, userId: string) {
  const { data, error } = await adminClient
    .from("profiles")
    .select("is_admin")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data?.is_admin);
}

function mapSuggestion(row: Record<string, unknown>) {
  const tmdbData =
    typeof row.tmdb_data === "object" && row.tmdb_data !== null
      ? row.tmdb_data as Record<string, unknown>
      : {};

  return {
    id: Number(row.id),
    tmdbId: String(tmdbData.tmdbId ?? row.tmdb_id ?? ""),
    title: normalizeString(tmdbData.title, "Titolo sconosciuto"),
    mediaType: (tmdbData.type === "tv" ? "tv" : "movie") as MediaType,
    poster: normalizeString(tmdbData.poster, ""),
    comment: normalizeString(row.comment, ""),
    userId: normalizeString(row.user_id, ""),
    userName: normalizeString(row.user_name, "Utente"),
    userAvatar: normalizeString(row.user_avatar, DEFAULT_AVATAR),
    createdAt: normalizeString(row.created_at, ""),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { ok: false, error: "Method not allowed" });
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse(500, { ok: false, error: "Missing Supabase function secrets" });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse(401, { ok: false, error: "Missing Authorization header" });
  }

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();

  if (userError || !user) {
    return jsonResponse(401, { ok: false, error: "Invalid JWT" });
  }

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const isAdmin = await ensureAdmin(adminClient, user.id).catch((error) => {
    console.error("Admin check error", error);
    return false;
  });

  if (!isAdmin) {
    return jsonResponse(403, { ok: false, error: "Forbidden" });
  }

  let payload: RequestPayload;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse(400, { ok: false, error: "Invalid JSON payload" });
  }

  try {
    if (payload.action === "overview") {
      const allUsers = await getAllUsers(adminClient);
      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      const totalUsers = allUsers.length;
      const newUsers7d = allUsers.filter((authUser) => {
        const createdAt = new Date(normalizeString(authUser.created_at, ""));
        return !Number.isNaN(createdAt.getTime()) && createdAt.getTime() >= sevenDaysAgo;
      }).length;

      const [libraryResult, suggestionsCountResult, watchedResult, lovedResult, completedResult, recentSuggestionsResult] =
        await Promise.all([
          adminClient.from("user_library").select(`
            user_id,
            rating,
            media_items ( media_type )
          `),
          adminClient.from("suggestions").select("id", { count: "exact", head: true }),
          adminClient.rpc("get_community_titles", { sort_mode: "watched" }),
          adminClient.rpc("get_community_titles", { sort_mode: "loved" }),
          adminClient
            .from("user_library")
            .select(`
              tmdb_id,
              media_items ( title, media_type, poster_path )
            `)
            .eq("status", "gia-guardato"),
          adminClient
            .from("suggestions")
            .select("id, user_id, comment, user_name, user_avatar, created_at, tmdb_data")
            .order("created_at", { ascending: false })
            .limit(5),
        ]);

      if (libraryResult.error) throw new Error(libraryResult.error.message);
      if (suggestionsCountResult.error) throw new Error(suggestionsCountResult.error.message);
      if (watchedResult.error) throw new Error(watchedResult.error.message);
      if (lovedResult.error) throw new Error(lovedResult.error.message);
      if (completedResult.error) throw new Error(completedResult.error.message);
      if (recentSuggestionsResult.error) throw new Error(recentSuggestionsResult.error.message);

      const libraryRows = (libraryResult.data ?? []) as Record<string, unknown>[];
      const activeLibraryUsers = new Set(
        libraryRows.map((row) => normalizeString(row.user_id, "")).filter(Boolean)
      ).size;
      const ratingsTotal = libraryRows.filter((row) => Number(row.rating ?? 0) > 0).length;
      const movieLibraryEntries = libraryRows.filter((row) => {
        const mediaItems = row.media_items as Record<string, unknown> | null;
        return mediaItems?.media_type === "movie";
      }).length;
      const tvLibraryEntries = libraryRows.length - movieLibraryEntries;

      const topWatched = ((watchedResult.data ?? []) as Record<string, unknown>[])
        .slice(0, 5)
        .map((row) => ({
          tmdbId: String(row.tmdb_id ?? ""),
          title: normalizeString(row.title, "Titolo sconosciuto"),
          mediaType: (row.media_type === "tv" ? "tv" : "movie") as MediaType,
          poster: normalizeString(row.poster_path, ""),
          watchedCount: Number(row.watched_count ?? 0),
        }));

      const topLoved = ((lovedResult.data ?? []) as Record<string, unknown>[])
        .slice(0, 5)
        .map((row) => ({
          tmdbId: String(row.tmdb_id ?? ""),
          title: normalizeString(row.title, "Titolo sconosciuto"),
          mediaType: (row.media_type === "tv" ? "tv" : "movie") as MediaType,
          poster: normalizeString(row.poster_path, ""),
          communityRating: Number(row.community_rating ?? 0),
          communityScore: Number(row.community_score ?? 0),
        }));

      const completedMap = new Map<string, {
        tmdbId: string;
        title: string;
        mediaType: MediaType;
        poster: string;
        completedCount: number;
      }>();

      for (const row of (completedResult.data ?? []) as Record<string, unknown>[]) {
        const tmdbId = String(row.tmdb_id ?? "");
        const mediaItems = row.media_items as Record<string, unknown> | null;
        const current = completedMap.get(tmdbId);
        if (current) {
          current.completedCount += 1;
          continue;
        }

        completedMap.set(tmdbId, {
          tmdbId,
          title: normalizeString(mediaItems?.title, "Titolo sconosciuto"),
          mediaType: (mediaItems?.media_type === "tv" ? "tv" : "movie") as MediaType,
          poster: normalizeString(mediaItems?.poster_path, ""),
          completedCount: 1,
        });
      }

      const topCompleted = Array.from(completedMap.values())
        .sort((left, right) => right.completedCount - left.completedCount || left.title.localeCompare(right.title))
        .slice(0, 5);

      return jsonResponse(200, {
        ok: true,
        data: {
          totalUsers,
          newUsers7d,
          activeLibraryUsers,
          titlesSavedTotal: libraryRows.length,
          ratingsTotal,
          suggestionsTotal: suggestionsCountResult.count ?? 0,
          movieLibraryEntries,
          tvLibraryEntries,
          topWatched,
          topLoved,
          topCompleted,
          recentSuggestions: ((recentSuggestionsResult.data ?? []) as Record<string, unknown>[]).map(mapSuggestion),
        },
      });
    }

    if (payload.action === "users") {
      const search = normalizeString(payload.search, "").toLowerCase();
      const page = Math.max(1, Number(payload.page ?? 1) || 1);
      const pageSize = Math.min(50, Math.max(1, Number(payload.pageSize ?? 12) || 12));
      const allUsers = await getAllUsers(adminClient);
      const userIds = allUsers.map((authUser) => String(authUser.id));

      const [profilesResult, libraryResult, suggestionsResult] = await Promise.all([
        adminClient
          .from("profiles")
          .select("id, username, avatar_url, is_admin")
          .in("id", userIds),
        adminClient
          .from("user_library")
          .select("user_id, rating")
          .in("user_id", userIds),
        adminClient
          .from("suggestions")
          .select("user_id")
          .in("user_id", userIds),
      ]);

      if (profilesResult.error) throw new Error(profilesResult.error.message);
      if (libraryResult.error) throw new Error(libraryResult.error.message);
      if (suggestionsResult.error) throw new Error(suggestionsResult.error.message);

      const profilesById = new Map<string, Record<string, unknown>>();
      for (const profile of (profilesResult.data ?? []) as Record<string, unknown>[]) {
        profilesById.set(String(profile.id), profile);
      }

      const libraryByUser = new Map<string, { libraryCount: number; ratingsCount: number }>();
      for (const row of (libraryResult.data ?? []) as Record<string, unknown>[]) {
        const userId = normalizeString(row.user_id, "");
        const current = libraryByUser.get(userId) ?? { libraryCount: 0, ratingsCount: 0 };
        current.libraryCount += 1;
        if (Number(row.rating ?? 0) > 0) current.ratingsCount += 1;
        libraryByUser.set(userId, current);
      }

      const suggestionsByUser = new Map<string, number>();
      for (const row of (suggestionsResult.data ?? []) as Record<string, unknown>[]) {
        const userId = normalizeString(row.user_id, "");
        suggestionsByUser.set(userId, (suggestionsByUser.get(userId) ?? 0) + 1);
      }

      const mappedUsers = allUsers.map((authUser) => {
        const id = String(authUser.id);
        const profile = profilesById.get(id);
        const libraryStats = libraryByUser.get(id) ?? { libraryCount: 0, ratingsCount: 0 };

        return {
          id,
          email: normalizeString(authUser.email, ""),
          username: getUsername(profile, authUser),
          avatarUrl: getAvatar(profile, authUser),
          createdAt: normalizeString(authUser.created_at, ""),
          lastSignInAt: normalizeString(authUser.last_sign_in_at, ""),
          libraryCount: libraryStats.libraryCount,
          ratingsCount: libraryStats.ratingsCount,
          suggestionsCount: suggestionsByUser.get(id) ?? 0,
          isAdmin: Boolean(profile?.is_admin),
        };
      });

      const filteredUsers = mappedUsers
        .filter((authUser) => {
          if (!search) return true;
          return authUser.email.toLowerCase().includes(search) || authUser.username.toLowerCase().includes(search);
        })
        .sort((left, right) => {
          const leftTime = new Date(left.createdAt).getTime();
          const rightTime = new Date(right.createdAt).getTime();
          return rightTime - leftTime;
        });

      const start = (page - 1) * pageSize;
      const pagedUsers = filteredUsers.slice(start, start + pageSize);

      return jsonResponse(200, {
        ok: true,
        data: {
          users: pagedUsers,
          total: filteredUsers.length,
          page,
          pageSize,
        },
      });
    }

    if (payload.action === "user_detail") {
      const userId = normalizeString(payload.userId, "");
      if (!userId) {
        return jsonResponse(400, { ok: false, error: "Missing userId" });
      }

      const [{ data: authData, error: authError }, profileResult, libraryResult, suggestionsResult] = await Promise.all([
        adminClient.auth.admin.getUserById(userId),
        adminClient
          .from("profiles")
          .select("id, username, avatar_url, is_admin")
          .eq("id", userId)
          .maybeSingle(),
        adminClient
          .from("user_library")
          .select(`
            tmdb_id,
            rating,
            status,
            added_at,
            total_watched_episodes,
            media_items ( title, media_type, runtime, poster_path )
          `)
          .eq("user_id", userId)
          .order("added_at", { ascending: false }),
        adminClient
          .from("suggestions")
          .select("id, user_id, comment, user_name, user_avatar, created_at, tmdb_data")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      if (authError) throw new Error(authError.message);
      if (profileResult.error) throw new Error(profileResult.error.message);
      if (libraryResult.error) throw new Error(libraryResult.error.message);
      if (suggestionsResult.error) throw new Error(suggestionsResult.error.message);

      const authUser = authData.user as Record<string, unknown> | null;
      if (!authUser) {
        return jsonResponse(404, { ok: false, error: "User not found" });
      }

      const profile = profileResult.data as Record<string, unknown> | null;
      const libraryRows = (libraryResult.data ?? []) as Record<string, unknown>[];
      const statusBreakdown: Record<WatchStatus, number> = {
        "da-guardare": 0,
        "in-corso": 0,
        "pianificato": 0,
        "gia-guardato": 0,
      };

      let ratingsCount = 0;
      let ratingsSum = 0;
      let movieMinutes = 0;
      let tvMinutes = 0;

      const recentLibrary = libraryRows.slice(0, 6).map((row) => {
        const mediaItems = row.media_items as Record<string, unknown> | null;
        const status = (normalizeString(row.status, "da-guardare") as WatchStatus);
        statusBreakdown[status] = (statusBreakdown[status] ?? 0) + 1;

        const rating = Number(row.rating ?? 0);
        if (rating > 0) {
          ratingsCount += 1;
          ratingsSum += rating;
        }

        const runtime = Number(mediaItems?.runtime ?? 0);
        const mediaType = (mediaItems?.media_type === "tv" ? "tv" : "movie") as MediaType;
        if (mediaType === "movie") {
          movieMinutes += runtime;
        } else {
          tvMinutes += (Number(row.total_watched_episodes ?? 0) || 0) * runtime;
        }

        return {
          tmdbId: String(row.tmdb_id ?? ""),
          title: normalizeString(mediaItems?.title, "Titolo sconosciuto"),
          mediaType,
          poster: normalizeString(mediaItems?.poster_path, ""),
          status,
          rating,
        };
      });

      for (const row of libraryRows.slice(6)) {
        const mediaItems = row.media_items as Record<string, unknown> | null;
        const status = (normalizeString(row.status, "da-guardare") as WatchStatus);
        statusBreakdown[status] = (statusBreakdown[status] ?? 0) + 1;

        const rating = Number(row.rating ?? 0);
        if (rating > 0) {
          ratingsCount += 1;
          ratingsSum += rating;
        }

        const runtime = Number(mediaItems?.runtime ?? 0);
        const mediaType = (mediaItems?.media_type === "tv" ? "tv" : "movie") as MediaType;
        if (mediaType === "movie") {
          movieMinutes += runtime;
        } else {
          tvMinutes += (Number(row.total_watched_episodes ?? 0) || 0) * runtime;
        }
      }

      return jsonResponse(200, {
        ok: true,
        data: {
          id: userId,
          email: normalizeString(authUser.email, ""),
          username: getUsername(profile, authUser),
          avatarUrl: getAvatar(profile, authUser),
          createdAt: normalizeString(authUser.created_at, ""),
          lastSignInAt: normalizeString(authUser.last_sign_in_at, ""),
          libraryCount: libraryRows.length,
          ratingsCount,
          suggestionsCount: (suggestionsResult.data ?? []).length,
          isAdmin: Boolean(profile?.is_admin),
          averageRating: ratingsCount > 0 ? Number((ratingsSum / ratingsCount).toFixed(1)) : 0,
          movieMinutes,
          tvMinutes,
          totalMinutes: movieMinutes + tvMinutes,
          statusBreakdown,
          recentSuggestions: ((suggestionsResult.data ?? []) as Record<string, unknown>[]).map(mapSuggestion),
          recentLibrary,
        },
      });
    }

    if (payload.action === "delete_suggestion") {
      if (!Number.isInteger(payload.suggestionId) || payload.suggestionId <= 0) {
        return jsonResponse(400, { ok: false, error: "Invalid suggestionId" });
      }

      const { error } = await adminClient
        .from("suggestions")
        .delete()
        .eq("id", payload.suggestionId);

      if (error) throw new Error(error.message);

      return jsonResponse(200, {
        ok: true,
        data: { suggestionId: payload.suggestionId },
      });
    }

    if (payload.action === "set_admin_role") {
      const userId = normalizeString(payload.userId, "");
      if (!userId) {
        return jsonResponse(400, { ok: false, error: "Missing userId" });
      }

      const { error } = await adminClient
        .from("profiles")
        .upsert({ id: userId, is_admin: payload.isAdmin }, { onConflict: "id" });

      if (error) throw new Error(error.message);

      return jsonResponse(200, {
        ok: true,
        data: { userId, isAdmin: payload.isAdmin },
      });
    }

    return jsonResponse(400, { ok: false, error: "Unsupported action" });
  } catch (error) {
    console.error("admin-dashboard error", error);
    return jsonResponse(500, {
      ok: false,
      error: error instanceof Error ? error.message : "Admin dashboard failed",
    });
  }
});
