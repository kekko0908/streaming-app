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

export function buildEmbedUrl(tmdbId: string, type: string, season: number, episode: number, startAt?: number) {
  const timeParam = startAt ? `?startAt=${Math.floor(startAt)}` : "";
  return type === "tv"
    ? `https://vixsrc.to/tv/${tmdbId}/${season}/${episode}${timeParam}`
    : `https://vixsrc.to/movie/${tmdbId}${timeParam}`;
}
