import { describe, expect, it } from "vitest";
import {
  buildDigitalReleaseInfo,
  buildOriginalAirDateInfo,
  classifyDate,
  getDateKey,
  getReleaseDateChange,
  isVerifiedFutureDigitalRelease,
  reconcileReleaseStatus,
} from "./release";

describe("release domain", () => {
  it("considera la data odierna già uscita con confronto inclusivo", () => {
    expect(classifyDate("2026-08-09", "2026-08-09")).toBe("released");
  });

  it("usa Europe/Rome anche a cavallo della mezzanotte UTC", () => {
    expect(getDateKey(new Date("2026-08-09T22:30:00Z"), "Europe/Rome")).toBe("2026-08-10");
  });

  it("riconosce date anticipate e rinviate", () => {
    expect(getReleaseDateChange("2026-10-20", "2026-10-10")).toBe("advanced");
    expect(getReleaseDateChange("2026-10-20", "2026-11-02")).toBe("postponed");
  });

  it("riconcilia record scomparsi senza cancellarli su errore di verifica", () => {
    expect(reconcileReleaseStatus("2026-10-20", undefined, true, "2026-08-09")).toEqual({ date: undefined, status: "removed" });
    expect(reconcileReleaseStatus("2026-10-20", undefined, false, "2026-08-09")).toEqual({ date: "2026-10-20", status: "unchanged" });
  });

  it("blocca Play solo per una futura uscita digitale italiana verificata", () => {
    const base = { tmdbId: "1", type: "movie" as const, title: "Test", year: "", overview: "", poster: "", backdrop: "", rating: 0 };
    expect(isVerifiedFutureDigitalRelease({ ...base, releaseInfo: buildDigitalReleaseInfo("2026-09-01", "2026-08-09T10:00:00Z") })).toBe(true);
    expect(isVerifiedFutureDigitalRelease({ ...base, releaseInfo: buildDigitalReleaseInfo(undefined, "2026-08-09T10:00:00Z") })).toBe(false);
    expect(isVerifiedFutureDigitalRelease({
      ...base,
      releaseInfo: {
        date: "2026-09-01",
        region: "IT",
        kind: "theatrical",
        verification: "verified_it",
        phase: "upcoming",
        checkedAt: "2026-08-09T10:00:00Z",
      },
    })).toBe(false);
  });

  it("etichetta la data episodio come messa in onda originale", () => {
    const info = buildOriginalAirDateInfo("2026-09-01");
    expect(info.kind).toBe("original_airdate");
    expect(info.verification).toBe("original_airdate");
  });
});
