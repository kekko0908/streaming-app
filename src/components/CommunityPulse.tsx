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

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase.rpc('get_community_activity');
      if (!error && data) setActivities(data);
    }
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  if (activities.length === 0) return null;

  const loopActivities = [...activities, ...activities];

  const getActionConfig = (act: Activity) => {
    switch (act.action_type) {
      case 'vote':
        return { icon: '⭐', color: '#ffd700', text: 'ha votato' };
      case 'watching':
        return { icon: '▶️', color: '#00e676', text: 'sta guardando' };
      case 'completed':
        // Se è una serie TV completata, scriviamo "Ha completato la serie"
        return { icon: '🏆', color: '#4ae8ff', text: act.media_type === 'tv' ? 'ha completato la serie' : 'ha completato' };
      case 'plan':
        return { icon: '📌', color: '#ff0050', text: 'vuole vedere' };
      default:
        return { icon: 'nw', color: '#ccc', text: 'ha aggiunto' };
    }
  };

  return (
    <div className="community-pulse-container">
      <div className="community-header">
        <span className="pulse-dot"></span>
        <h3>In diretta su SFA</h3>
        <span className="live-badge">LIVE</span>
      </div>
      
      <div className="activity-track">
        {loopActivities.map((act, i) => {
          const config = getActionConfig(act);
          const maskedName = act.user_name.includes("@") 
            ? act.user_name.split("@")[0].substring(0, 3) + "***" 
            : act.user_name;

          // LOGICA VISUALIZZAZIONE BADGE (S:X E:Y)
          // Mostra SOLO se è una TV e lo stato è "watching" (In corso)
          const isTV = act.media_type === 'tv';
          const isWatching = act.action_type === 'watching';
          const showEpisodeBadge = isTV && isWatching && act.season && act.episode;

          return (
            <div 
              key={`${i}-${act.tmdb_id}`} 
              className="activity-card"
              onClick={() => onItemClick && onItemClick({
                  tmdbId: act.tmdb_id,
                  type: act.media_type as any,
                  title: act.media_title,
                  poster: act.media_poster,
                  year: "", overview: "", backdrop: "", rating: 0
              })}
            >
              <img 
                src={act.media_poster ? `https://image.tmdb.org/t/p/w200${act.media_poster}` : ""} 
                alt="poster" 
                className="activity-poster" 
              />
              
              <div className="activity-content">
                <div className="user-row">
                   <img src={act.user_avatar} alt="user" className="user-avatar-small" />
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
    </div>
  );
}