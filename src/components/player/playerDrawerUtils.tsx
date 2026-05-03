import { SeasonDetail } from "../../types/types";

export const RTC_CONFIG = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

export const Icons = {
  MicOn: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>,
  MicOff: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>,
  Sync: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>,
  Send: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  Close: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
};

export const playBeep = (freq = 440, type: OscillatorType = "sine") => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0.05;
    osc.type = type;
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.15);
    setTimeout(() => ctx.close(), 200);
  } catch (error) {
    console.error("Audio error", error);
  }
};

type EpisodeTarget = {
  season: number;
  episode: number;
};

export function resolveEpisodeNavigation(
  seasonsDetails: SeasonDetail[] | undefined,
  season: number,
  episode: number
): {
  previousTarget: EpisodeTarget | null;
  nextTarget: EpisodeTarget | null;
  nextLabel: string;
} {
  if (!seasonsDetails || seasonsDetails.length === 0) {
    return {
      previousTarget: episode > 1 ? { season, episode: episode - 1 } : null,
      nextTarget: { season, episode: episode + 1 },
      nextLabel: "Prossimo",
    };
  }

  const sortedSeasons = [...seasonsDetails]
    .filter((entry) => entry.season_number > 0 && entry.episode_count > 0)
    .sort((a, b) => a.season_number - b.season_number);
  const currentSeasonIndex = sortedSeasons.findIndex((entry) => entry.season_number === season);

  if (currentSeasonIndex === -1) {
    return {
      previousTarget: episode > 1 ? { season, episode: episode - 1 } : null,
      nextTarget: { season, episode: episode + 1 },
      nextLabel: "Prossimo",
    };
  }

  const currentSeason = sortedSeasons[currentSeasonIndex];
  const previousSeason = currentSeasonIndex > 0 ? sortedSeasons[currentSeasonIndex - 1] : null;
  const nextSeason = currentSeasonIndex < sortedSeasons.length - 1 ? sortedSeasons[currentSeasonIndex + 1] : null;
  const previousTarget =
    episode > 1
      ? { season, episode: episode - 1 }
      : previousSeason
        ? { season: previousSeason.season_number, episode: previousSeason.episode_count }
        : null;

  if (episode < currentSeason.episode_count) {
    return {
      previousTarget,
      nextTarget: { season, episode: episode + 1 },
      nextLabel: "Prossimo",
    };
  }

  if (nextSeason) {
    return {
      previousTarget,
      nextTarget: { season: nextSeason.season_number, episode: 1 },
      nextLabel: "Prossima stagione",
    };
  }

  return {
    previousTarget,
    nextTarget: null,
    nextLabel: "Prossimo",
  };
}
