import { buildEmbedUrl } from "../utils/helper";
import "../css/card.css"; // Usa stili comuni drawer
import { TmdbItem } from "../types/types";

interface PlayerProps {
  item: TmdbItem;
  season: number;
  episode: number;
  onClose: () => void;
}

export default function PlayerDrawer({ item, season, episode, onClose }: PlayerProps) {
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0 }}>Riproduzione: {item.title}</h3>
            {item.type === 'tv' && <span style={{ fontSize: '0.85rem', opacity: 0.7 }}>Stagione {season} - Episodio {episode}</span>}
          </div>
          <button className="pill ghost" onClick={onClose}>Chiudi</button>
        </div>
        <iframe
          src={buildEmbedUrl(item.tmdbId, item.type, season, episode)}
          allowFullScreen
          title="Player"
        />
      </div>
    </div>
  );
}