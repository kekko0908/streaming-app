import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import { SavedItem, TmdbItem } from "../types/types";
import { fetchDetails } from "../utils/api";
import { formatDate } from "../utils/helper";

export type ReleaseNotificationRecord = {
  key: string;
  item: TmdbItem;
  enabledAt: string;
};

export type ReleaseNotificationMessage = {
  id: string;
  item: TmdbItem;
  title: string;
  message: string;
  meta: string;
  kind: "movie" | "tv";
};

type StoredReleaseNotifications = {
  enabled: Record<string, ReleaseNotificationRecord>;
  readIds: string[];
};

type ToggleReleaseNotificationEvent = CustomEvent<{ item: TmdbItem; enabled?: boolean }>;
type ReleaseNotificationRow = {
  tmdb_id: number;
  media_type: "movie" | "tv";
  item_snapshot: TmdbItem;
  enabled_at: string;
  read_at: string | null;
};

const STORAGE_PREFIX = "sfa_release_notifications";
const STATE_EVENT = "release_notification_state_changed";
const TOGGLE_EVENT = "toggle_release_notifications";

function getItemKey(item: Pick<TmdbItem, "type" | "tmdbId">) {
  return `${item.type}:${item.tmdbId}`;
}

function getStorageKey(userId?: string) {
  return `${STORAGE_PREFIX}:${userId || "guest"}`;
}

function readStored(userId?: string): StoredReleaseNotifications {
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    if (!raw) return { enabled: {}, readIds: [] };
    const parsed = JSON.parse(raw) as Partial<StoredReleaseNotifications>;
    return {
      enabled: parsed.enabled && typeof parsed.enabled === "object" ? parsed.enabled : {},
      readIds: Array.isArray(parsed.readIds) ? parsed.readIds : [],
    };
  } catch {
    return { enabled: {}, readIds: [] };
  }
}

function writeStored(userId: string | undefined, value: StoredReleaseNotifications) {
  localStorage.setItem(getStorageKey(userId), JSON.stringify(value));
}

function rowToRecord(row: ReleaseNotificationRow): ReleaseNotificationRecord {
  const item = {
    ...row.item_snapshot,
    tmdbId: String(row.tmdb_id),
    type: row.media_type,
  };
  return {
    key: getItemKey(item),
    item,
    enabledAt: row.enabled_at,
  };
}

function buildRemotePayload(userId: string, record: ReleaseNotificationRecord) {
  return {
    user_id: userId,
    tmdb_id: parseInt(record.item.tmdbId, 10),
    media_type: record.item.type,
    item_snapshot: record.item,
    enabled_at: record.enabledAt,
    read_at: null,
    updated_at: new Date().toISOString(),
  };
}

function mergeFreshItem(current: TmdbItem, fresh: TmdbItem): TmdbItem {
  return {
    ...current,
    ...fresh,
    status: current.status,
    progressMinutes: current.progressMinutes,
    progressSeconds: current.progressSeconds,
  };
}

function normalizeSavedItem(item: SavedItem): TmdbItem {
  return {
    tmdbId: item.tmdbId,
    type: item.type,
    title: item.title,
    year: item.year,
    releaseDateFull: item.releaseDateFull,
    overview: item.overview,
    poster: item.poster,
    backdrop: item.backdrop,
    logo: item.logo,
    rating: item.rating,
    runtime: item.runtime,
    genres: item.genres,
    seasons: item.seasons,
    seasonsDetails: item.seasonsDetails,
    status: item.status,
    progressMinutes: item.progressMinutes,
    progressSeconds: item.progressSeconds,
  };
}

