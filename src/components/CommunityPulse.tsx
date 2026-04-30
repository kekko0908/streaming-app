import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import "../css/community.css";
import { TmdbItem } from "../types/types";

interface Activity {
  user_name: string;
  user_avatar: string;
  action_type: string;
  media_title: string;
  media_poster: string;
  media_type: string;
  tmdb_id: string;
  rating: number;
  season?: number;
  episode?: number;
  created_at: string;
}

interface CommunityPulseProps {
  onItemClick?: (item: TmdbItem) => void;
}

export default function CommunityPulse({ onItemClick }: CommunityPulseProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase.rpc('get_community_activity');
      if (!error && Array.isArray(data) && data.length > 0) {
        setActivities(data);
        setLoading(false);
        return;
      }

      setActivities([]);
      setLoading(false);
    }
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  const loopActivities = [...activities, ...activities];

  const getActionConfig = (act: Activity, mediaType: "movie" | "tv") => {
    switch (act.action_type) {
      case 'vote':
        return { icon: '⭐', color: '#ffd700', text: 'ha votato' };
      case 'watching':
        return { icon: '▶️', color: '#00e676', text: 'sta guardando' };
      case 'completed':
        // Se è una serie TV completata, scriviamo "Ha completato la serie"
        return { icon: '🏆', color: '#4ae8ff', text: mediaType === 'tv' ? 'ha completato la serie' : 'ha completato' };
      case 'plan':
        return { icon: '📌', color: '#ff0050', text: 'vuole vedere' };
      case 'suggested':
        return { icon: 'idea', color: '#f5c26b', text: 'ha consigliato' };
      default:
        return { icon: 'nw', color: '#ccc', text: 'ha aggiunto' };
    }
  };

  const resolvePosterSrc = (poster?: string) => {
    if (!poster) return "https://via.placeholder.com/90x135";
    if (poster.startsWith("http://") || poster.startsWith("https://")) return poster;
    return `https://image.tmdb.org/t/p/w200${poster}`;
  };

  const resolveAvatarSrc = (avatar?: string) => {
    if (!avatar) return "https://api.dicebear.com/7.x/adventurer/svg?seed=Default";
    return avatar;
  };

  return (
    <div className="community-pulse-container">
      <div className="community-header">
        <span className="pulse-dot"></span>
        <h3>In diretta su SFA</h3>
        <span className="live-badge">LIVE</span>
      </div>
      
      {loading ? (
        <div className="community-pulse-empty">Caricamento diretta community...</div>
      ) : activities.length === 0 ? (
        <div className="community-pulse-empty">Nessuna attivita live disponibile in questo momento.</div>
      ) : (
        <div className="activity-track">
          {loopActivities.map((act, i) => {
          const inferredType = act.media_type === 'tv' ? 'tv' : 'movie';
          const config = getActionConfig(act, inferredType);
          const maskedName = act.user_name.includes("@") 
            ? act.user_name.split("@")[0].substring(0, 3) + "***" 
            : act.user_name;

          // LOGICA VISUALIZZAZIONE BADGE (S:X E:Y)
          // Mostra SOLO se è una TV e lo stato è "watching" (In corso)
          const isTV = inferredType === 'tv';
          const isWatching = act.action_type === 'watching';
          const showEpisodeBadge = isTV && isWatching && act.season && act.episode;

          return (
            <div 
              key={`${i}-${act.tmdb_id}`} 
              className="activity-card"
              onClick={() => onItemClick && onItemClick({
                  tmdbId: act.tmdb_id,
                  type: inferredType as any,
                  title: act.media_title,
                  poster: act.media_poster,
                  year: "", overview: "", backdrop: "", rating: 0
              })}
            >
              <img 
                src={resolvePosterSrc(act.media_poster)} 
                alt="poster" 
                className="activity-poster" 
              />
              
              <div className="activity-content">
                <div className="user-row">
                   <img src={resolveAvatarSrc(act.user_avatar)} alt="user" className="user-avatar-small" />
                   <span className="user-name">{maskedName}</span>
                </div>

                <div className="action-row" style={{ color: config.color }}>
                   <span style={{marginRight:4}}>{config.icon}</span>
                   {config.text}
                </div>

                <div className="media-title-row">
                   {act.media_title}
                   
                   {/* BADGE EPISODIO CORRETTO */}
                   {showEpisodeBadge && (
                       <span className="ep-tag">S{act.season}:E{act.episode}</span>
                   )}
                </div>

                {act.rating > 0 && (
                   <div className="rating-pill-small">
                      ★ {act.rating}
                   </div>
                )}
              </div>
            </div>
          );
          })}
        </div>
      )}
    </div>
  );
}
