import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import { SavedItem, TmdbItem } from "../types/types";
import { fetchDetails, fetchReleaseInfo } from "../utils/api";
import { formatDate } from "../utils/helper";
import { classifyDate } from "../utils/release";

export type ReleaseNotificationMessage = {
  id: string;
  eventKey: string;
  item: TmdbItem;
  title: string;
  message: string;
  meta: string;
  kind: "movie" | "tv";
  phase: "released" | "upcoming" | "unknown";
  eventDate?: string;
  unread: boolean;
};

type Setting = { key: string; item: TmdbItem; enabledAt: string };
type SettingsRow = {
  tmdb_id: number; media_type: "movie" | "tv"; item_snapshot: TmdbItem; enabled_at: string;
};
type EventRow = {
  tmdb_id: number; media_type: "movie" | "tv"; event_key: string;
  event_kind: "date_changed" | "released"; event_date: string | null; title: string;
  item_snapshot: TmdbItem; previous_snapshot: TmdbItem | null; created_at: string; read_at: string | null;
};
type ToggleEvent = CustomEvent<{ item: TmdbItem; enabled?: boolean }>;

const STORAGE_PREFIX = "sfa_release_notifications_v2";
const STATE_EVENT = "release_notification_state_changed";
const TOGGLE_EVENT = "toggle_release_notifications";

function itemKey(item: Pick<TmdbItem, "type" | "tmdbId">) {
  return `${item.type}:${item.tmdbId}`;
}

function publishState(settings: Setting[]) {
  const enabledKeys = settings.map((setting) => setting.key);
  (window as any).sfaReleaseNotificationKeys = enabledKeys;
  window.dispatchEvent(new CustomEvent(STATE_EVENT, { detail: { enabledKeys } }));
}

function writeCache(userId: string, settings: Setting[], events: EventRow[]) {
  localStorage.setItem(`${STORAGE_PREFIX}:${userId}`, JSON.stringify({ settings, events }));
}

function readCache(userId: string) {
  try {
    const parsed = JSON.parse(localStorage.getItem(`${STORAGE_PREFIX}:${userId}`) || "{}");
    return {
      settings: Array.isArray(parsed.settings) ? parsed.settings as Setting[] : [],
      events: Array.isArray(parsed.events) ? parsed.events as EventRow[] : [],
    };
  } catch {
    return { settings: [] as Setting[], events: [] as EventRow[] };
  }
}

function settingFromRow(row: SettingsRow): Setting {
  const item = { ...row.item_snapshot, tmdbId: String(row.tmdb_id), type: row.media_type };
  return { key: itemKey(item), item, enabledAt: row.enabled_at };
}

function eventIdentity(item: TmdbItem) {
  if (item.type === "movie") return "movie";
  const episode = item.nextEpisodeToAir;
  return episode ? `s${episode.season_number || 1}e${episode.episode_number || 0}` : "episode-unknown";
}

function eventDate(item: TmdbItem) {
  return item.type === "movie" ? item.releaseInfo?.date : item.nextEpisodeToAir?.air_date;
}

function eventPayload(userId: string, setting: Setting, eventKind: "date_changed" | "released", fresh: TmdbItem, previous?: TmdbItem) {
  const date = eventDate(fresh);
  const identity = eventIdentity(fresh);
  const previousDate = eventDate(previous || setting.item);
  const eventKey = eventKind === "date_changed"
    ? `date_changed:${identity}:${previousDate || "unknown"}:${date || "unknown"}`
    : `released:${identity}:${date}`;
  return {
    user_id: userId,
    tmdb_id: Number(fresh.tmdbId),
    media_type: fresh.type,
    event_key: eventKey,
    event_kind: eventKind,
    event_date: date || null,
    title: fresh.title,
    item_snapshot: fresh,
    previous_snapshot: previous || setting.item,
  };
}

