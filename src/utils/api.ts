import { MediaType, TmdbItem } from "../types/types";
import { imagePath, pickYear } from "./helper";

const TMDB_KEY = "83edc3a80b222e0d88d6325c4a595618";

// --- 1. MAPPA GENERI (TMDB IDs -> Nomi) ---
const GENRES_MAP: Record<number, string> = {
  28: "Azione", 12: "Avventura", 16: "Animazione", 35: "Commedia", 80: "Crime",
  99: "Documentario", 18: "Dramma", 10751: "Famiglia", 14: "Fantasy", 36: "Storia",
  27: "Horror", 10402: "Musica", 9648: "Mistero", 10749: "Romance", 878: "Fantascienza",
  10770: "Film TV", 53: "Thriller", 10752: "Guerra", 37: "Western",
  10759: "Action & Adventure", 10762: "Kids", 10763: "News", 10764: "Reality",
  10765: "Sci-Fi & Fantasy", 10766: "Soap", 10767: "Talk", 10768: "War & Politics"
};

// Mappa i dati grezzi di TMDB nel nostro formato
function mapSearchItem(raw: any, type: MediaType): TmdbItem {
  // Convertiamo gli ID numerici in stringhe leggibili
  const genres = raw.genre_ids?.map((id: number) => GENRES_MAP[id]).filter(Boolean) || [];

  return {
    tmdbId: String(raw.id),
    type,
    title: type === "movie" ? raw.title : raw.name,
    year: pickYear(type === "movie" ? raw.release_date : raw.first_air_date),
    releaseDateFull: type === "movie" ? raw.release_date : raw.first_air_date,
    overview: raw.overview || "Trama non disponibile in italiano.",
    poster: imagePath(raw.poster_path, "w500"),
    backdrop: imagePath(raw.backdrop_path, "original"),
    rating: raw.vote_average ?? 0,
    popularity: raw.popularity ?? 0,
    genres: genres // Generi mappati dagli ID
  };
}

// --- HELPER PER SCARICARE PIU' PAGINE ---
async function fetchMultiplePages(urlBase: string, type: MediaType, maxPages: number = 3): Promise<TmdbItem[]> {
  try {
    const pages = Array.from({ length: maxPages }, (_, i) => i + 1);
    
    const promises = pages.map(page => 
      fetch(`${urlBase}&page=${page}`).then(res => res.json())
    );

    const results = await Promise.all(promises);
    const allItems = results.flatMap(data => data.results || []);
    
    // Rimuovi duplicati
    const uniqueItems = Array.from(new Map(allItems.map((item: any) => [item.id, item])).values());

    return uniqueItems.map((item: any) => mapSearchItem(item, type));
  } catch (e) {
    console.error("Errore fetch multiple pages:", e);
    return [];
  }
}

// --- API EXPORT ---

export async function searchTmdb(query: string, type: MediaType) {
  const res = await fetch(`https://api.themoviedb.org/3/search/${type}?api_key=${TMDB_KEY}&language=it-IT&query=${query}`);
  const data = await res.json();
  return (data.results || []).map((item: any) => mapSearchItem(item, type));
}

export async function fetchDetails(tmdbId: string, type: MediaType): Promise<TmdbItem> {
  const res = await fetch(`https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_KEY}&language=it-IT`);
  const data = await res.json();
  
  // LOGICA DURATA ROBUSTA
  let runtime = "";
  if (type === "movie") {
      runtime = data.runtime ? `${data.runtime} min` : "";
  } else {
      if (data.episode_run_time && data.episode_run_time.length > 0) {
          runtime = `${data.episode_run_time[0]} min`;
      } else if (data.last_episode_to_air && data.last_episode_to_air.runtime) {
          runtime = `${data.last_episode_to_air.runtime} min`;
      } else {
          runtime = "45 min"; 
      }
  }

  // ESTRAZIONE GENERI (Dal dettaglio sono oggetti {id, name})
  const genresList = data.genres?.map((g: any) => g.name) || [];

  // LOGICA COLLEZIONE (SAGHE)
  let collectionData = undefined;
  if (data.belongs_to_collection) {
      try {
          const colRes = await fetch(`https://api.themoviedb.org/3/collection/${data.belongs_to_collection.id}?api_key=${TMDB_KEY}&language=it-IT`);
          const colJson = await colRes.json();
          // Mappiamo e ordiniamo per anno
          const parts = (colJson.parts || [])
            .map((p: any) => mapSearchItem(p, 'movie'))
            .sort((a: TmdbItem, b: TmdbItem) => (a.year || "0").localeCompare(b.year || "0"));

          collectionData = {
              id: colJson.id,
              name: colJson.name,
              parts: parts
          };
      } catch (e) { console.error("Errore collezione", e); }
  }

  return {
    tmdbId: String(data.id),
    type,
    title: type === "movie" ? data.title : data.name,
    year: pickYear(type === "movie" ? data.release_date : data.first_air_date),
    releaseDateFull: type === "movie" ? data.release_date : data.first_air_date,
    overview: data.overview || "Trama non disponibile in italiano.",
    poster: imagePath(data.poster_path, "w780"),
    backdrop: imagePath(data.backdrop_path, "original"),
    rating: data.vote_average ?? 0,
    runtime: runtime,
    genres: genresList,
    seasons: data.number_of_seasons,
    seasonsDetails: data.seasons?.map((s: any) => ({
        season_number: s.season_number,
        episode_count: s.episode_count
    })).filter((s: any) => s.season_number > 0),
    popularity: data.popularity ?? 0,
    collection: collectionData
  };
}

