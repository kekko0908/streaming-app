import { useState, useEffect } from "react";
import "../css/hero.css"; // Assicurati che il CSS nuovo sia qui

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

    // Se il voto è 10, attiva l'animazione!
    if (starValue === 10) {
        setShowAnimation(true);
        setTimeout(() => setShowAnimation(false), 1500);
    }
  };

  return (
    <div className="star-rating-container">
      {/* ANIMAZIONE CORONA (Appare solo se showAnimation è true) */}
      {showAnimation && (
          <>
            <div className="crown-glow" />
            <div className="crown-pop">
              👑 
              <span style={{
                fontSize:'0.8rem', 
                display:'block', 
                textAlign:'center', 
                fontWeight:'bold', 
                color:'#FFD700', 
                textShadow:'0 2px 4px black'
              }}>
                CAPOLAVORO!
              </span>
            </div>
          </>
      )}

      <span className="rating-label-text">VOTA:</span>
      
      <div className="stars-wrapper">
        {[...Array(10)].map((_, index) => {
          const starValue = index + 1;
          const isActive = starValue <= (hover || rating);
          
          return (
            <button
              key={index}
              type="button"
              className="star-btn"
              // Manteniamo inline solo le proprietà che cambiano dinamicamente
              style={{
                color: isActive ? '#FFD700' : '#4a4a4a',
                transform: starValue <= hover ? 'scale(1.2)' : 'scale(1)',
                textShadow: isActive ? '0 0 10px rgba(255, 215, 0, 0.5)' : 'none'
              }}
              onClick={() => handleRate(starValue)}
              onMouseEnter={() => setHover(starValue)}
              onMouseLeave={() => setHover(0)}
            >
              ★
            </button>
          );
        })}
      </div>
      
      <span className="rating-score">
        {hover || rating || 0}<span style={{fontSize: '0.7em', opacity: 0.6}}>/10</span>
      </span>
    </div>
  );
}