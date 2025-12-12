import { useState, useEffect } from "react";
import "../css/hero.css"; // Assicurati che l'animazione sia qui

interface StarRatingProps {
  initialRating: number;
  onRate: (rating: number) => void;
}

export default function StarRating({ initialRating, onRate }: StarRatingProps) {
  const [rating, setRating] = useState(initialRating);
  const [hover, setHover] = useState(0);
  const [showAnimation, setShowAnimation] = useState(false); // Stato per animazione

  useEffect(() => {
    setRating(initialRating);
  }, [initialRating]);

  const handleRate = (starValue: number) => {
    setRating(starValue);
    onRate(starValue);

    // Se il voto è 10, attiva l'animazione!
    if (starValue === 10) {
        setShowAnimation(true);
        // Nascondi dopo 1.5 secondi (durata animazione)
        setTimeout(() => setShowAnimation(false), 1500);
    }
  };

  return (
    <div 
      style={{ 
        display: 'inline-flex',
        alignItems: 'center', 
        gap: '6px', 
        marginTop: '15px', 
        padding: '10px 15px',
        background: 'rgba(0, 0, 0, 0.6)', 
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(4px)',
        position: 'relative' // Necessario per posizionare l'animazione
      }}
    >
      {/* ANIMAZIONE CORONA (Appare solo se showAnimation è true) */}
      {showAnimation && (
          <>
            <div className="crown-glow" />
            <div className="crown-pop">👑 <span style={{fontSize:'1rem', display:'block', textAlign:'center', fontWeight:'bold', color:'#FFD700', textShadow:'0 2px 4px black'}}>CAPOLAVORO!</span></div>
          </>
      )}

      <span className="eyebrow" style={{ marginRight: '10px', opacity: 0.9, color: '#ddd', fontSize: '0.85rem' }}>VOTA:</span>
      
      <div style={{ display: 'flex', gap: '2px' }}>
        {[...Array(10)].map((_, index) => {
          const starValue = index + 1;
          const isActive = starValue <= (hover || rating);
          
          return (
            <button
              key={index}
              type="button"
              className="star-btn"
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '0',
                fontSize: '1.5rem',
                lineHeight: '1',
                transition: 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275), color 0.2s',
                color: isActive ? '#FFD700' : '#4a4a4a',
                transform: starValue <= hover ? 'scale(1.3)' : 'scale(1)',
                textShadow: isActive ? '0 0 10px rgba(255, 215, 0, 0.5)' : 'none'
              }}
              onClick={() => handleRate(starValue)} // Usa il nuovo handler
              onMouseEnter={() => setHover(starValue)}
              onMouseLeave={() => setHover(0)}
            >
              ★
            </button>
          );
        })}
      </div>
      
      <span style={{ 
        marginLeft: '12px', 
        fontWeight: '800', 
        fontSize: '1.1rem',
        color: (hover || rating) > 0 ? '#FFD700' : '#888',
        minWidth: '40px',
        textAlign: 'right'
      }}>
        {hover || rating || 0}<span style={{fontSize: '0.8rem', opacity: 0.6}}>/10</span>
      </span>
    </div>
  );
}