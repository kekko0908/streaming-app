export interface TrailerPlaybackState {
  activeId: string | null;
  blocked: boolean;
}

const TRAILER_PLAYBACK_EVENT = "sfa:trailer-playback-change";

let activeTrailerId: string | null = null;
let playbackBlocked = false;

function snapshot(): TrailerPlaybackState {
  return {
    activeId: activeTrailerId,
    blocked: playbackBlocked
  };
}

function emitState() {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent<TrailerPlaybackState>(TRAILER_PLAYBACK_EVENT, {
      detail: snapshot()
    })
  );
}

export function getTrailerPlaybackState(): TrailerPlaybackState {
  return snapshot();
}

export function requestTrailerPlayback(playbackId: string) {
  if (playbackBlocked) return false;
  if (activeTrailerId === playbackId) return true;

  activeTrailerId = playbackId;
  emitState();
  return true;
}

export function releaseTrailerPlayback(playbackId: string) {
  if (activeTrailerId !== playbackId) return false;

  activeTrailerId = null;
  emitState();
  return true;
}

export function setTrailerPlaybackBlocked(blocked: boolean) {
  const shouldEmit = playbackBlocked !== blocked || (blocked && activeTrailerId !== null);

  playbackBlocked = blocked;
  if (blocked) {
    activeTrailerId = null;
  }

  if (shouldEmit) {
    emitState();
  }
}

export function subscribeTrailerPlayback(listener: (state: TrailerPlaybackState) => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handler = (event: Event) => {
    listener((event as CustomEvent<TrailerPlaybackState>).detail);
  };

  window.addEventListener(TRAILER_PLAYBACK_EVENT, handler as EventListener);
  return () => window.removeEventListener(TRAILER_PLAYBACK_EVENT, handler as EventListener);
}
