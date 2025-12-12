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

export function buildEmbedUrl(tmdbId: string, type: string, season: number, episode: number) {
  return type === "tv"
    ? `https://vixsrc.to/tv/${tmdbId}/${season}/${episode}`
    : `https://vixsrc.to/movie/${tmdbId}`;
}