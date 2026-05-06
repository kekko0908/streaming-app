import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import { SavedItem, TmdbItem } from "../types/types";
import { fetchDetails, fetchUpcomingReleaseByTmdbId } from "../utils/api";
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
  phase: "released" | "upcoming" | "unknown";
  eventDate?: string;
  unread: boolean;
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

type DebugReleaseNotificationInput = {
  title?: string;
  type?: "movie" | "tv";
  tmdbId?: string;
  releaseDateFull?: string;
  poster?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  airDate?: string;
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
  const currentRelease = current.releaseDateFull || "";
  const freshRelease = fresh.releaseDateFull || "";
  const preferredReleaseDate = freshRelease || currentRelease;

  return {
    ...current,
    ...fresh,
    releaseDateFull: preferredReleaseDate,
    status: current.status,
    progressMinutes: current.progressMinutes,
    progressSeconds: current.progressSeconds,
    currentSeason: current.currentSeason,
    currentEpisode: current.currentEpisode,
    watchedEpisodes: current.watchedEpisodes,
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
    currentSeason: item.currentSeason,
    currentEpisode: item.currentEpisode,
    watchedEpisodes: item.watchedEpisodes,
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
  return formatReleasedAgo(item.releaseDateFull);
}

function getTvMessage(item: TmdbItem) {
  const nextEpisode = item.nextEpisodeToAir;
  if (nextEpisode?.air_date) {
    const episodeLabel = [
      nextEpisode.season_number ? `S${nextEpisode.season_number}` : "",
      nextEpisode.episode_number ? `E${nextEpisode.episode_number}` : "",
    ].filter(Boolean).join(" ");
    const diffDays = getDayDiffFromToday(nextEpisode.air_date);
    if (diffDays !== null && diffDays >= 0) {
      return `${episodeLabel} ${formatReleasedAgo(nextEpisode.air_date).replace("È uscito", "è uscito")}`;
    }
    return `Prossimo episodio ${episodeLabel}: ${formatDate(nextEpisode.air_date)}.`;
  }

  if (item.status === "gia-guardato") return "TMDB non indica ancora una nuova stagione datata.";
  return "TMDB non indica ancora un prossimo episodio datato.";
}

function publishState(enabledKeys: string[]) {
  (window as any).sfaReleaseNotificationKeys = enabledKeys;
  window.dispatchEvent(new CustomEvent(STATE_EVENT, { detail: { enabledKeys } }));
}

function getYesterdayDate() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date.toISOString().slice(0, 10);
}

function getDayDiffFromToday(dateStr: string) {
  const target = new Date(dateStr);
  const today = new Date();
  if (Number.isNaN(target.getTime())) return null;

  target.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return Math.round((today.getTime() - target.getTime()) / (24 * 60 * 60 * 1000));
}

function getDateOnly(dateStr?: string | null) {
  if (!dateStr) return "";
  return dateStr.slice(0, 10);
}

function getTodayDate() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function getReleaseEvent(item: TmdbItem): Pick<ReleaseNotificationMessage, "phase" | "eventDate"> & { token: string } {
  if (item.type === "tv") {
    const episode = item.nextEpisodeToAir;
    const eventDate = getDateOnly(episode?.air_date);
    const episodeToken = [
      episode?.season_number ? `s${episode.season_number}` : "s0",
      episode?.episode_number ? `e${episode.episode_number}` : "e0",
    ].join("");

    if (!eventDate) return { phase: "unknown", token: `tv:${episodeToken}:unknown` };
    const diffDays = getDayDiffFromToday(eventDate);
    const phase = diffDays !== null && diffDays >= 0 ? "released" : "upcoming";
    return { phase, eventDate, token: `tv:${episodeToken}:${phase}:${eventDate}` };
  }

  const eventDate = getDateOnly(item.releaseDateFull);
  if (!eventDate) return { phase: "unknown", token: "movie:unknown" };
  const diffDays = getDayDiffFromToday(eventDate);
  const phase = diffDays !== null && diffDays >= 0 ? "released" : "upcoming";
  return { phase, eventDate, token: `movie:${phase}:${eventDate}` };
}

function getMessageId(record: ReleaseNotificationRecord) {
  return `${record.key}:${getReleaseEvent(record.item).token}`;
}

function getRemoteReadIds(record: ReleaseNotificationRecord, readAt: string | null) {
  if (!readAt) return [];
  const event = getReleaseEvent(record.item);
  const messageId = getMessageId(record);

  if (event.phase !== "released" || !event.eventDate) return [messageId];

  const readDate = getDateOnly(readAt);
  return readDate >= event.eventDate ? [messageId] : [];
}

