import type { SavedItem, TmdbItem } from "../types/types";
import { getDateKey } from "./release";

export type ReleaseCalendarEvent = {
  id: string;
  date: string;
  kind: "movie" | "episode";
  title: string;
  subtitle: string;
  meta: string;
  genres: string;
  description: string;
  provenance: string;
  poster: string;
  item: TmdbItem;
};

export function buildReleaseCalendarEvents(upcoming: TmdbItem[], myList: SavedItem[]) {
  const events = new Map<string, ReleaseCalendarEvent>();
  const todayKey = getDateKey();

  upcoming.forEach((item) => {
    const releaseDate = item.releaseInfo?.date;
    const releaseKind = item.releaseInfo?.kind;
    if (!releaseDate || item.releaseInfo?.verification !== "verified_it" || (releaseKind !== "digital" && releaseKind !== "theatrical") || releaseDate < todayKey) return;
    const id = `movie-${item.tmdbId}-${releaseKind}-${releaseDate}`;
    events.set(id, {
      id,
      date: releaseDate,
      kind: "movie",
      title: item.title,
      subtitle: releaseKind === "digital" ? "Digitale" : "Al cinema",
      meta: "",
      genres: item.genres?.slice(0, 2).join(", ") || "Genere non indicato",
      description: item.overview || "Prossima uscita in Italia.",
      provenance: releaseKind === "digital"
        ? "Pubblicazione digitale italiana · verificata TMDB"
        : "Uscita cinema Italia · verificata TMDB",
      poster: item.poster,
      item,
    });
  });

  myList.forEach((item) => {
    const episode = item.nextEpisodeToAir;
    if (!episode?.air_date || episode.air_date < todayKey) return;
    const id = `episode-${item.tmdbId}-${episode.air_date}-${episode.season_number || 0}-${episode.episode_number}`;
    events.set(id, {
      id,
      date: episode.air_date,
      kind: "episode",
      title: item.title,
      subtitle: "Nuovo episodio",
      meta: `S${episode.season_number || 1} · Ep. ${episode.episode_number}`,
      genres: item.genres?.slice(0, 2).join(", ") || "Serie TV",
      description: episode.overview || item.overview || "Nuovo episodio in arrivo.",
      provenance: "Messa in onda originale · TMDB",
      poster: item.poster,
      item,
    });
  });

  return Array.from(events.values()).sort((a, b) => a.date.localeCompare(b.date));
}
