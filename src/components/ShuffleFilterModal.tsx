import "../css/shuffle.css";

interface ShuffleFilterModalProps {
  onSelectGenre: (genreId: number | null) => void;
  onClose: () => void;
  loading: boolean;
}

export default function ShuffleFilterModal({ onSelectGenre, onClose, loading }: ShuffleFilterModalProps) {
  
  const genres = [
    { id: 28, label: "Azione", icon: "💥" },
    { id: 35, label: "Commedia", icon: "😂" },
    { id: 27, label: "Horror", icon: "👻" },
    { id: 878, label: "Sci-Fi", icon: "👽" },
    { id: 10749, label: "Romantico", icon: "💘" },
    { id: 18, label: "Drammatico", icon: "🎭" },
    { id: 53, label: "Thriller", icon: "🔪" },
    { id: 16, label: "Animazione", icon: "✨" },
  ];

  return (
    <div className="shuffle-overlay" onClick={onClose}>
      <div className="shuffle-card" onClick={(e) => e.stopPropagation()} style={{maxWidth: '450px'}}>
        
        <button className="close-shuffle" onClick={onClose}>✕</button>

        <div className="shuffle-content" style={{marginTop: 0, paddingTop: 30}}>
          <h2 className="shuffle-title">Di che umore sei?</h2>
          <p className="shuffle-question">Scegli un genere e ti consiglierò il film perfetto.</p>

          <div className="shuffle-filter-grid">
            {genres.map(g => (
              <button 
                key={g.id} 
                className="genre-btn" 
                onClick={() => onSelectGenre(g.id)}
                disabled={loading}
              >
                <span>{g.icon}</span> {g.label}
              </button>
            ))}
            
            <button 
                className="genre-btn surprise" 
                onClick={() => onSelectGenre(null)}
                disabled={loading}
            >
                🎲 Sorprendimi (Qualsiasi)
            </button>
          </div>
          
          {loading && <p style={{marginTop: 15, color: '#4ae8ff'}}>Sto cercando il film perfetto...</p>}

        </div>
      </div>
    </div>
  );
}