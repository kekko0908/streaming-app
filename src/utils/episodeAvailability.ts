import { Episode, TmdbItem } from "../types/types";
import { classifyDate, getDateKey, normalizeDateKey } from "./release";

type EpisodeTarget = {
  season: number;
  episode: number;
};

function isReleasedDate(value?: string | null) {
  return classifyDate(value) === "released";
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
  return Boolean(key && key > getDateKey());
}

export function isEpisodeReleased(ep: Episode, item?: TmdbItem, fallbackSeason?: number) {
  const target = getEpisodeTarget(ep, fallbackSeason);
  const airDate = normalizeDateKey(ep.air_date);

  if (airDate) return classifyDate(airDate) === "released";
  if (isEpisodeTargetBlockedByKnownFuture(target, item)) return false;

  return isPastSeries(item);
}

export function canAssumeMissingEpisodeIsReleased(target: EpisodeTarget, item?: TmdbItem) {
  if (isEpisodeTargetBlockedByKnownFuture(target, item)) return false;
  return isPastSeries(item);
}