// Raccolte standard
export async function fetchCollection(endpoint: string): Promise<TmdbItem[]> {
  return fetchMultiplePages(
    `https://api.themoviedb.org/3/${endpoint}?api_key=${TMDB_KEY}&language=it-IT`, 
    endpoint.includes('tv') ? 'tv' : 'movie'
  );
}

// Generi
export async function fetchByGenre(genreId: number, type: MediaType = "movie"): Promise<TmdbItem[]> {
  const url = `https://api.themoviedb.org/3/discover/${type}?api_key=${TMDB_KEY}&language=it-IT&sort_by=popularity.desc&with_genres=${genreId}`;
  return fetchMultiplePages(url, type);
}

// Serie Popolari
export async function fetchPopularTV(): Promise<TmdbItem[]> {
  const url = `https://api.themoviedb.org/3/tv/popular?api_key=${TMDB_KEY}&language=it-IT`;
  return fetchMultiplePages(url, "tv");
}

// Raccomandazioni (40 items = 2 pagine)
export async function fetchRecommendations(tmdbId: string, type: MediaType): Promise<TmdbItem[]> {
  const url = `https://api.themoviedb.org/3/${type}/${tmdbId}/recommendations?api_key=${TMDB_KEY}&language=it-IT`;
  return fetchMultiplePages(url, type, 2);
}

// Archivio
export async function discoverContent(
  type: MediaType, 
  sort: string, 
  genre?: string, 
  year?: string, 
  vote?: string,
  page: number = 1
): Promise<TmdbItem[]> {
  
  const params = new URLSearchParams({
    api_key: TMDB_KEY,
    language: "it-IT",
    sort_by: sort,
    include_adult: "false",
    page: page.toString(),
    "vote_count.gte": "50" 
  });

  if (genre) params.append("with_genres", genre);
  if (vote) params.append("vote_average.gte", vote);
  
  if (year) {
    if (type === 'movie') params.append("primary_release_year", year);
    else params.append("first_air_date_year", year);
  }

  const res = await fetch(`https://api.themoviedb.org/3/discover/${type}?${params.toString()}`);
  const data = await res.json();
  return (data.results || []).map((item: any) => mapSearchItem(item, type));
}

// Trailer
export async function fetchTrailer(tmdbId: string, type: MediaType): Promise<string | null> {
  try {
    const res = await fetch(`https://api.themoviedb.org/3/${type}/${tmdbId}/videos?api_key=${TMDB_KEY}&language=it-IT`);
    const data = await res.json();
    let trailer = data.results?.find((vid: any) => vid.site === "YouTube" && vid.type === "Trailer");
    
    if (!trailer) {
        const resEn = await fetch(`https://api.themoviedb.org/3/${type}/${tmdbId}/videos?api_key=${TMDB_KEY}&language=en-US`);
        const dataEn = await resEn.json();
        trailer = dataEn.results?.find((vid: any) => vid.site === "YouTube" && vid.type === "Trailer");
    }
    return trailer ? trailer.key : null;
  } catch (e) { return null; }
}

// Cast
export interface CastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
}

export async function fetchCredits(tmdbId: string, type: MediaType): Promise<CastMember[]> {
  try {
    const res = await fetch(`https://api.themoviedb.org/3/${type}/${tmdbId}/credits?api_key=${TMDB_KEY}&language=it-IT`);
    const data = await res.json();
    return (data.cast || []).slice(0, 10).map((actor: any) => ({
      id: actor.id,
      name: actor.name,
      character: actor.character,
      profile_path: actor.profile_path ? `https://image.tmdb.org/t/p/w185${actor.profile_path}` : null
    }));
  } catch (e) { return []; }
}