function buildMessage(record: ReleaseNotificationRecord, readIds: string[] = []): ReleaseNotificationMessage {
  const item = record.item;
  const kind = item.type === "tv" ? "tv" : "movie";
  const event = getReleaseEvent(item);
  const id = getMessageId(record);
  return {
    id,
    item,
    title: item.title,
    message: kind === "movie" ? getMovieMessage(item) : getTvMessage(item),
    meta: kind === "movie" ? "Film monitorato" : "Serie monitorata",
    kind,
    phase: event.phase,
    eventDate: event.eventDate,
    unread: !readIds.includes(id),
  };
}

function isReleasedToday(message: ReleaseNotificationMessage) {
  return message.phase === "released" && message.eventDate === getTodayDate();
}

function shouldAutoDisableReleasedMovie(item: TmdbItem) {
  if (item.type !== "movie") return false;
  if (item.status !== "in-corso" && item.status !== "gia-guardato") return false;
  return getReleaseEvent(item).phase === "released";
}

function hasWatchedReleasedEpisode(item: TmdbItem) {
  if (item.type !== "tv") return false;
  const episode = item.nextEpisodeToAir;
  const event = getReleaseEvent(item);
  if (event.phase !== "released" || !episode?.episode_number) return false;

  if (item.status === "gia-guardato") return true;
  if (item.status !== "in-corso") return false;
  if (!item.currentSeason || !item.currentEpisode) return false;

  const watchedSeason = item.currentSeason;
  const watchedEpisode = item.currentEpisode;
  const releaseSeason = episode.season_number || 1;

  return watchedSeason > releaseSeason || (watchedSeason === releaseSeason && watchedEpisode >= episode.episode_number);
}

