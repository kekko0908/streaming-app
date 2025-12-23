export type MediaType = "movie" | "tv";
export type WatchStatus = "da-guardare" | "in-corso" | "pianificato" | "gia-guardato";

export type ViewType = "home" | "list" | "archive" | "auth" | "profile" | "ranking" | "suggestions";

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
export interface SeasonDetail {
  season_number: number;
  episode_count: number;
}

// --- NUOVA INTERFACCIA EPISODIO ---
export interface Episode {
  id: number;
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
  rating: number;
  runtime?: string;
  genres?: string[];
  seasons?: number;
  seasonsDetails?: SeasonDetail[];
  popularity?: number;
  status?: WatchStatus;
  progressMinutes?: number;

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
  { id: "gia-guardato", label: "Gia guardato" },
  { id: "pianificato", label: "Pianificato" }
];
