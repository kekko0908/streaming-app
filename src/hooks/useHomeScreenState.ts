import { useEffect, useMemo, useState } from "react";
import { Session } from "@supabase/supabase-js";
import { TmdbItem } from "../types/types";
import {
  fetchByGenre,
  fetchTrending,
  fetchDetails,
  fetchNowPlaying,
  fetchPopularMovies,
  fetchRecentlyReleasedDigital,
  fetchUpcomingFromStore,
  searchTmdb,
} from "../utils/api";
import { getHomeSpotlightSetting } from "../utils/siteSettings";
import { classifyDate } from "../utils/release";

type HomeScreenLists = {
  trending: TmdbItem[];
  upcoming: TmdbItem[];
  popular: TmdbItem[];
  drama: TmdbItem[];
  action: TmdbItem[];
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
  digitalReleases: TmdbItem[];
};

const EMPTY_HOME_LISTS: HomeScreenLists = {
  trending: [],
  upcoming: [],
  popular: [],
  drama: [],
  action: [],
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
  digitalReleases: [],
};

export function useHomeScreenState({
  session,
  onSearchResultsShown,
}: {
  session: Session | null;
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

    async function loadData() {
      try {
        const [trending, rawUpcoming, popular, newReleases, digitalReleases, drama, action, animation, horror, comedy, thriller, scienceFiction, fantasy, crime, documentary, family, romance, mystery] = await Promise.all([
          fetchTrending(),
          fetchUpcomingFromStore("IT"),
          fetchPopularMovies("IT"),
          fetchNowPlaying("IT"),
          fetchRecentlyReleasedDigital("IT").catch(() => []),
          fetchByGenre(18, "movie"),
          fetchByGenre(28, "movie"),
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

        const realUpcoming = rawUpcoming.filter((item) =>
          item.releaseInfo?.verification === "verified_it" && classifyDate(item.releaseInfo.date) === "upcoming"
        );

        if (!isActive) return;

        setHomeLists({
          trending: trending || [],
          upcoming: realUpcoming || [],
          popular: popular || [],
          drama: drama || [],
          action: action || [],
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
          newReleases: newReleases || [],
          digitalReleases: digitalReleases || [],
        });
      } catch (error) {
        console.error(error);
      }
    }

    loadData();
    return () => {
      isActive = false;
    };
  }, [session]);

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
