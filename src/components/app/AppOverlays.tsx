import { lazy } from "react";
import { Session } from "@supabase/supabase-js";
import { TmdbItem } from "../../types/types";
import { formatDate, getTmdbImageUrl } from "../../utils/helper";
import { setTrailerPlaybackBlocked } from "../../utils/trailerPlayback";
import type { UpdateItem } from "../UpdatesModal";
import { DeferredOverlay, DeferredSection } from "./AppShell";

const PlayerDrawer = lazy(() => import("../PlayerDrawer"));
const UpdatesModal = lazy(() => import("../UpdatesModal"));

export function AppOverlays({
  session,
  showPlayer,
  playerState,
  playingItem,
  isPipMode,
  unavailableItem,
  showUpdates,
  updatesItems,
  updatesVersion,
  onClosePlayer,
  onTogglePip,
  onNavigateEpisode,
  onProgressUpdate,
  onEpisodeWatched,
  onCloseUnavailable,
  onCloseUpdates,
}: {
  session: Session | null;
  showPlayer: boolean;
  playerState: { season: number; episode: number; startAt?: number } | null;
  playingItem: TmdbItem | null;
  isPipMode: boolean;
  unavailableItem: TmdbItem | null;
  showUpdates: boolean;
  updatesItems: UpdateItem[];
  updatesVersion: string;
  onClosePlayer: () => void;
  onTogglePip: () => void;
  onNavigateEpisode: (season: number, episode: number) => void;
  onProgressUpdate: (seconds: number) => void;
  onEpisodeWatched: (
    season: number,
    episode: number,
    nextTarget?: { season: number; episode: number } | null
  ) => void;
  onCloseUnavailable: () => void;
  onCloseUpdates: () => void;
}) {
  return (
    <>
      {session && showPlayer && playerState && playingItem && (
        <DeferredOverlay>
          <PlayerDrawer
            item={playingItem}
            season={playerState.season}
            episode={playerState.episode}
            onClose={() => {
              setTrailerPlaybackBlocked(false);
              onClosePlayer();
            }}
            isPipMode={isPipMode}
            onTogglePip={onTogglePip}
            onNavigateEpisode={onNavigateEpisode}
            onProgressUpdate={onProgressUpdate}
            onEpisodeWatched={onEpisodeWatched}
            startAt={playerState.startAt}
          />
        </DeferredOverlay>
      )}

      {unavailableItem && (
        <div className="drawer-backdrop unavailable-player-backdrop" onClick={onCloseUnavailable}>
          <div className="unavailable-player" onClick={(event) => event.stopPropagation()}>
            <div
              className="unavailable-player-art"
              style={{ backgroundImage: `url(${getTmdbImageUrl(unavailableItem.backdrop || unavailableItem.poster, "w1280")})` }}
              aria-hidden="true"
            />
            <div className="unavailable-player-scrim" aria-hidden="true" />
            <button className="unavailable-player-close" onClick={onCloseUnavailable} aria-label="Chiudi">
              x
            </button>

            <div className="unavailable-player-content">
              <img
                src={getTmdbImageUrl(unavailableItem.poster, "w500")}
                alt={`Poster ${unavailableItem.title}`}
                className="unavailable-player-poster"
              />
              <div className="unavailable-player-copy">
                <span className="unavailable-player-kicker">Uscita digitale italiana prevista</span>
                <h3>{unavailableItem.title}</h3>
                <div className="unavailable-release-card">
                  <span>Data verificata su TMDB</span>
                  <strong>{formatDate(unavailableItem.releaseInfo?.date) || "Data non confermata"}</strong>
                </div>
                <p>
                  Ultimo controllo: {unavailableItem.releaseInfo?.checkedAt
                    ? new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short" }).format(new Date(unavailableItem.releaseInfo.checkedAt))
                    : "non disponibile"}. La data non garantisce la disponibilita della fonte del player.
                </p>
                <button className="pill solid unavailable-player-action" onClick={onCloseUnavailable}>
                  Torna alla scheda
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showUpdates && (
        <DeferredSection>
          <UpdatesModal items={updatesItems} version={updatesVersion} onClose={onCloseUpdates} />
        </DeferredSection>
      )}
    </>
  );
}
