import type { ReleaseInfo, ReleasePhase, TmdbItem } from "../types/types";

export const RELEASE_TIME_ZONE = "Europe/Rome";

export function normalizeDateKey(value?: string | null) {
  if (!value) return "";
  const key = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : "";
}

export function getDateKey(date = new Date(), timeZone = RELEASE_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function classifyDate(value?: string | null, today = getDateKey()): ReleasePhase {
  const date = normalizeDateKey(value);
  if (!date) return "unknown";
  return date <= today ? "released" : "upcoming";
}

export type ReleaseDateChange = "advanced" | "postponed" | "removed" | "added" | "unchanged";

export function getReleaseDateChange(previous?: string | null, next?: string | null): ReleaseDateChange {
  const oldDate = normalizeDateKey(previous);
  const newDate = normalizeDateKey(next);
  if (oldDate === newDate) return "unchanged";
  if (!oldDate && newDate) return "added";
  if (oldDate && !newDate) return "removed";
  return newDate < oldDate ? "advanced" : "postponed";
}

export function reconcileReleaseStatus(
  previousDate: string | null | undefined,
  verifiedDate: string | null | undefined,
  verificationSucceeded: boolean,
  today = getDateKey(),
) {
  if (!verificationSucceeded) return { date: normalizeDateKey(previousDate) || undefined, status: "unchanged" as const };
  const date = normalizeDateKey(verifiedDate);
  if (!date) return { date: undefined, status: "removed" as const };
  return { date, status: date <= today ? "released" as const : "upcoming" as const };
}

export function buildDigitalReleaseInfo(
  date?: string | null,
  checkedAt?: string,
  region = "IT",
): ReleaseInfo {
  const normalized = normalizeDateKey(date);
  return {
    date: normalized || undefined,
    region,
    kind: normalized ? "digital" : "unknown",
    verification: normalized ? "verified_it" : "unknown",
    phase: classifyDate(normalized),
    checkedAt,
  };
}

export function buildOriginalAirDateInfo(date?: string | null, checkedAt?: string): ReleaseInfo {
  const normalized = normalizeDateKey(date);
  return {
    date: normalized || undefined,
    region: "ORIGINAL",
    kind: normalized ? "original_airdate" : "unknown",
    verification: normalized ? "original_airdate" : "unknown",
    phase: classifyDate(normalized),
    checkedAt,
  };
}

export function getEffectiveReleaseInfo(item: TmdbItem): ReleaseInfo {
  if (item.releaseInfo) {
    return {
      ...item.releaseInfo,
      date: normalizeDateKey(item.releaseInfo.date) || undefined,
      phase: classifyDate(item.releaseInfo.date),
    };
  }
  if (item.type === "tv") return buildOriginalAirDateInfo(item.nextEpisodeToAir?.air_date);
  return {
    date: normalizeDateKey(item.releaseDateFull) || undefined,
    region: "UNKNOWN",
    kind: "unknown",
    verification: "unknown",
    phase: classifyDate(item.releaseDateFull),
  };
}

export function isVerifiedFutureDigitalRelease(item: TmdbItem) {
  const info = getEffectiveReleaseInfo(item);
  return info.kind === "digital" && info.verification === "verified_it" && info.phase === "upcoming";
}

export function isFreshReleaseInfo(info?: ReleaseInfo, maxAgeMinutes = 15) {
  if (!info?.checkedAt) return false;
  const checkedAt = new Date(info.checkedAt).getTime();
  if (!Number.isFinite(checkedAt)) return false;
  return Date.now() - checkedAt <= maxAgeMinutes * 60_000;
}
