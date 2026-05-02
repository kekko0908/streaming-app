import { supabase } from "../supabaseClient";
import { MediaType } from "../types/types";

export interface HomeSpotlightSetting {
  tmdbId: string;
  type: MediaType;
}

const HOME_SPOTLIGHT_KEY = "home_spotlight";

function parseHomeSpotlightSetting(value: unknown): HomeSpotlightSetting | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const tmdbId = typeof record.tmdbId === "string" ? record.tmdbId : "";
  const type = record.type === "movie" || record.type === "tv" ? record.type : null;
  if (!tmdbId || !type) return null;
  return { tmdbId, type };
}

export async function getHomeSpotlightSetting(): Promise<HomeSpotlightSetting | null> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", HOME_SPOTLIGHT_KEY)
    .maybeSingle();

  if (error) throw error;
  return parseHomeSpotlightSetting(data?.value);
}

export async function setHomeSpotlightSetting(setting: HomeSpotlightSetting) {
  const { error } = await supabase
    .from("app_settings")
    .upsert(
      {
        key: HOME_SPOTLIGHT_KEY,
        value: setting,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );

  if (error) throw error;
}

export async function clearHomeSpotlightSetting() {
  const { error } = await supabase
    .from("app_settings")
    .delete()
    .eq("key", HOME_SPOTLIGHT_KEY);

  if (error) throw error;
}
