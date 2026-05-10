import { Episode, TmdbItem } from "../types/types";

type EpisodeTarget = {
  season: number;
  episode: number;
};

function todayKey() {
  const today = new Date();
  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");
}

function normalizeDateKey(value?: string | null) {
  if (!value) return "";
  const key = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : "";
}

function isReleasedDate(value?: string | null) {
  const key = normalizeDateKey(value);
  return Boolean(key && key <= todayKey());
}

function compareEpisodeTarget(left: EpisodeTarget, right: EpisodeTarget) {
  if (left.season !== right.season) return left.season - right.season;
  return left.episode - right.episode;
}

function getEpisodeTarget(ep: Episode, fallbackSeason?: number): EpisodeTarget {
  return {
    season: ep.season_number || fallbackSeason || 1,
    episode: ep.episode_number,
  };
}

function isPastSeries(item?: TmdbItem) {
  const releaseYear = Number((item?.releaseDateFull || item?.year || "").slice(0, 4));
  if (!Number.isFinite(releaseYear) || releaseYear <= 0) return false;
  return releaseYear < new Date().getFullYear();
}

export function isEpisodeTargetBlockedByKnownFuture(target: EpisodeTarget, item?: TmdbItem) {
  const nextEpisode = item?.nextEpisodeToAir;
  if (!nextEpisode?.episode_number || isReleasedDate(nextEpisode.air_date)) return false;

  const upcomingTarget = getEpisodeTarget(nextEpisode);
  return compareEpisodeTarget(target, upcomingTarget) >= 0;
}

export function hasFutureAirDate(ep?: Episode | null) {
  const key = normalizeDateKey(ep?.air_date);
  return Boolean(key && key > todayKey());
}

export function isEpisodeReleased(ep: Episode, item?: TmdbItem, fallbackSeason?: number) {
  const target = getEpisodeTarget(ep, fallbackSeason);
  const airDate = normalizeDateKey(ep.air_date);

  if (airDate) return airDate <= todayKey();
  if (isEpisodeTargetBlockedByKnownFuture(target, item)) return false;

  return isPastSeries(item);
}

export function canAssumeMissingEpisodeIsReleased(target: EpisodeTarget, item?: TmdbItem) {
  if (isEpisodeTargetBlockedByKnownFuture(target, item)) return false;
  return isPastSeries(item);
}