function getMovieMessage(item: TmdbItem) {
  if (!item.releaseDateFull) {
    return "Ti avviseremo quando avremo una data di uscita affidabile per questo film.";
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const releaseDate = new Date(item.releaseDateFull);
  releaseDate.setHours(0, 0, 0, 0);

  if (Number.isNaN(releaseDate.getTime())) {
    return "Ti avviseremo quando la data di uscita sara aggiornata.";
  }

  if (releaseDate.getTime() === today.getTime()) return "Esce oggi.";
  if (releaseDate > today) return `Esce il ${formatDate(item.releaseDateFull)}.`;
  return `Risulta uscito il ${formatDate(item.releaseDateFull)}.`;
}

function getTvMessage(item: TmdbItem) {
  const nextEpisode = item.nextEpisodeToAir;
  if (nextEpisode?.air_date) {
    const episodeLabel = [
      nextEpisode.season_number ? `S${nextEpisode.season_number}` : "",
      nextEpisode.episode_number ? `E${nextEpisode.episode_number}` : "",
    ].filter(Boolean).join(" ");
    return `Prossimo episodio ${episodeLabel}: ${formatDate(nextEpisode.air_date)}.`;
  }

  if (item.status === "gia-guardato") return "TMDB non indica ancora una nuova stagione datata.";
  return "TMDB non indica ancora un prossimo episodio datato.";
}

function buildMessage(record: ReleaseNotificationRecord): ReleaseNotificationMessage {
  const item = record.item;
  const kind = item.type === "tv" ? "tv" : "movie";
  return {
    id: record.key,
    item,
    title: item.title,
    message: kind === "movie" ? getMovieMessage(item) : getTvMessage(item),
    meta: kind === "movie" ? "Film monitorato" : "Serie monitorata",
    kind,
  };
}

function publishState(enabledKeys: string[]) {
  (window as any).sfaReleaseNotificationKeys = enabledKeys;
  window.dispatchEvent(new CustomEvent(STATE_EVENT, { detail: { enabledKeys } }));
}

export function useReleaseNotifications(userId: string | undefined, myList: SavedItem[]) {
  const [stored, setStored] = useState<StoredReleaseNotifications>(() => readStored(userId));
  const enrichedKeysRef = useRef<Set<string>>(new Set());

  const updateRecord = (record: ReleaseNotificationRecord, options?: { preserveRead?: boolean }) => {
    setStored((current) => {
      const existing = current.enabled[record.key];
      if (!existing) return current;
      const next: StoredReleaseNotifications = {
        enabled: {
          ...current.enabled,
          [record.key]: {
            ...existing,
            ...record,
          },
        },
        readIds: options?.preserveRead ? current.readIds : current.readIds.filter((id) => id !== record.key),
      };
      writeStored(userId, next);
      publishState(Object.keys(next.enabled));
      return next;
    });

    if (userId) {
      supabase
        .from("release_notification_settings")
        .upsert(buildRemotePayload(userId, record), { onConflict: "user_id,tmdb_id,media_type" })
        .then(({ error }) => {
          if (error) console.warn("Notifiche uscite: salvataggio dettaglio TMDB non riuscito", error.message);
        });
    }
  };

  const enrichRecord = async (record: ReleaseNotificationRecord, options?: { preserveRead?: boolean }) => {
    try {
      const freshItem = await fetchDetails(record.item.tmdbId, record.item.type);
      updateRecord({
        ...record,
        item: mergeFreshItem(record.item, freshItem),
      }, options);
    } catch (error) {
      console.warn("Notifiche uscite: dettaglio TMDB non caricato", error);
    }
  };

  useEffect(() => {
    let isActive = true;
    const localStored = readStored(userId);
    setStored(localStored);
    publishState(Object.keys(localStored.enabled));

    const loadRemote = async () => {
      if (!userId) return;

      const { data, error } = await supabase
        .from("release_notification_settings")
        .select("tmdb_id, media_type, item_snapshot, enabled_at, read_at")
        .eq("user_id", userId)
        .order("enabled_at", { ascending: false });

      if (error) {
        console.warn("Notifiche uscite: uso cache locale, tabella Supabase non disponibile", error.message);
        return;
      }

      const remoteStored: StoredReleaseNotifications = { enabled: {}, readIds: [] };
      for (const row of (data || []) as ReleaseNotificationRow[]) {
        const record = rowToRecord(row);
        remoteStored.enabled[record.key] = record;
        if (row.read_at) remoteStored.readIds.push(record.key);
      }

      const localRecordsToMigrate = Object.values(localStored.enabled).filter((record) => !remoteStored.enabled[record.key]);
      if (localRecordsToMigrate.length > 0) {
        await supabase
          .from("release_notification_settings")
          .upsert(
            localRecordsToMigrate.map((record) => buildRemotePayload(userId, record)),
            { onConflict: "user_id,tmdb_id,media_type" }
          );

        for (const record of localRecordsToMigrate) {
          remoteStored.enabled[record.key] = record;
          if (localStored.readIds.includes(record.key)) remoteStored.readIds.push(record.key);
        }
      }

      if (!isActive) return;
      writeStored(userId, remoteStored);
      setStored(remoteStored);
      publishState(Object.keys(remoteStored.enabled));
    };

    loadRemote();
    return () => {
      isActive = false;
    };
  }, [userId]);

  useEffect(() => {
    for (const record of Object.values(stored.enabled)) {
      const shouldEnrich =
        !enrichedKeysRef.current.has(record.key) &&
        (
          (record.item.type === "movie" && !record.item.releaseDateFull) ||
          (record.item.type === "tv" && !record.item.nextEpisodeToAir)
        );

      if (!shouldEnrich) continue;
      enrichedKeysRef.current.add(record.key);
      enrichRecord(record, { preserveRead: true });
    }
  }, [stored.enabled, userId]);

  useEffect(() => {
    const handleToggle = (event: Event) => {
      const { item, enabled } = (event as ToggleReleaseNotificationEvent).detail;
      if (!item?.tmdbId || !item.type) return;

      let remoteAction: Promise<unknown> | null = null;
      setStored((current) => {
        const key = getItemKey(item);
        const isEnabled = Boolean(current.enabled[key]);
        const shouldEnable = enabled ?? !isEnabled;
        const next: StoredReleaseNotifications = {
          enabled: { ...current.enabled },
          readIds: current.readIds.filter((id) => id !== key),
        };

        if (shouldEnable) {
          const record = {
            key,
            item,
            enabledAt: current.enabled[key]?.enabledAt || new Date().toISOString(),
          };
          next.enabled[key] = {
            ...record,
          };
          if (userId) {
            remoteAction = supabase
              .from("release_notification_settings")
              .upsert(buildRemotePayload(userId, record), { onConflict: "user_id,tmdb_id,media_type" });
          }
        } else {
          delete next.enabled[key];
          next.readIds = current.readIds.filter((id) => id !== key);
          if (userId) {
            remoteAction = supabase
              .from("release_notification_settings")
              .delete()
              .eq("user_id", userId)
              .eq("tmdb_id", parseInt(item.tmdbId, 10))
              .eq("media_type", item.type);
          }
        }

        writeStored(userId, next);
        publishState(Object.keys(next.enabled));
        return next;
      });

      if ((enabled ?? true) && item.tmdbId) {
        const key = getItemKey(item);
        enrichedKeysRef.current.delete(key);
        enrichRecord({
          key,
          item,
          enabledAt: new Date().toISOString(),
        });
      }

      remoteAction?.catch((error) => {
        console.warn("Notifiche uscite: sincronizzazione Supabase non riuscita", error);
      });
    };

    window.addEventListener(TOGGLE_EVENT, handleToggle);
    return () => window.removeEventListener(TOGGLE_EVENT, handleToggle);
  }, [userId]);

  useEffect(() => {
    if (myList.length === 0) return;
    setStored((current) => {
      let changed = false;
      const nextEnabled = { ...current.enabled };

      for (const savedItem of myList) {
        const key = getItemKey(savedItem);
        if (!nextEnabled[key]) continue;
        const savedSnapshot = normalizeSavedItem(savedItem);
        const currentItem = nextEnabled[key].item;
        nextEnabled[key] = {
          ...nextEnabled[key],
          item: {
            ...currentItem,
            ...savedSnapshot,
            releaseDateFull: savedSnapshot.releaseDateFull || currentItem.releaseDateFull,
            overview: savedSnapshot.overview || currentItem.overview,
            backdrop: savedSnapshot.backdrop || currentItem.backdrop,
            poster: savedSnapshot.poster || currentItem.poster,
            year: savedSnapshot.year || currentItem.year,
          },
        };
        changed = true;
      }

      if (!changed) return current;
      const next = { ...current, enabled: nextEnabled };
      writeStored(userId, next);
      publishState(Object.keys(next.enabled));

      if (userId) {
        supabase
          .from("release_notification_settings")
          .upsert(
            Object.values(nextEnabled).map((record) => ({
              ...buildRemotePayload(userId, record),
              read_at: current.readIds.includes(record.key) ? new Date().toISOString() : null,
            })),
            { onConflict: "user_id,tmdb_id,media_type" }
          )
          .then(({ error }) => {
            if (error) console.warn("Notifiche uscite: aggiornamento snapshot non riuscito", error.message);
          });
      }

      return next;
    });
  }, [myList, userId]);

  const messages = useMemo(
    () => Object.values(stored.enabled).sort((a, b) => b.enabledAt.localeCompare(a.enabledAt)).map(buildMessage),
    [stored.enabled]
  );

  const unreadCount = messages.filter((message) => !stored.readIds.includes(message.id)).length;

  const markAllRead = () => {
    const readAt = new Date().toISOString();
    setStored((current) => {
      const next = { ...current, readIds: messages.map((message) => message.id) };
      writeStored(userId, next);
      return next;
    });

    if (userId && messages.length > 0) {
      supabase
        .from("release_notification_settings")
        .update({ read_at: readAt, updated_at: readAt })
        .eq("user_id", userId)
        .in("tmdb_id", messages.map((message) => parseInt(message.item.tmdbId, 10)))
        .then(({ error }) => {
          if (error) console.warn("Notifiche uscite: lettura remota non aggiornata", error.message);
        });
    }
  };

  const disableNotifications = (item: TmdbItem) => {
    window.dispatchEvent(new CustomEvent(TOGGLE_EVENT, { detail: { item, enabled: false } }));
  };

  return {
    enabledKeys: Object.keys(stored.enabled),
    messages,
    unreadCount,
    markAllRead,
    disableNotifications,
  };
}
