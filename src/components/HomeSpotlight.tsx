import { useEffect, useState, useRef } from "react";
import { TmdbItem } from "../types/types";
import { fetchTitleLogo, fetchTrailer } from "../utils/api";
import YouTube from 'react-youtube';
import { useExclusiveTrailerPlayback } from "../hooks/useExclusiveTrailerPlayback";
import "../css/homeSpotlight.css";
import "../css/hero.css";

interface HomeSpotlightProps {
  item?: TmdbItem;
  onSelect: (item: TmdbItem) => void;
  onPlay: (item: TmdbItem) => void;
}

export default function HomeSpotlight({ item, onSelect, onPlay }: HomeSpotlightProps) {
  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [showBgVideo, setShowBgVideo] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [volume, setVolume] = useState(60);
  const ytPlayerRef = useRef<any>(null);

  const isBgTrailerActive = useExclusiveTrailerPlayback(
    `home-spotlight-${item?.tmdbId}`,
    showBgVideo && Boolean(trailerKey)
  );

  useEffect(() => {
    let isMounted = true;
    setLogoUrl(item?.logo || null);

    if (!item) return;

    fetchTitleLogo(item.tmdbId, item.type)
      .then((logo) => {
        if (isMounted) setLogoUrl(logo || item.logo || null);
      })
      .catch(() => {
        if (isMounted) setLogoUrl(item.logo || null);
      });

    return () => {
      isMounted = false;
    };
  }, [item?.tmdbId, item?.type, item?.logo]);

  useEffect(() => {
    let isMounted = true;
    setTrailerKey(null);
    setShowBgVideo(false);

    if (!item) return;

    fetchTrailer(item.tmdbId, item.type)
      .then((key) => {
        if (isMounted) setTrailerKey(key);
      })
      .catch(() => {
        if (isMounted) setTrailerKey(null);
      });

    return () => {
      isMounted = false;
    };
  }, [item?.tmdbId, item?.type]);

  useEffect(() => {
    if (trailerKey) {
      const timer = setTimeout(() => setShowBgVideo(true), 2500);
      return () => clearTimeout(timer);
    }
  }, [trailerKey]);

  if (!item) return null;

  return (
    <section className="home-spotlight" aria-label="Titolo selezionato">
      <img className={`home-spotlight-backdrop ${isBgTrailerActive ? 'fade-out' : ''}`} src={item.backdrop || item.poster} alt="" />
      
      {isBgTrailerActive && trailerKey && (
        <div className="home-spotlight-bg-video">
          <YouTube
            videoId={trailerKey}
            opts={{
              width: '100%',
              height: '100%',
              playerVars: {
                autoplay: 1,
                controls: 0,
                showinfo: 0,
                rel: 0,
                loop: 1,
                mute: 1,
                playlist: trailerKey
              }
            }}
            onReady={(e: any) => {
              ytPlayerRef.current = e.target;
              e.target.setVolume(volume);
              if (!isMuted) e.target.unMute();
            }}
            style={{ width: '100%', height: '100%' }}
            iframeClassName="video-frame"
            title="Sfondo Trailer"
          />
        </div>
      )}
      
      <div className="home-spotlight-shade" />

      {isBgTrailerActive && trailerKey && (
        <div className="home-spotlight-volume">
          <button
            className="circle-btn"
            onClick={() => {
              const newMute = !isMuted;
              setIsMuted(newMute);
              if (ytPlayerRef.current) {
                if (newMute) ytPlayerRef.current.mute();
                else {
                  ytPlayerRef.current.unMute();
                  if (volume === 0) {
                    setVolume(60);
                    ytPlayerRef.current.setVolume(60);
                  }
                }
              }
            }}
            title={isMuted ? "Attiva Audio" : "Disattiva Audio"}
          >
            {isMuted || volume === 0 ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
            )}
          </button>
          <input
            type="range"
            min="0"
            max="100"
            value={isMuted ? 0 : volume}
            onChange={(e) => {
              const nextVolume = Number(e.target.value);
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
            className="home-spotlight-volume-slider volume-slider"
            aria-label="Volume trailer home"
          />
        </div>
      )}

      <div className="home-spotlight-content">
        <div
          className={`home-spotlight-copy ${logoUrl && item.overview ? "has-overview" : ""}`}
          tabIndex={logoUrl && item.overview ? 0 : undefined}
        >
          {logoUrl && (
            <img className="home-spotlight-logo-art" src={logoUrl} alt={item.title} />
          )}
          {logoUrl && item.overview && (
            <p className="home-spotlight-overview netflix-overview">{item.overview}</p>
          )}
        </div>

        <div className="hero-actions home-spotlight-actions-main">
          <button className="cta netflix-play" type="button" onClick={() => onPlay(item)}>
            ▶ Riproduci
          </button>
          
          {item.rating > 0 && (
             <div className="circle-btn rating" title="TMDB Rating">
               {item.rating.toFixed(1)}
             </div>
          )}

          <button className="pill ghost" type="button" onClick={() => onSelect(item)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', marginLeft: '10px' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
            Altre info
          </button>
        </div>
      </div>
    </section>
  );
}
