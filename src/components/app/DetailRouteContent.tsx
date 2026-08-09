import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { CastMember, fetchCredits, fetchDetails, fetchPersonCredits, fetchRecommendations } from "../../utils/api";
import { parseMediaRoute } from "../../utils/helper";
import { SavedItem, TmdbItem } from "../../types/types";
import Card from "../Card";
import CastList from "../CastList";
import Hero from "../Hero";

interface DetailRouteContentProps {
  selected: TmdbItem | null;
  myList: SavedItem[];
  isUILocked: boolean;
  getProgress: (tmdbId: string) => { season: number; episode: number; watchedEpisodes?: number; totalEpisodes?: number; progressSeconds?: number; progressMinutes?: number };
  onPlay: (season: number, episode: number, item: TmdbItem) => void;
  onAddToList: (item: TmdbItem, status: unknown) => void;
  onRate: (item: TmdbItem, rating: number) => void;
  onRemoveSelectedFromList: () => void;
  onSelectItem: (item: TmdbItem) => void;
  onCloseSelected: () => void;
  onSelectCollectionItem: (item: TmdbItem) => void;
  onToggleUILock: () => void;
  onSelectedChange: (item: TmdbItem | null) => void;
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

export function DetailRouteContent({
  selected,
  myList,
  isUILocked,
  getProgress,
  onPlay,
  onAddToList,
  onRate,
  onRemoveSelectedFromList,
  onSelectItem,
  onCloseSelected,
  onSelectCollectionItem,
  onToggleUILock,
  onSelectedChange,
}: DetailRouteContentProps) {
  const location = useLocation();
  const [related, setRelated] = useState<TmdbItem[]>([]);
  const [cast, setCast] = useState<CastMember[]>([]);
  const [selectedActor, setSelectedActor] = useState<CastMember | null>(null);
  const [actorCredits, setActorCredits] = useState<TmdbItem[]>([]);

  useEffect(() => {
    const routeInfo = parseMediaRoute(location.pathname);

    if (!routeInfo) {
      onSelectedChange(null);
      setRelated([]);
      setCast([]);
      setSelectedActor(null);
      setActorCredits([]);
      return;
    }
    const currentRoute = routeInfo;

    let isActive = true;

    async function loadDetailFromRoute() {
      try {
        const fullItem = await fetchDetails(currentRoute.tmdbId, currentRoute.type);
        const [recsResult, castResult] = await Promise.allSettled([
          fetchRecommendations(currentRoute.tmdbId, currentRoute.type),
          fetchCredits(currentRoute.tmdbId, currentRoute.type),
        ]);

        if (!isActive) return;

        onSelectedChange(fullItem);
        setRelated(recsResult.status === "fulfilled" ? recsResult.value : []);
        setCast(castResult.status === "fulfilled" ? castResult.value : []);
        setSelectedActor(null);
        setActorCredits([]);
      } catch (error) {
        console.error("Errore caricamento dettaglio da route:", error);
        if (!isActive) return;
        onSelectedChange(null);
        setRelated([]);
        setCast([]);
        setSelectedActor(null);
        setActorCredits([]);
      }
    }

    if (selected?.tmdbId !== routeInfo.tmdbId || selected.type !== routeInfo.type) {
      onSelectedChange(null);
      setRelated([]);
      setCast([]);
    }

    loadDetailFromRoute();

    return () => {
      isActive = false;
    };
  }, [location.pathname]);

  const handleActorSelect = async (actor: CastMember) => {
    setSelectedActor(actor);
    try {
      const credits = await fetchPersonCredits(actor.id);
      setActorCredits(credits.filter((credit) => credit.type === "movie"));
    } catch (error) {
      console.error(error);
      setActorCredits([]);
    }
  };

  if (!selected) {
    return <section className="hero" aria-busy="true" />;
  }

  return (
    <>
      <Hero
        item={selected}
        myList={myList}
        progress={getProgress(selected.tmdbId)}
        onPlay={(season, episode) => onPlay(season, episode, selected)}
        onAddToList={(status) => onAddToList(selected, status)}
        onRate={(rating) => onRate(selected, rating)}
        onRemoveFromList={onRemoveSelectedFromList}
        onClose={onCloseSelected}
        onSelectCollectionItem={onSelectCollectionItem}
        isUILocked={isUILocked}
        toggleUILock={onToggleUILock}
      />
      <CastList cast={cast} onActorSelect={handleActorSelect} />
      {selectedActor && (
        <div className="list-section" style={{ marginTop: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <h2>Film con {selectedActor.name}</h2>
            <button className="pill ghost" onClick={() => { setSelectedActor(null); setActorCredits([]); }}>Chiudi</button>
          </div>
          {actorCredits.length > 0 ? (
            <AnimatedCardGrid items={actorCredits} onSelect={onSelectItem} />
          ) : (
            <p style={{ color: "#888" }}>Nessun film trovato.</p>
          )}
        </div>
      )}
      {related.length > 0 && (
        <div className="list-section" style={{ marginTop: "20px" }}>
          <div className="carousel-header" style={{ marginBottom: "20px", paddingLeft: "0" }}>
            <span className="carousel-icon">{"\uD83D\uDCA1"}</span>
            <h3 className="carousel-title">Perche hai scelto "{selected.title}"</h3>
          </div>
          <AnimatedCardGrid items={related} onSelect={onSelectItem} />
        </div>
      )}
    </>
  );
}
