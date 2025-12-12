export type MediaType = "movie" | "tv";
export type WatchStatus = "da-guardare" | "in-corso" | "pianificato" | "gia-guardato";

// CORREZIONE QUI: Aggiunto "profile" alla lista
export type ViewType = "home" | "list" | "archive" | "auth" | "profile";

export interface SeasonDetail {
  season_number: number;
  episode_count: number;
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
  status?: WatchStatus; // Opzionale per i risultati di ricerca

  // NUOVO CAMPO COLLEZIONE
  collection?: {
    id: number;
    name: string;
    parts: TmdbItem[]; // I film della saga
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