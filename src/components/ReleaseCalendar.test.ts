import { describe, expect, it } from "vitest";
import type { SavedItem, TmdbItem } from "../types/types";
import { buildReleaseCalendarEvents } from "../utils/releaseCalendar";

const movie: TmdbItem = {
  tmdbId: "101",
  type: "movie",
  title: "Film test",
  year: "2099",
  overview: "",
  poster: "",
  backdrop: "",
  rating: 7,
};

describe("release calendar", () => {
  it("mostra separatamente cinema e digitale italiani verificati", () => {
    const events = buildReleaseCalendarEvents([
      { ...movie, releaseInfo: { date: "2099-01-10", region: "IT", kind: "theatrical", verification: "verified_it", phase: "upcoming" } },
      { ...movie, releaseInfo: { date: "2099-02-10", region: "IT", kind: "digital", verification: "verified_it", phase: "upcoming" } },
    ], []);

    expect(events.map((event) => event.subtitle)).toEqual(["Al cinema", "Digitale"]);
    expect(events).toHaveLength(2);
  });

  it("include il prossimo episodio delle serie salvate come messa in onda originale", () => {
    const series: SavedItem = {
      ...movie,
      tmdbId: "202",
      type: "tv",
      title: "Serie test",
      status: "da-guardare",
      addedAt: "2026-08-09T12:00:00Z",
      nextEpisodeToAir: { id: 3, episode_number: 4, season_number: 2, name: "Episodio", air_date: "2099-03-10" },
    };

    const [event] = buildReleaseCalendarEvents([], [series]);
    expect(event.subtitle).toBe("Nuovo episodio");
    expect(event.provenance).toContain("Messa in onda originale");
  });
});
