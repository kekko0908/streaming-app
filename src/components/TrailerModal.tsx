import "../css/hero.css";

interface TrailerModalProps {
  ytKey: string;
  onClose: () => void;
}

export default function TrailerModal({ ytKey, onClose }: TrailerModalProps) {
  return (
    <div className="trailer-backdrop" onClick={onClose}>
      <div className="trailer-content" onClick={(e) => e.stopPropagation()}>
        {/* Iframe YouTube */}
        <iframe
          width="100%"
          height="100%"
          src={`https://www.youtube.com/embed/${ytKey}?autoplay=1&rel=0&modestbranding=1`}
          title="Trailer"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        ></iframe>
      </div>
      <button className="trailer-close-btn" onClick={onClose}>Chiudi Trailer ✕</button>
    </div>
  );
}