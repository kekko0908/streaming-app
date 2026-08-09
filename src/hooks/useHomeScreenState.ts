import { useEffect, useMemo, useState } from "react";
import { Session } from "@supabase/supabase-js";
import { SavedItem, TmdbItem } from "../types/types";
import {
  fetchByGenre,
  fetchCommunityTopTitles,
  fetchTrending,
  fetchDetails,
  fetchNowPlaying,
  fetchPopularMovies,
  fetchPopularTV,
  fetchUpcomingFromStore,
  searchTmdb,
} from "../utils/api";
import { getHomeSpotlightSetting } from "../utils/siteSettings";
import { classifyDate } from "../utils/release";
import { buildViewingProfile, getGenreId, GenrePreference, rankPersonalizedItems } from "../utils/recommendations";

type HomeScreenLists = {
  trending: TmdbItem[];
  upcoming: TmdbItem[];
  popular: TmdbItem[];
  monthlyTop: TmdbItem[];
  drama: TmdbItem[];
  action: TmdbItem[];
  adventure: TmdbItem[];
  animation: TmdbItem[];
  horror: TmdbItem[];
  comedy: TmdbItem[];
  thriller: TmdbItem[];
  scienceFiction: TmdbItem[];
  fantasy: TmdbItem[];
  crime: TmdbItem[];
  documentary: TmdbItem[];
  family: TmdbItem[];
  romance: TmdbItem[];
  mystery: TmdbItem[];
  newReleases: TmdbItem[];
  recommendations: TmdbItem[];
  genreProfile: GenrePreference[];
};

const EMPTY_HOME_LISTS: HomeScreenLists = {
  trending: [],
  upcoming: [],
  popular: [],
  monthlyTop: [],
  drama: [],
  action: [],
  adventure: [],
  animation: [],
  horror: [],
  comedy: [],
  thriller: [],
  scienceFiction: [],
  fantasy: [],
  crime: [],
  documentary: [],
  family: [],
  romance: [],
  mystery: [],
  newReleases: [],
  recommendations: [],
  genreProfile: [],
};

