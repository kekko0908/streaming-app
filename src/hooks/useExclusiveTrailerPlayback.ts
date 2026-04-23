import { useEffect, useRef, useState } from "react";
import {
  getTrailerPlaybackState,
  releaseTrailerPlayback,
  requestTrailerPlayback,
  subscribeTrailerPlayback
} from "../utils/trailerPlayback";

export function useExclusiveTrailerPlayback(playbackId: string, shouldPlay: boolean) {
  const [playbackState, setPlaybackState] = useState(() => getTrailerPlaybackState());
  const hasRequestedRef = useRef(false);

  useEffect(() => {
    return subscribeTrailerPlayback(setPlaybackState);
  }, []);

  useEffect(() => {
    if (!shouldPlay) {
      hasRequestedRef.current = false;
      releaseTrailerPlayback(playbackId);
      return;
    }

    if (!playbackState.blocked && !hasRequestedRef.current) {
      requestTrailerPlayback(playbackId);
      hasRequestedRef.current = true;
    }
  }, [playbackId, playbackState.blocked, shouldPlay]);

  useEffect(() => {
    if (playbackState.blocked) {
      hasRequestedRef.current = false;
    }
  }, [playbackState.blocked]);

  useEffect(() => {
    return () => { releaseTrailerPlayback(playbackId); };
  }, [playbackId]);

  return shouldPlay && !playbackState.blocked && playbackState.activeId === playbackId;
}
