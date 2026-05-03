import { useEffect } from "react";
import { TmdbItem, WatchStatus } from "../types/types";

export function useDirectActions({
  onPlayDirect,
  onAddToListDirect,
  onRemoveFromListDirect,
}: {
  onPlayDirect: (detail: { item: TmdbItem; season: number; episode: number }) => void | Promise<void>;
  onAddToListDirect: (detail: { item: TmdbItem; status?: WatchStatus }) => void | Promise<void>;
  onRemoveFromListDirect: (detail: { tmdbId: string }) => void;
}) {
  useEffect(() => {
    const handlePlayDirect = (event: Event) => {
      const customEvent = event as CustomEvent<{ item: TmdbItem; season: number; episode: number }>;
      onPlayDirect(customEvent.detail);
    };

    const handleAddToListDirect = (event: Event) => {
      const customEvent = event as CustomEvent<{ item: TmdbItem; status?: WatchStatus }>;
      onAddToListDirect(customEvent.detail);
    };

    const handleRemoveFromListDirect = (event: Event) => {
      const customEvent = event as CustomEvent<{ tmdbId: string }>;
      onRemoveFromListDirect(customEvent.detail);
    };

    window.addEventListener("play_direct", handlePlayDirect);
    window.addEventListener("add_to_list_direct", handleAddToListDirect);
    window.addEventListener("remove_from_list_direct", handleRemoveFromListDirect);

    return () => {
      window.removeEventListener("play_direct", handlePlayDirect);
      window.removeEventListener("add_to_list_direct", handleAddToListDirect);
      window.removeEventListener("remove_from_list_direct", handleRemoveFromListDirect);
    };
  }, [onAddToListDirect, onPlayDirect, onRemoveFromListDirect]);
}
