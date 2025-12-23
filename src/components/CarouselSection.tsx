import { useRef } from "react";
import "../css/carousel.css";
import { TmdbItem } from "../types/types";
import Card from "./Card";

interface CarouselProps {
  title: string;
  icon?: string;
  items: TmdbItem[];
  onSelect: (item: TmdbItem) => void;
  isUpcoming?: boolean;
  getProgress?: (tmdbId: string) => { season: number; episode: number };
}

export default function CarouselSection({ title, icon, items, onSelect, isUpcoming, getProgress }: CarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  if (!items || items.length === 0) return null;

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const { current } = scrollRef;
      
      // Calcola una distanza di scroll dinamica (metà schermo o 800px)
      // Questo rende il movimento più naturale su schermi diversi
      const scrollAmount = window.innerWidth > 768 ? 800 : window.innerWidth - 50;

      const targetScroll = direction === "left" 
        ? current.scrollLeft - scrollAmount 
        : current.scrollLeft + scrollAmount;

      // USIAMO scrollTo CON BEHAVIOR SMOOTH
      current.scrollTo({
        left: targetScroll,
        behavior: "smooth"
      });
    }
  };

  return (
    <div className="carousel-wrapper">
      <div className="carousel-header">
        {icon && <span className="carousel-icon">{icon}</span>}
        <h3 className="carousel-title">{title}</h3>
      </div>

      <button className="carousel-btn left" onClick={() => scroll("left")}>❮</button>

      <div className="carousel-track" ref={scrollRef}>
        {items.map((item, index) => (
          <div key={`${item.tmdbId}-${index}`} className="carousel-item">
            <Card 
                item={item} 
                onClick={() => onSelect(item)} 
                isUpcoming={isUpcoming}
                showRating={false}
                progress={item.type === "tv" && getProgress ? getProgress(item.tmdbId) : undefined}
            />
          </div>
        ))}
      </div>

      <button className="carousel-btn right" onClick={() => scroll("right")}>❯</button>
    </div>
  );
}