function messageFromRow(row: EventRow): ReleaseNotificationMessage {
  const item = { ...row.item_snapshot, tmdbId: String(row.tmdb_id), type: row.media_type };
  const oldDate = eventDate(row.previous_snapshot || item);
  const newDate = row.event_date || eventDate(item);
  const isMovie = row.media_type === "movie";
  const meta = isMovie ? "Uscita digitale Italia" : "Messa in onda originale";
  const message = row.event_kind === "date_changed"
    ? `Data aggiornata: ${oldDate ? formatDate(oldDate) : "non definita"} → ${newDate ? formatDate(newDate) : "non definita"}.`
    : isMovie
      ? `L'uscita digitale italiana è prevista per ${formatDate(newDate || "")}.`
      : `${eventIdentity(item).toUpperCase()} è andato in onda il ${formatDate(newDate || "")}.`;
  return {
    id: `${row.media_type}:${row.tmdb_id}:${row.event_key}`,
    eventKey: row.event_key,
    item,
    title: row.title,
    message,
    meta,
    kind: row.media_type,
    phase: row.event_kind === "released" ? "released" : classifyDate(newDate),
    eventDate: newDate || undefined,
    unread: !row.read_at,
  };
}

export function useReleaseNotifications(userId: string | undefined, myList: SavedItem[]) {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const syncingRef = useRef(false);
  const settingsRef = useRef<Setting[]>([]);
  settingsRef.current = settings;

  const loadRemote = useCallback(async () => {
    if (!userId) {
      setSettings([]);
      setEvents([]);
      publishState([]);
      return;
    }
    const cached = readCache(userId);
    setSettings(cached.settings);
    setEvents(cached.events);
    publishState(cached.settings);

    const [settingsResult, eventsResult] = await Promise.all([
      supabase.from("release_notification_settings")
        .select("tmdb_id, media_type, item_snapshot, enabled_at")
        .eq("user_id", userId).order("enabled_at", { ascending: false }),
      supabase.from("release_notification_events")
        .select("tmdb_id, media_type, event_key, event_kind, event_date, title, item_snapshot, previous_snapshot, created_at, read_at")
        .eq("user_id", userId).order("created_at", { ascending: false }).limit(100),
    ]);
    if (settingsResult.error || eventsResult.error) {
      console.warn("Notifiche uscite: cache offline attiva", settingsResult.error?.message || eventsResult.error?.message);
      return;
    }
    const nextSettings = ((settingsResult.data || []) as SettingsRow[]).map(settingFromRow);
    const nextEvents = (eventsResult.data || []) as EventRow[];
    settingsRef.current = nextSettings;
    setSettings(nextSettings);
    setEvents(nextEvents);
    publishState(nextSettings);
    writeCache(userId, nextSettings, nextEvents);
  }, [userId]);

  const reconcile = useCallback(async () => {
    if (!userId || syncingRef.current || settingsRef.current.length === 0) return;
    syncingRef.current = true;
    try {
      for (const setting of settingsRef.current) {
        const previous = setting.item;
        const freshDetails = await fetchDetails(previous.tmdbId, previous.type, true).catch(() => null);
        if (!freshDetails) continue;
        const fresh = previous.type === "movie"
          ? { ...freshDetails, releaseInfo: await fetchReleaseInfo(previous.tmdbId, "IT", true).catch(() => ({
              region: "IT", kind: "unknown", verification: "unknown", phase: "unknown", checkedAt: new Date().toISOString(),
            } as const)) }
          : freshDetails;

        const candidates: ReturnType<typeof eventPayload>[] = [];
        const previousDate = eventDate(previous);
        const freshDate = eventDate(fresh);
        if (previousDate && classifyDate(previousDate) === "released") {
          candidates.push(eventPayload(userId, setting, "released", previous, previous));
        }
        if (freshDate && classifyDate(freshDate) === "released") {
          candidates.push(eventPayload(userId, setting, "released", fresh, previous));
        }
        if (previousDate && freshDate && previousDate !== freshDate && eventIdentity(previous) === eventIdentity(fresh)) {
          candidates.push(eventPayload(userId, setting, "date_changed", fresh, previous));
        }

        if (candidates.length) {
          const { error } = await supabase.from("release_notification_events").upsert(candidates, {
            onConflict: "user_id,tmdb_id,media_type,event_key", ignoreDuplicates: true,
          });
          if (error) console.warn("Notifiche uscite: evento non salvato", error.message);
        }
        await supabase.from("release_notification_settings").update({
          item_snapshot: fresh, updated_at: new Date().toISOString(),
        }).eq("user_id", userId).eq("tmdb_id", Number(fresh.tmdbId)).eq("media_type", fresh.type);
      }
      await loadRemote();
    } finally {
      syncingRef.current = false;
    }
  }, [loadRemote, userId]);

  useEffect(() => { void loadRemote(); }, [loadRemote]);

  useEffect(() => {
    if (!userId) return;
    const timer = window.setTimeout(() => void reconcile(), 250);
    const onFocus = () => void reconcile();
    const onVisibility = () => { if (!document.hidden) void reconcile(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    const now = new Date();
    const midnightDelay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime() + 250;
    const midnight = window.setTimeout(() => void reconcile(), midnightDelay);
    return () => {
      window.clearTimeout(timer); window.clearTimeout(midnight);
      window.removeEventListener("focus", onFocus); document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [reconcile, userId]);

  useEffect(() => {
    const handleToggle = async (rawEvent: Event) => {
      if (!userId) return;
      const { item, enabled } = (rawEvent as ToggleEvent).detail;
      if (!item?.tmdbId || !/^\d+$/.test(item.tmdbId)) return;
      const key = itemKey(item);
      const shouldEnable = enabled ?? !settingsRef.current.some((setting) => setting.key === key);
      if (shouldEnable) {
        const saved = myList.find((entry) => entry.tmdbId === item.tmdbId && entry.type === item.type);
        const snapshot = saved ? { ...item, ...saved } : item;
        await supabase.from("release_notification_settings").upsert({
          user_id: userId, tmdb_id: Number(item.tmdbId), media_type: item.type,
          item_snapshot: snapshot, enabled_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        }, { onConflict: "user_id,tmdb_id,media_type" });
      } else {
        await supabase.from("release_notification_settings").delete()
          .eq("user_id", userId).eq("tmdb_id", Number(item.tmdbId)).eq("media_type", item.type);
      }
      await loadRemote();
      if (shouldEnable) await reconcile();
    };
    window.addEventListener(TOGGLE_EVENT, handleToggle);
    return () => window.removeEventListener(TOGGLE_EVENT, handleToggle);
  }, [loadRemote, myList, reconcile, userId]);

  const messages = useMemo(() => events.map(messageFromRow), [events]);
  const unreadMessages = useMemo(() => messages.filter((message) => message.unread), [messages]);

  const markRead = useCallback(async (message: ReleaseNotificationMessage) => {
    if (!userId) return;
    const readAt = new Date().toISOString();
    const { error } = await supabase.from("release_notification_events").update({ read_at: readAt })
      .eq("user_id", userId).eq("tmdb_id", Number(message.item.tmdbId))
      .eq("media_type", message.item.type).eq("event_key", message.eventKey);
    if (!error) await loadRemote();
  }, [loadRemote, userId]);

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    await supabase.from("release_notification_events").update({ read_at: new Date().toISOString() })
      .eq("user_id", userId).is("read_at", null);
    await loadRemote();
  }, [loadRemote, userId]);

  const disableNotifications = useCallback((item: TmdbItem) => {
    window.dispatchEvent(new CustomEvent(TOGGLE_EVENT, { detail: { item, enabled: false } }));
  }, []);

  return {
    enabledKeys: settings.map((setting) => setting.key), messages, unreadMessages,
    unreadCount: unreadMessages.length, markRead, markAllRead, disableNotifications,
  };
}
