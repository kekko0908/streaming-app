import { useRef } from "react";
import { Link } from "react-router-dom";
import "../css/carousel.css";
import { TmdbItem } from "../types/types";
import Card from "./Card";

interface CarouselProps {
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  icon?: string;
  items: TmdbItem[];
  onSelect: (item: TmdbItem) => void;
  isUpcoming?: boolean;
  formatDate?: (d?: string) => string;
  getProgress?: (tmdbId: string) => { season: number; episode: number; watchedEpisodes?: number; totalEpisodes?: number; progressSeconds?: number; progressMinutes?: number };
  variant?: "portrait" | "landscape" | "ranked";
}

export default function CarouselSection({ title, description, actionLabel, actionHref, icon, items, onSelect, isUpcoming, formatDate, getProgress, variant = "portrait" }: CarouselProps) {
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
    <section className={`carousel-wrapper carousel-wrapper--${variant}`}>
      <div className="carousel-header">
        <div className="carousel-heading-group">
          {icon && <span className="carousel-icon">{icon}</span>}
          <div>
            <h3 className="carousel-title">{title}</h3>
            {description && <p className="carousel-description">{description}</p>}
          </div>
        </div>
        {actionLabel && actionHref && <Link className="carousel-header-action" to={actionHref}>{actionLabel}</Link>}
      </div>

      <button className="carousel-btn left" onClick={() => scroll("left")}>{"<"}</button>

      <div className={`carousel-track carousel-track--${variant}`} ref={scrollRef}>
        {items.map((item, index) => (
          <div key={`${item.tmdbId}-${index}`} className={`carousel-item carousel-item--${variant}`}>
            <Card 
                item={item} 
                onClick={() => onSelect(item)} 
                isUpcoming={isUpcoming}
                formatDate={formatDate}
                showRating={false}
                progress={item.type === "tv" && getProgress ? getProgress(item.tmdbId) : undefined}
                variant={variant}
                rank={variant === "ranked" ? index + 1 : undefined}
            />
          </div>
        ))}
      </div>

      <button className="carousel-btn right" onClick={() => scroll("right")}>{">"}</button>
    </section>
  );
}