function formatReleasedAgo(dateStr: string, noun = "uscito") {
  const diffDays = getDayDiffFromToday(dateStr);
  if (diffDays === null) return "Data di uscita aggiornata.";
  if (diffDays === 0) return `È ${noun} oggi.`;
  if (diffDays === 1) return `È ${noun} ieri.`;
  if (diffDays > 1 && diffDays < 7) return `È ${noun} ${diffDays} giorni fa.`;

  if (diffDays < 30) {
    const weeks = Math.max(1, Math.round(diffDays / 7));
    const label = weeks === 1 ? "una settimana fa" : `${weeks} settimane fa`;
    return `È ${noun} ${label} (${formatDate(dateStr)}).`;
  }

  const months = Math.max(1, Math.round(diffDays / 30));
  const label = months === 1 ? "un mese fa" : `${months} mesi fa`;
  return `È ${noun} ${label} (${formatDate(dateStr)}).`;
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
      const [freshItem, storedUpcoming] = await Promise.all([
        fetchDetails(record.item.tmdbId, record.item.type),
        record.item.type === "movie"
          ? fetchUpcomingReleaseByTmdbId(record.item.tmdbId).catch(() => null)
          : Promise.resolve(null),
      ]);
      updateRecord({
        ...record,
        item: mergeFreshItem(record.item, {
          ...freshItem,
          releaseDateFull: storedUpcoming?.releaseDateFull || freshItem.releaseDateFull,
          poster: storedUpcoming?.poster || freshItem.poster,
          backdrop: storedUpcoming?.backdrop || freshItem.backdrop,
        }),
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
        remoteStored.readIds.push(...getRemoteReadIds(record, row.read_at));
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
          const messageId = getMessageId(record);
          if (localStored.readIds.includes(messageId) || localStored.readIds.includes(record.key)) {
            remoteStored.readIds.push(messageId);
          }
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
      const shouldEnrich = !enrichedKeysRef.current.has(record.key);

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
          next.readIds = current.readIds.filter((id) => id !== key && !id.startsWith(`${key}:`));
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
    const autoDisabledRecords: ReleaseNotificationRecord[] = [];

    setStored((current) => {
      let changed = false;
      const nextEnabled = { ...current.enabled };
      const autoDisabledKeys: string[] = [];

      for (const savedItem of myList) {
        const key = getItemKey(savedItem);
        if (!nextEnabled[key]) continue;
        const savedSnapshot = normalizeSavedItem(savedItem);
        const currentItem = nextEnabled[key].item;
        const mergedItem = {
          ...currentItem,
          ...savedSnapshot,
          releaseDateFull: currentItem.releaseDateFull || savedSnapshot.releaseDateFull,
          nextEpisodeToAir: currentItem.nextEpisodeToAir || savedSnapshot.nextEpisodeToAir,
          overview: savedSnapshot.overview || currentItem.overview,
          backdrop: savedSnapshot.backdrop || currentItem.backdrop,
          poster: savedSnapshot.poster || currentItem.poster,
          year: savedSnapshot.year || currentItem.year,
          currentSeason: savedSnapshot.currentSeason || currentItem.currentSeason,
          currentEpisode: savedSnapshot.currentEpisode || currentItem.currentEpisode,
          watchedEpisodes: savedSnapshot.watchedEpisodes || currentItem.watchedEpisodes,
        };

        if (shouldAutoDisableReleasedMovie(mergedItem) || hasWatchedReleasedEpisode(mergedItem)) {
          autoDisabledRecords.push({
            ...nextEnabled[key],
            item: mergedItem,
          });
          autoDisabledKeys.push(key);
          delete nextEnabled[key];
          changed = true;
          continue;
        }

        nextEnabled[key] = {
          ...nextEnabled[key],
          item: mergedItem,
        };
        changed = true;
      }

      if (!changed) return current;
      const next = {
        ...current,
        enabled: nextEnabled,
        readIds: current.readIds.filter((id) => !autoDisabledKeys.some((key) => id === key || id.startsWith(`${key}:`))),
      };
      writeStored(userId, next);
      publishState(Object.keys(next.enabled));

      if (userId) {
        const syncActions: PromiseLike<unknown>[] = autoDisabledRecords.map((record) =>
          supabase
            .from("release_notification_settings")
            .delete()
            .eq("user_id", userId)
            .eq("tmdb_id", parseInt(record.item.tmdbId, 10))
            .eq("media_type", record.item.type)
        );

        const recordsToUpdate = Object.values(nextEnabled);
        if (recordsToUpdate.length > 0) {
          syncActions.push(
            supabase
              .from("release_notification_settings")
              .upsert(
                recordsToUpdate.map((record) => ({
                  ...buildRemotePayload(userId, record),
                  read_at: current.readIds.includes(getMessageId(record)) ? new Date().toISOString() : null,
                })),
                { onConflict: "user_id,tmdb_id,media_type" }
              )
          );
        }

        Promise.all(syncActions).then((results) => {
          for (const result of results as Array<{ error?: { message: string } | null }>) {
            if (result?.error) console.warn("Notifiche uscite: sincronizzazione snapshot non riuscita", result.error.message);
          }
        });
      }

      return next;
    });
  }, [myList, userId]);

  const messages = useMemo(
    () => Object.values(stored.enabled)
      .map((record) => buildMessage(record, stored.readIds))
      .sort((a, b) => {
        if (a.phase !== b.phase) {
          if (a.phase === "released") return -1;
          if (b.phase === "released") return 1;
        }
        return (b.eventDate || "").localeCompare(a.eventDate || "");
      }),
    [stored.enabled, stored.readIds]
  );

  const unreadMessages = messages.filter((message) => message.unread && isReleasedToday(message));
  const unreadCount = unreadMessages.length;

  const markRead = useCallback((message: ReleaseNotificationMessage) => {
    const readAt = new Date().toISOString();
    setStored((current) => {
      if (current.readIds.includes(message.id)) return current;
      const next = { ...current, readIds: [...current.readIds, message.id] };
      writeStored(userId, next);
      return next;
    });

    if (userId) {
      supabase
        .from("release_notification_settings")
        .update({ read_at: readAt, updated_at: readAt })
        .eq("user_id", userId)
        .eq("tmdb_id", parseInt(message.item.tmdbId, 10))
        .eq("media_type", message.item.type)
        .then(({ error }) => {
          if (error) console.warn("Notifiche uscite: lettura remota non aggiornata", error.message);
        });
    }
  }, [userId]);

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

  useEffect(() => {
    if (!import.meta.env.DEV) return;

    (window as any).sfaDebugAddMockReleaseNotification = (input: DebugReleaseNotificationInput = {}) => {
      const type = input.type || "movie";
      const releaseDate = input.releaseDateFull || input.airDate || getYesterdayDate();
      const item: TmdbItem = {
        tmdbId: input.tmdbId || "999999991",
        type,
        title: input.title || (type === "tv" ? "The Alters" : "Il diavolo veste Prada 2"),
        year: releaseDate.slice(0, 4),
        releaseDateFull: type === "movie" ? releaseDate : "",
        overview: "Notifica mock di test.",
        poster: input.poster || "",
        backdrop: "",
        rating: 0,
        nextEpisodeToAir: type === "tv"
          ? {
              id: 999999991,
              season_number: input.seasonNumber || 1,
              episode_number: input.episodeNumber || 4,
              name: "",
              air_date: releaseDate,
            }
          : null,
      };

      window.dispatchEvent(new CustomEvent(TOGGLE_EVENT, {
        detail: {
          item,
          enabled: true,
        },
      }));

      return item;
    };

    return () => {
      delete (window as any).sfaDebugAddMockReleaseNotification;
    };
  }, []);

  return {
    enabledKeys: Object.keys(stored.enabled),
    messages,
    unreadMessages,
    unreadCount,
    markRead,
    markAllRead,
    disableNotifications,
  };
}
