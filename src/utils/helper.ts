export function formatDate(dateStr?: string) {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function imagePath(path: string | null | undefined, size = "w780") {
  if (path) return `https://image.tmdb.org/t/p/${size}${path}`;
  return "https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=500&q=80";
}

export function getTmdbImageUrl(
  path: string | null | undefined,
  size = "w500",
  fallback = "https://via.placeholder.com/500x750"
) {
  if (!path) return fallback;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

export function pickYear(date?: string) {
  return date && date.length >= 4 ? date.slice(0, 4) : "";
}

export function slugifyTitle(title: string) {
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

export function buildMediaPath(item: Pick<{ tmdbId: string; type: "movie" | "tv"; title: string }, "tmdbId" | "type" | "title">) {
  const basePath = item.type === "tv" ? "/serie-tv" : "/film";
  return `${basePath}/${item.tmdbId}-${slugifyTitle(item.title)}`;
}

export function parseMediaRoute(pathname: string): { type: "movie" | "tv"; tmdbId: string } | null {
  const match = pathname.match(/^\/(film|serie-tv)\/(\d+)(?:-[^/]+)?$/);
  if (!match) return null;

  return {
    type: match[1] === "serie-tv" ? "tv" : "movie",
    tmdbId: match[2],
  };
}

const VIXSRC_BASE_URL = String(import.meta.env.VITE_VIXSRC_BASE_URL || "https://vixsrc.to")
  .replace(/\/+$/, "");

export function buildEmbedUrl(tmdbId: string, type: string, season: number, episode: number, startAt?: number) {
  const path = type === "tv"
    ? `${VIXSRC_BASE_URL}/tv/${tmdbId}/${season}/${episode}`
    : `${VIXSRC_BASE_URL}/movie/${tmdbId}`;
  const params = new URLSearchParams({ lang: "it" });

  if (Number.isFinite(startAt) && Number(startAt) > 0) {
    params.set("startAt", String(Math.floor(Number(startAt))));
  }

  return `${path}?${params.toString()}`;
}
