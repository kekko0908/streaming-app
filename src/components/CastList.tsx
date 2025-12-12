import "../css/hero.css"; // Usiamo lo stesso CSS o creane uno nuovo
import { CastMember } from "../utils/api";

interface CastListProps {
  cast: CastMember[];
}

export default function CastList({ cast }: CastListProps) {
  if (!cast || cast.length === 0) return null;

  return (
    <div style={{ marginTop: '30px', marginBottom: '20px' }}>
      <h3 className="eyebrow" style={{ color: '#fff', marginBottom: '15px' }}>Cast Principale</h3>
      
      <div style={{ 
        display: 'flex', 
        gap: '15px', 
        overflowX: 'auto', 
        paddingBottom: '10px',
        maskImage: 'linear-gradient(to right, black 90%, transparent 100%)' // Sfumatura a destra
      }}>
        {cast.map(actor => (
          <div key={actor.id} style={{ minWidth: '100px', textAlign: 'center' }}>
            {/* Foto Attore */}
            <div style={{ 
              width: '80px', 
              height: '80px', 
              borderRadius: '50%', 
              overflow: 'hidden', 
              margin: '0 auto 8px',
              border: '2px solid rgba(255,255,255,0.1)',
              background: '#1a1a1a'
            }}>
              {actor.profile_path ? (
                <img 
                  src={actor.profile_path} 
                  alt={actor.name} 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                />
              ) : (
                <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', color:'#555', fontSize:'2rem' }}>
                  👤
                </div>
              )}
            </div>
            
            {/* Nome */}
            <div style={{ fontSize: '0.85rem', fontWeight: '600', color: '#fff' }}>{actor.name}</div>
            {/* Personaggio */}
            <div style={{ fontSize: '0.75rem', color: '#888', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {actor.character}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}