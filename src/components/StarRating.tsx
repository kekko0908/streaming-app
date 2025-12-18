import { useState, useEffect } from "react";
import "../css/hero.css"; 

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

    // Animazione solo per il 10
    if (starValue === 10) {
        setShowAnimation(true);
        setTimeout(() => setShowAnimation(false), 1500);
    }
  };

  // Funzione per rimuovere il voto
  const handleRemoveRating = () => {
    setRating(0);
    onRate(0); // 0 significa "rimuovi voto" nel database
  };

  return (
    <div className="star-rating-container">
      {/* ANIMAZIONE CORONA */}
      {showAnimation && (
          <>
            <div className="crown-glow" />
            <div className="crown-pop">
              👑 
              <span style={{ fontSize:'0.8rem', display:'block', textAlign:'center', fontWeight:'bold', color:'#FFD700', textShadow:'0 2px 4px black' }}>
                CAPOLAVORO!
              </span>
            </div>
          </>
      )}

      <div className="rating-content-group">
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

      {/* --- BOTTONE RIMUOVI VOTO (Appare solo se c'è un voto) --- */}
      {rating > 0 && (
        <>
            <div className="rating-separator"></div>
            <button 
                className="remove-rating-btn" 
                onClick={handleRemoveRating}
                title="Rimuovi il tuo voto"
            >
                Rimuovi
            </button>
        </>
      )}

    </div>
  );
}