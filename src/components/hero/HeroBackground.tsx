import { useRef, useState } from "react";
import YouTube from "react-youtube";
import { TmdbItem } from "../../types/types";
import { Icon } from "../ui/Icon";

export function HeroBackground({
  item,
  trailerKey,
  isBgTrailerActive,
}: {
  item: TmdbItem;
  trailerKey: string | null;
  isBgTrailerActive: boolean;
}) {
  const [isMuted, setIsMuted] = useState(true);
  const [volume, setVolume] = useState(60);
  const ytPlayerRef = useRef<any>(null);

  return (
    <>
      <div className="hero-overlay" />
      <img src={item.backdrop} alt={item.title} className={`hero-bg ${isBgTrailerActive ? "fade-out" : ""}`} loading="eager" decoding="async" />

      {isBgTrailerActive && trailerKey && (
        <div className="hero-bg-video">
          <YouTube
            videoId={trailerKey}
            className="youtube-fill"
            opts={{
              width: "100%",
              height: "100%",
              playerVars: {
                autoplay: 1,
                controls: 0,
                showinfo: 0,
                rel: 0,
                loop: 1,
                mute: 1,
                playlist: trailerKey,
              },
            }}
            onReady={(event: any) => {
              ytPlayerRef.current = event.target;
              event.target.setVolume(volume);
              if (!isMuted) event.target.unMute();
            }}
            iframeClassName="video-frame"
            title="Sfondo Trailer"
          />
        </div>
      )}

      {isBgTrailerActive && trailerKey && (
        <div className="volume-control-wrapper">
          <button
            className="circle-btn"
            onClick={() => {
              const nextMuted = !isMuted;
              setIsMuted(nextMuted);
              if (!ytPlayerRef.current) return;
              if (nextMuted) {
                ytPlayerRef.current.mute();
                return;
              }
              ytPlayerRef.current.unMute();
              if (volume === 0) {
                setVolume(60);
                ytPlayerRef.current.setVolume(60);
              }
            }}
            title={isMuted ? "Attiva Audio" : "Disattiva Audio"}
          >
            <Icon name={isMuted || volume === 0 ? "volume-off" : "volume"} size={20} />
          </button>
          <input
            type="range"
            min="0"
            max="100"
            value={isMuted ? 0 : volume}
            onChange={(event) => {
              const nextVolume = Number(event.target.value);
              setVolume(nextVolume);
              if (!ytPlayerRef.current) return;

              ytPlayerRef.current.setVolume(nextVolume);
              if (nextVolume === 0) {
                setIsMuted(true);
                ytPlayerRef.current.mute();
              } else {
                setIsMuted(false);
                ytPlayerRef.current.unMute();
              }
            }}
            className="volume-slider"
          />
        </div>
      )}
    </>
  );
}
