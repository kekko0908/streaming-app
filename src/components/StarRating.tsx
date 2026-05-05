import { useState, useEffect } from "react";
import "../css/hero.css";
import { Icon } from "./ui/Icon";

interface StarRatingProps {
  initialRating: number;
  onRate: (rating: number) => void;
}

export default function StarRating({ initialRating, onRate }: StarRatingProps) {
  const [rating, setRating] = useState(initialRating);
  const [hover, setHover] = useState(0);
  const [showAnimation, setShowAnimation] = useState(false);

  useEffect(() => {
    setRating(initialRating);
  }, [initialRating]);

  const handleRate = (starValue: number) => {
    setRating(starValue);
    onRate(starValue);

    if (starValue === 10) {
      setShowAnimation(true);
      setTimeout(() => setShowAnimation(false), 1500);
    }
  };

  const handleRemoveRating = () => {
    setRating(0);
    onRate(0);
  };

  return (
    <div className="star-rating-container">
      {showAnimation && (
        <>
          <div className="crown-glow" />
          <div className="crown-pop">
            <Icon name="crown" size={26} />
            <span>CAPOLAVORO!</span>
          </div>
        </>
      )}

      <div className="rating-content-group">
        <span className="rating-label-text">Vota</span>

        <div className="stars-wrapper">
          {Array.from({ length: 10 }).map((_, index) => {
            const starValue = index + 1;
            const isActive = starValue <= (hover || rating);

            return (
              <button
                key={starValue}
                type="button"
                className="star-btn"
                style={{ transform: starValue <= hover ? "scale(1.16)" : "scale(1)" }}
                onClick={() => handleRate(starValue)}
                onMouseEnter={() => setHover(starValue)}
                onMouseLeave={() => setHover(0)}
                aria-label={`Vota ${starValue} su 10`}
              >
                <Icon name="star" size={14} className={isActive ? "star-icon active" : "star-icon"} />
              </button>
            );
          })}
        </div>

        <span className="rating-score">
          <strong>{hover || rating || 0}</strong>
          <small>/10</small>
        </span>
      </div>

      {rating > 0 && (
        <>
          <div className="rating-separator" />
          <button className="remove-rating-btn" onClick={handleRemoveRating} title="Rimuovi il tuo voto">
            Rimuovi
          </button>
        </>
      )}
    </div>
  );
}