export function useHomeScreenState({
  session,
  myList,
  onSearchResultsShown,
}: {
  session: Session | null;
  myList: SavedItem[];
  onSearchResultsShown?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TmdbItem[]>([]);
  const [homeLists, setHomeLists] = useState<HomeScreenLists>(EMPTY_HOME_LISTS);
  const [configuredSpotlight, setConfiguredSpotlight] = useState<TmdbItem | null>(null);
  const [homeSpotlightReady, setHomeSpotlightReady] = useState(false);

  useEffect(() => {
    if (!session) return;

    let isActive = true;

    async function loadCoreData() {
      try {
        const [trending, rawUpcoming, popular, newReleases, communityMonthly] = await Promise.all([
          fetchTrending(),
          fetchUpcomingFromStore("IT"),
          fetchPopularMovies("IT"),
          fetchNowPlaying("IT"),
          fetchCommunityTopTitles(30).catch(() => []),
        ]);

        const realUpcoming = rawUpcoming.filter((item) =>
          item.releaseInfo?.verification === "verified_it" && classifyDate(item.releaseInfo.date) === "upcoming"
        );

        if (!isActive) return;
        const monthlyTop = Array.from(new Map(
          [...communityMonthly, ...popular].map((item) => [`${item.type}:${item.tmdbId}`, item])
        ).values()).slice(0, 10);
        setHomeLists((current) => ({
          ...current,
          trending: trending || [],
          upcoming: realUpcoming || [],
          popular: popular || [],
          monthlyTop,
          newReleases: newReleases || [],
        }));
      } catch (error) {
        console.error(error);
      }
    }

    async function loadGenreRails() {
      try {
        const [drama, action, adventure, animation, horror, comedy, thriller, scienceFiction, fantasy, crime, documentary, family, romance, mystery] = await Promise.all([
          fetchByGenre(18, "movie"),
          fetchByGenre(28, "movie"),
          fetchByGenre(12, "movie"),
          fetchByGenre(16, "movie"),
          fetchByGenre(27, "movie"),
          fetchByGenre(35, "movie"),
          fetchByGenre(53, "movie"),
          fetchByGenre(878, "movie"),
          fetchByGenre(14, "movie"),
          fetchByGenre(80, "movie"),
          fetchByGenre(99, "movie"),
          fetchByGenre(10751, "movie"),
          fetchByGenre(10749, "movie"),
          fetchByGenre(9648, "movie"),
        ]);

        if (!isActive) return;
        setHomeLists((current) => ({
          ...current,
          drama: drama || [],
          action: action || [],
          adventure: adventure || [],
          animation: animation || [],
          horror: horror || [],
          comedy: comedy || [],
          thriller: thriller || [],
          scienceFiction: scienceFiction || [],
          fantasy: fantasy || [],
          crime: crime || [],
          documentary: documentary || [],
          family: family || [],
          romance: romance || [],
          mystery: mystery || [],
        }));
      } catch (error) {
        console.error(error);
      }
    }

    loadCoreData();
    loadGenreRails();
    return () => {
      isActive = false;
    };
  }, [session]);

  const viewingSignature = useMemo(() => myList.map((item) =>
    `${item.type}:${item.tmdbId}:${item.status}:${item.rating}:${item.watchedEpisodes || 0}:${(item.genres || []).join(",")}`
  ).join("|"), [myList]);

  useEffect(() => {
    if (!session) return;
    let isActive = true;

    async function loadRecommendations() {
      const profile = buildViewingProfile(myList);
      const strongestGenres = profile.slice(0, 5);
      try {
        const genreCandidates = strongestGenres.length > 0
          ? await Promise.all(strongestGenres.flatMap((genre) => [
              fetchByGenre(getGenreId(genre, "movie"), "movie"),
              fetchByGenre(getGenreId(genre, "tv"), "tv"),
            ]))
          : [];
        const [popularMovies, popularSeries] = await Promise.all([fetchPopularMovies("IT"), fetchPopularTV()]);
        if (!isActive) return;
        const candidates = [...genreCandidates.flat(), ...popularMovies, ...popularSeries];
        setHomeLists((current) => ({
          ...current,
          genreProfile: profile,
          recommendations: rankPersonalizedItems(candidates, myList, profile, 40),
        }));
      } catch (error) {
        console.error("Errore caricamento consigli personalizzati", error);
      }
    }

    loadRecommendations();
    return () => { isActive = false; };
  }, [session, viewingSignature]);

  useEffect(() => {
    if (!session) {
      setConfiguredSpotlight(null);
      setHomeSpotlightReady(false);
      return;
    }

    let isActive = true;

    async function loadConfiguredSpotlight() {
      setHomeSpotlightReady(false);

      try {
        const setting = await getHomeSpotlightSetting();
        if (!setting) {
          if (isActive) setConfiguredSpotlight(null);
          return;
        }

        const item = await fetchDetails(setting.tmdbId, setting.type);
        if (isActive) setConfiguredSpotlight(item);
      } catch (error) {
        console.error("Errore caricamento titolo selezionato home:", error);
        if (isActive) setConfiguredSpotlight(null);
      } finally {
        if (isActive) setHomeSpotlightReady(true);
      }
    }

    loadConfiguredSpotlight();
    return () => {
      isActive = false;
    };
  }, [session]);

  const runSearch = async () => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    try {
      const [movies, tv] = await Promise.all([searchTmdb(query, "movie"), searchTmdb(query, "tv")]);
      const flat = [...movies, ...tv].sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
      onSearchResultsShown?.();
      setResults(flat);
    } catch (error) {
      console.error(error);
    }
  };

  const clearSearch = () => {
    setResults([]);
    setQuery("");
  };

  const dismissSearchResults = () => {
    setResults([]);
  };

  const spotlightItem = useMemo(
    () => (homeSpotlightReady ? configuredSpotlight || homeLists.popular[0] || homeLists.trending[0] : undefined),
    [configuredSpotlight, homeLists.popular, homeLists.trending, homeSpotlightReady]
  );

  return {
    query,
    setQuery,
    results,
    homeLists,
    homeSpotlightReady,
    spotlightItem,
    runSearch,
    clearSearch,
    dismissSearchResults,
    setConfiguredSpotlight,
  };
}
