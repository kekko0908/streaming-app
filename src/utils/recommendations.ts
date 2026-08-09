import type { MediaType, SavedItem, TmdbItem } from "../types/types";

export type GenrePreference = {
  key: string;
  label: string;
  percentage: number;
  weight: number;
  movieGenreId: number;
  tvGenreId: number;
};

type GenreDefinition = Omit<GenrePreference, "percentage" | "weight"> & { aliases: string[] };

export const GENRE_DEFINITIONS: GenreDefinition[] = [
  { key: "drama", label: "Dramma", movieGenreId: 18, tvGenreId: 18, aliases: ["dramma", "drama"] },
  { key: "action", label: "Azione", movieGenreId: 28, tvGenreId: 10759, aliases: ["azione", "action", "action adventure"] },
  { key: "adventure", label: "Avventura", movieGenreId: 12, tvGenreId: 10759, aliases: ["avventura", "adventure", "action adventure"] },
  { key: "animation", label: "Animazione", movieGenreId: 16, tvGenreId: 16, aliases: ["animazione", "animation"] },
  { key: "comedy", label: "Commedia", movieGenreId: 35, tvGenreId: 35, aliases: ["commedia", "comedy"] },
  { key: "crime", label: "Crime", movieGenreId: 80, tvGenreId: 80, aliases: ["crime", "crimine"] },
  { key: "documentary", label: "Documentario", movieGenreId: 99, tvGenreId: 99, aliases: ["documentario", "documentary"] },
  { key: "family", label: "Famiglia", movieGenreId: 10751, tvGenreId: 10751, aliases: ["famiglia", "family", "kids"] },
  { key: "fantasy", label: "Fantasy", movieGenreId: 14, tvGenreId: 10765, aliases: ["fantasy", "sci fi fantasy"] },
  { key: "horror", label: "Horror", movieGenreId: 27, tvGenreId: 9648, aliases: ["horror"] },
  { key: "mystery", label: "Mistero", movieGenreId: 9648, tvGenreId: 9648, aliases: ["mistero", "mystery"] },
  { key: "romance", label: "Romance", movieGenreId: 10749, tvGenreId: 18, aliases: ["romance", "romantico"] },
  { key: "science-fiction", label: "Fantascienza", movieGenreId: 878, tvGenreId: 10765, aliases: ["fantascienza", "science fiction", "sci fi", "sci fi fantasy"] },
  { key: "thriller", label: "Thriller", movieGenreId: 53, tvGenreId: 9648, aliases: ["thriller"] },
];

function normalizeGenre(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function resolveGenres(genres: string[] = []) {
  const normalized = genres.map(normalizeGenre);
  return GENRE_DEFINITIONS.filter((definition) =>
    definition.aliases.some((alias) => normalized.includes(normalizeGenre(alias)))
  );
}

export function buildViewingProfile(myList: SavedItem[]): GenrePreference[] {
  const weights = new Map<string, number>();
  const watched = myList.filter((item) => item.status === "gia-guardato" || item.status === "in-corso");

  watched.forEach((item) => {
    const completionWeight = item.status === "gia-guardato" ? 1 : 0.7;
    const ratingWeight = item.rating > 0 ? Math.max(0.45, item.rating / 10) : 0.75;
    const progressWeight = item.type === "tv" && (item.watchedEpisodes || 0) > 0
      ? Math.min(1.45, 1 + Math.log10((item.watchedEpisodes || 0) + 1) * 0.2)
      : 1;
    resolveGenres(item.genres).forEach((genre) => {
      weights.set(genre.key, (weights.get(genre.key) || 0) + completionWeight * ratingWeight * progressWeight);
    });
  });

  const total = Array.from(weights.values()).reduce((sum, weight) => sum + weight, 0);
  if (total === 0) return [];

  return GENRE_DEFINITIONS
    .filter((genre) => weights.has(genre.key))
    .map((genre) => ({
      key: genre.key,
      label: genre.label,
      movieGenreId: genre.movieGenreId,
      tvGenreId: genre.tvGenreId,
      weight: weights.get(genre.key) || 0,
      percentage: Math.round(((weights.get(genre.key) || 0) / total) * 100),
    }))
    .sort((a, b) => b.weight - a.weight);
}

function scoreCandidate(item: TmdbItem, profile: GenrePreference[]) {
  const candidateKeys = new Set(resolveGenres(item.genres).map((genre) => genre.key));
  const affinity = profile.reduce((score, genre) => score + (candidateKeys.has(genre.key) ? genre.percentage : 0), 0);
  return affinity * 10 + Math.min(100, item.popularity || 0) + (item.rating || 0) * 4;
}

export function rankPersonalizedItems(candidates: TmdbItem[], myList: SavedItem[], profile: GenrePreference[], limit = 40) {
  const libraryKeys = new Set(myList.map((item) => `${item.type}:${item.tmdbId}`));
  const unique = Array.from(new Map(
    candidates
      .filter((item) => !libraryKeys.has(`${item.type}:${item.tmdbId}`) && item.poster)
      .map((item) => [`${item.type}:${item.tmdbId}`, item])
  ).values());
  const sorted = unique.sort((a, b) => scoreCandidate(b, profile) - scoreCandidate(a, profile));
  const movies = sorted.filter((item) => item.type === "movie");
  const series = sorted.filter((item) => item.type === "tv");
  const watched = myList.filter((item) => item.status !== "da-guardare");
  const movieHistoryShare = watched.length > 0 ? watched.filter((item) => item.type === "movie").length / watched.length : 0.5;
  const movieShare = Math.min(0.65, Math.max(0.35, movieHistoryShare));
  const movieTarget = Math.round(limit * movieShare);
  const selected = [...movies.slice(0, movieTarget), ...series.slice(0, limit - movieTarget)];
  const selectedKeys = new Set(selected.map((item) => `${item.type}:${item.tmdbId}`));
  const filled = [...selected, ...sorted.filter((item) => !selectedKeys.has(`${item.type}:${item.tmdbId}`))].slice(0, limit);

  return filled
    .sort((a, b) => scoreCandidate(b, profile) - scoreCandidate(a, profile))
    .slice(0, limit);
}

export function getGenreId(preference: GenrePreference, type: MediaType) {
  return type === "movie" ? preference.movieGenreId : preference.tvGenreId;
}
