import { TmdbItem } from "../../types/types";

export function CollectionStrip({
  parts,
  onSelect,
}: {
  parts: TmdbItem[];
  onSelect?: (item: TmdbItem) => void;
}) {
  return (
    <div className="collection-container">
      <div className="collection-scroll">
        {parts.map((part) => (
          <div key={part.tmdbId} className="collection-item" onClick={() => onSelect?.(part)}>
            <img src={part.poster} alt={part.title} className="collection-poster" loading="lazy" decoding="async" />
            <div className="collection-year">{part.year}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
