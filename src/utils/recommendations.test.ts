import { describe, expect, it } from "vitest";
import type { SavedItem, TmdbItem } from "../types/types";
import { buildViewingProfile, rankPersonalizedItems } from "./recommendations";

const watched = (tmdbId: string, genres: string[], type: "movie" | "tv" = "movie"): SavedItem => ({
  tmdbId, type, genres, title: tmdbId, year: "", overview: "", poster: "/poster.jpg", backdrop: "", rating: 8,
  status: "gia-guardato", addedAt: "2026-08-01T00:00:00Z",
});

const candidate = (tmdbId: string, genres: string[], type: "movie" | "tv"): TmdbItem => ({
  tmdbId, type, genres, title: tmdbId, year: "", overview: "", poster: "/poster.jpg", backdrop: "", rating: 7,
});

describe("personalized recommendations", () => {
  it("costruisce percentuali dai generi realmente guardati", () => {
    const profile = buildViewingProfile([watched("1", ["Commedia"]), watched("2", ["Commedia", "Azione"])]);
    expect(profile[0].label).toBe("Commedia");
    expect(profile[0].percentage).toBeGreaterThan(profile[1].percentage);
  });

  it("esclude la libreria e mantiene film e serie nei risultati", () => {
    const history = [watched("1", ["Commedia"])];
    const profile = buildViewingProfile(history);
    const ranked = rankPersonalizedItems([
      candidate("1", ["Commedia"], "movie"),
      candidate("2", ["Commedia"], "movie"),
      candidate("3", ["Commedia"], "tv"),
    ], history, profile, 4);
    expect(ranked.some((item) => item.tmdbId === "1")).toBe(false);
    expect(new Set(ranked.map((item) => item.type))).toEqual(new Set(["movie", "tv"]));
  });
});
