import "../css/card.css"; // Usa gli stili marquee definiti qui
import { TmdbItem } from "../types/types";
import { formatDate } from "../utils/helper";

interface MarqueeProps {
  title: string;
  items: TmdbItem[];
  onSelect: (item: TmdbItem) => void;
  isUpcoming?: boolean;
}

export default function MarqueeSection({ title, items, onSelect, isUpcoming }: MarqueeProps) {
  if (!items || items.length === 0) return null;

  return (
    <div className="marquee-section">
      <h3 className="marquee-title">{title}</h3>
      <div className="marquee-container">
        {/* Doppio loop per effetto infinito fluido */}
        {[0, 1].map((i) => (
          <div key={i} className="marquee-content">
            {items.map((item, idx) => (
              <div 
                key={`${item.tmdbId}-${idx}-${i}`} 
                className="marquee-card"
                onClick={() => onSelect(item)}
              >
                <img src={item.poster} alt={item.title} loading="lazy" />
                
                {/* Badge Data Uscita (Solo se Upcoming) */}
                {isUpcoming && item.releaseDateFull && (
                  <div className="upcoming-date">{formatDate(item.releaseDateFull)}</div>
                )}

                <div className="card-hover-overlay">
                  <div className="card-title-hover">{item.title}</div>
                  <button className="watch-btn">▶ Scheda</button>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}