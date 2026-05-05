export type MediaType = "movie" | "tv";
export type WatchStatus = "da-guardare" | "in-corso" | "gia-guardato";
export type CommunitySortMode = "watched" | "loved";

export type ViewType = "home" | "list" | "archive" | "auth" | "profile" | "ranking" | "suggestions" | "admin";

export interface SuggestionItem {
  id: number;
  user_id: string;
  tmdb_id: string;
  tmdb_data: TmdbItem;
  comment?: string;
  created_at: string;
  // Nuovi campi
  user_name?: string;
  user_avatar?: string;
}

export interface AdminCommunityTitle {
  tmdbId: string;
  title: string;
  mediaType: MediaType;
  poster: string;
  watchedCount?: number;
  completedCount?: number;
  communityRating?: number;
  communityScore?: number;
}

export interface AdminSuggestionSummary {
  id: number;
  tmdbId: string;
  title: string;
  mediaType: MediaType;
  poster: string;
  comment?: string;
  userId?: string;
  userName?: string;
  userAvatar?: string;
  createdAt: string;
}

export interface AdminOverview {
  totalUsers: number;
  newUsers7d: number;
  activeLibraryUsers: number;
  titlesSavedTotal: number;
  ratingsTotal: number;
  suggestionsTotal: number;
  movieLibraryEntries: number;
  tvLibraryEntries: number;
  topWatched: AdminCommunityTitle[];
  topLoved: AdminCommunityTitle[];
  topCompleted: AdminCommunityTitle[];
  recentSuggestions: AdminSuggestionSummary[];
}

export interface AdminUserRow {
  id: string;
  email: string;
  username: string;
  avatarUrl: string;
  createdAt: string;
  lastSignInAt?: string | null;
  libraryCount: number;
  ratingsCount: number;
  suggestionsCount: number;
  isAdmin: boolean;
}

export interface AdminUserDetail extends AdminUserRow {
  averageRating: number;
  movieMinutes: number;
  tvMinutes: number;
  totalMinutes: number;
  statusBreakdown: Record<WatchStatus, number>;
  recentSuggestions: AdminSuggestionSummary[];
  recentLibrary: Array<{
    tmdbId: string;
    title: string;
    mediaType: MediaType;
    poster: string;
    status: WatchStatus;
    rating: number;
  }>;
}

export interface AdminUsersResponse {
  users: AdminUserRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminActionResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

export interface SeasonDetail {
  season_number: number;
  episode_count: number;
}

// --- NUOVA INTERFACCIA EPISODIO ---
export interface Episode {
  id: number;
  season_number?: number;
  episode_number: number;
  name: string;
  air_date?: string; // Data di uscita (YYYY-MM-DD)
  still_path?: string;
  overview?: string;
}

export interface TmdbItem {
  tmdbId: string;
  type: MediaType;
  title: string;
  year: string;
  releaseDateFull?: string;
  overview: string;
  poster: string;
  backdrop: string;
  logo?: string;
  rating: number;
  runtime?: string;
  genres?: string[];
  seasons?: number;
  seasonsDetails?: SeasonDetail[];
  nextEpisodeToAir?: Episode | null;
  popularity?: number;
  status?: WatchStatus;
  progressMinutes?: number;
  progressSeconds?: number;
  communityListed?: number;
  communityWatched?: number;
  communityCompleted?: number;
  communityRatingsCount?: number;
  communityRating?: number;
  communityScore?: number;
  communitySortMode?: CommunitySortMode;

  collection?: {
    id: number;
    name: string;
    parts: TmdbItem[];
  };
}

export type SavedItem = TmdbItem & {
  status: WatchStatus;
  addedAt: string;
};

export type WatchProgress = {
  [tmdbId: string]: { season: number; episode: number };
};

export const STATUS_SECTIONS: { id: WatchStatus; label: string }[] = [
  { id: "in-corso", label: "In corso" },
  { id: "da-guardare", label: "Da guardare" },
  { id: "gia-guardato", label: "Gia guardato" }
];
