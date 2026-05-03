import { AnimatePresence, motion } from "framer-motion";
import { Session } from "@supabase/supabase-js";
import { formatDate } from "../../utils/helper";
import { SavedItem, TmdbItem } from "../../types/types";
import Card from "../Card";
import CarouselSection from "../CarouselSection";
import CommunityPulse from "../CommunityPulse";
import CommunityShelf from "../CommunityShelf";
import HomeSpotlight from "../HomeSpotlight";

interface HomeRouteContentProps {
  session: Session | null;
  myList: SavedItem[];
  results: TmdbItem[];
  query: string;
  homeLists: {
    trending: TmdbItem[];
    upcoming: TmdbItem[];
    popular: TmdbItem[];
    drama: TmdbItem[];
    action: TmdbItem[];
    animation: TmdbItem[];
    horror: TmdbItem[];
    newReleases: TmdbItem[];
  };
  spotlightItem?: TmdbItem;
  homeSpotlightReady: boolean;
  getProgress: (tmdbId: string) => { season: number; episode: number; watchedEpisodes?: number; totalEpisodes?: number; progressSeconds?: number; progressMinutes?: number };
  onPlay: (season: number, episode: number, item: TmdbItem) => void;
  onSelectItem: (item: TmdbItem) => void;
  onClearSearch: () => void;
}

function AnimatedCardGrid({ items, onSelect }: { items: TmdbItem[]; onSelect: (item: TmdbItem) => void }) {
  return (
    <motion.div layout className="grid">
      <AnimatePresence mode="popLayout">
        {items.map((item) => (
          <motion.div
            layout
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.3 }}
            key={item.tmdbId}
          >
            <Card item={item} onClick={() => onSelect(item)} />
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  );
}

function SearchResultsView({
  query,
  results,
  onClearSearch,
  onSelectItem,
}: Pick<HomeRouteContentProps, "query" | "results" | "onClearSearch" | "onSelectItem">) {
  return (
    <div className="list-section" style={{ marginTop: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h2>Risultati Ricerca "{query}"</h2>
        <button className="pill ghost" onClick={onClearSearch}>Chiudi ricerca X</button>
      </div>
      <AnimatedCardGrid items={results} onSelect={onSelectItem} />
    </div>
  );
}

function HomeLandingView({
  session,
  myList,
  homeLists,
  spotlightItem,
  homeSpotlightReady,
  getProgress,
  onPlay,
  onSelectItem,
}: Pick<
  HomeRouteContentProps,
  "session" | "myList" | "homeLists" | "spotlightItem" | "homeSpotlightReady" | "getProgress" | "onPlay" | "onSelectItem"
>) {
  return (
    <div style={{ marginTop: "20px" }}>
      {homeSpotlightReady ? (
        <HomeSpotlight
          item={spotlightItem}
          onSelect={onSelectItem}
          onPlay={(item) => onPlay(1, 1, item)}
        />
      ) : (
        <section className="home-spotlight" aria-hidden="true" />
      )}

      <div className="home-content-overlap" style={{ position: "relative", zIndex: 10, marginTop: "-12vh", paddingBottom: "20px" }}>
        {session && <CommunityPulse onItemClick={onSelectItem} />}

        {session && myList.some((item) => item.status === "in-corso") && (
          <CarouselSection
            title="Continua a guardare"
            icon={"\u25B6\uFE0F"}
            items={myList.filter((item) => item.status === "in-corso")}
            onSelect={onSelectItem}
            getProgress={getProgress}
          />
        )}

        {session && <CommunityShelf onSelect={onSelectItem} />}

        <CarouselSection title="I titoli del momento" icon={"\uD83D\uDD25"} items={homeLists.popular} onSelect={onSelectItem} />
        <CarouselSection title="Aggiunti di recente" icon={"\uD83C\uDD95"} items={homeLists.newReleases} onSelect={onSelectItem} />
        <CarouselSection title="Top 10 titoli di oggi" icon={"\uD83D\uDCC8"} items={homeLists.trending.slice(0, 10)} onSelect={onSelectItem} />
        <CarouselSection title="In arrivo" icon={"\uD83D\uDCC5"} items={homeLists.upcoming} onSelect={onSelectItem} isUpcoming={true} formatDate={formatDate} />
        <CarouselSection title="Dramma" icon={"\uD83C\uDFAD"} items={homeLists.drama} onSelect={onSelectItem} />
        <CarouselSection title="Azione e Avventura" icon={"\uD83D\uDCA5"} items={homeLists.action} onSelect={onSelectItem} />
        <CarouselSection title="Animazione" icon={"\u2728"} items={homeLists.animation} onSelect={onSelectItem} />
        <CarouselSection title="Horror" icon={"\uD83D\uDD6F\uFE0F"} items={homeLists.horror} onSelect={onSelectItem} />
      </div>
    </div>
  );
}

export function HomeRouteContent(props: HomeRouteContentProps) {
  if (props.results.length > 0) {
    return <SearchResultsView {...props} />;
  }

  return <HomeLandingView {...props} />;
}
