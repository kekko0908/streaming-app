import { lazy } from "react";
import { Session } from "@supabase/supabase-js";
import { TmdbItem } from "../../types/types";
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
        <div className="modal-backdrop-glass" onClick={onCloseUnavailable}>
          <div className="modal-glass-box" onClick={(event) => event.stopPropagation()}>
            <h3>Film {unavailableItem.title} ancora non disponibile</h3>
            <p>Non e ancora uscito o non e presente nel catalogo streaming.</p>
            <button className="pill solid" onClick={onCloseUnavailable}>Ok</button>
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
