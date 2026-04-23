import { useEffect, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import { CommunitySortMode, MediaType, TmdbItem } from "../types/types";
import Card, { SkeletonCard } from "./Card";
import "../css/carousel.css";
import "../css/communityShelf.css";

interface CommunityRow {
  tmdb_id: number;
  title: string;
  media_type: MediaType;
  poster_path: string;
  listed_count: number;
  watched_count: number;
  completed_count: number;
  rated_count: number;
  community_rating: number;
  community_score: number;
}

interface CommunityShelfProps {
  onSelect: (item: TmdbItem) => void;
}

function mapCommunityItem(row: CommunityRow, mode: CommunitySortMode): TmdbItem {
  return {
    tmdbId: String(row.tmdb_id),
    type: row.media_type,
    title: row.title,
    year: "",
    overview: "",
    poster: row.poster_path || "",
    backdrop: "",
    rating: 0,
    communityListed: Number(row.listed_count) || 0,
    communityWatched: Number(row.watched_count) || 0,
    communityCompleted: Number(row.completed_count) || 0,
    communityRatingsCount: Number(row.rated_count) || 0,
    communityRating: Number(row.community_rating) || 0,
    communityScore: Number(row.community_score) || 0,
    communitySortMode: mode,
  };
}

export default function CommunityShelf({ onSelect }: CommunityShelfProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<CommunitySortMode>("watched");
  const [items, setItems] = useState<TmdbItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadCommunityTitles() {
      setLoading(true);
      setErrorMessage("");

      const { data, error } = await supabase.rpc("get_community_titles", { sort_mode: mode });

      if (!isMounted) return;

      if (error) {
        console.error("Errore community shelf:", error);
        setItems([]);
        setErrorMessage(
          "La sezione community non e disponibile. Probabilmente manca la migration get_community_titles su Supabase."
        );
        setLoading(false);
        return;
      }

      const nextItems = Array.isArray(data)
        ? data.map((row) => mapCommunityItem(row as CommunityRow, mode))
        : [];

      setItems(nextItems);
      if (nextItems.length === 0) {
        setErrorMessage("Ancora nessun dato community disponibile per questa sezione.");
      }
      setLoading(false);
    }

    loadCommunityTitles();

    return () => {
      isMounted = false;
    };
  }, [mode]);

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;

    const scrollAmount = window.innerWidth > 768 ? 800 : window.innerWidth - 50;
    const targetScroll = direction === "left"
      ? scrollRef.current.scrollLeft - scrollAmount
      : scrollRef.current.scrollLeft + scrollAmount;

    scrollRef.current.scrollTo({ left: targetScroll, behavior: "smooth" });
  };

  return (
    <section className="carousel-wrapper community-shelf">
      <div className="carousel-header community-shelf-header">
        <div className="community-shelf-title-wrap">
          <span className="carousel-icon">👥</span>
          <div>
            <h3 className="carousel-title">Visti dalla community</h3>
            <p className="community-shelf-subtitle">
              La libreria condivisa di SFA, ordinata per visioni reali o amore della community.
            </p>
          </div>
        </div>

        <div className="community-toggle" role="tablist" aria-label="Ordinamento community">
          <button
            type="button"
            className={`community-toggle-btn ${mode === "watched" ? "active" : ""}`}
            onClick={() => setMode("watched")}
          >
            Piu visti
          </button>
          <button
            type="button"
            className={`community-toggle-btn ${mode === "loved" ? "active" : ""}`}
            onClick={() => setMode("loved")}
          >
            Piu amati
          </button>
        </div>
      </div>

      {(loading || items.length > 0) && (
        <>
          <button className="carousel-btn left" onClick={() => scroll("left")} aria-label="Scorri a sinistra">
            ❮
          </button>

          <div className="carousel-track" ref={scrollRef}>
            {loading
              ? Array.from({ length: 6 }, (_, index) => (
                  <div key={`community-skeleton-${index}`} className="carousel-item">
                    <SkeletonCard />
                  </div>
                ))
              : items.map((item, index) => (
                  <div key={`${item.tmdbId}-${index}`} className="carousel-item">
                    <Card item={item} onClick={() => onSelect(item)} showRating={false} />
                  </div>
                ))}
          </div>

          <button className="carousel-btn right" onClick={() => scroll("right")} aria-label="Scorri a destra">
            ❯
          </button>
        </>
      )}

      {!loading && items.length === 0 && (
        <div className="community-empty-state">{errorMessage}</div>
      )}
    </section>
  );
}
