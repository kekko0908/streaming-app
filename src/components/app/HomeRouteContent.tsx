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
    <div className="cinematic-home">
      {homeSpotlightReady ? (
        <HomeSpotlight
          item={spotlightItem}
          onSelect={onSelectItem}
          onPlay={(item) => onPlay(1, 1, item)}
        />
      ) : (
        <section className="home-spotlight" aria-hidden="true" />
      )}

      <div className="home-content-overlap">
        {session && <CommunityPulse onItemClick={onSelectItem} />}

        {session && myList.some((item) => item.status === "in-corso") && (
          <CarouselSection
            title="Continua a guardare"
            icon={"\u25B6\uFE0F"}
            items={myList.filter((item) => item.status === "in-corso")}
            onSelect={onSelectItem}
            getProgress={getProgress}
            variant="landscape"
          />
        )}

        <CarouselSection
          title="Nuove uscite digitali"
          description="Film pubblicati per acquisto, noleggio o streaming digitale in Italia. Data verificata su TMDB."
          items={homeLists.digitalReleases}
          onSelect={onSelectItem}
        />
        <CarouselSection title="Da guardare" items={myList.filter((item) => item.status === "da-guardare")} onSelect={onSelectItem} />
        <CarouselSection title="La mia lista" items={myList} onSelect={onSelectItem} />
        <CarouselSection title="Scelti per te" items={homeLists.popular} onSelect={onSelectItem} />
        <CarouselSection title="Top 10 oggi" items={homeLists.trending.slice(0, 10)} onSelect={onSelectItem} variant="ranked" />
        {session && <CommunityShelf onSelect={onSelectItem} />}
        <CarouselSection title="Aggiunti di recente" items={homeLists.newReleases} onSelect={onSelectItem} />
        <CarouselSection title="In arrivo" icon={"\uD83D\uDCC5"} items={homeLists.upcoming} onSelect={onSelectItem} isUpcoming={true} formatDate={formatDate} />
        <CarouselSection title="Dramma" icon={"\uD83C\uDFAD"} items={homeLists.drama} onSelect={onSelectItem} />
        <CarouselSection title="Azione e avventura" items={homeLists.action} onSelect={onSelectItem} />
        <CarouselSection title="Animazione" icon={"\u2728"} items={homeLists.animation} onSelect={onSelectItem} />
        <CarouselSection title="Horror" icon={"\uD83D\uDD6F\uFE0F"} items={homeLists.horror} onSelect={onSelectItem} />
        <div className="home-genre-divider">
          <span>Esplora senza limiti</span>
          <h2>Un genere per ogni serata</h2>
        </div>
        <CarouselSection title="Commedie" items={homeLists.comedy} onSelect={onSelectItem} />
        <CarouselSection title="Thriller" items={homeLists.thriller} onSelect={onSelectItem} />
        <CarouselSection title="Fantascienza" items={homeLists.scienceFiction} onSelect={onSelectItem} />
        <CarouselSection title="Fantasy" items={homeLists.fantasy} onSelect={onSelectItem} />
        <CarouselSection title="Crime" items={homeLists.crime} onSelect={onSelectItem} />
        <CarouselSection title="Documentari" items={homeLists.documentary} onSelect={onSelectItem} />
        <CarouselSection title="Per tutta la famiglia" items={homeLists.family} onSelect={onSelectItem} />
        <CarouselSection title="Romance" items={homeLists.romance} onSelect={onSelectItem} />
        <CarouselSection title="Mistero" items={homeLists.mystery} onSelect={onSelectItem} />
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
