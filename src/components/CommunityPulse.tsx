import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import "../css/community.css";
import { TmdbItem } from "../types/types";
import { getTmdbImageUrl } from "../utils/helper";
import { Icon } from "./ui/Icon";

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
      const { data, error } = await supabase.rpc("get_community_activity");
      setActivities(!error && Array.isArray(data) ? data.slice(0, 18) : []);
      setLoading(false);
    }
    load();
    const interval = window.setInterval(load, 15_000);
    return () => window.clearInterval(interval);
  }, []);

  const getActionConfig = (activity: Activity, mediaType: "movie" | "tv") => {
    switch (activity.action_type) {
      case "vote": return { icon: "star" as const, color: "#ffd75e", text: "ha votato" };
      case "watching": return { icon: "play" as const, color: "#42f59e", text: "sta guardando" };
      case "completed": return { icon: "trophy" as const, color: "#4ae8ff", text: mediaType === "tv" ? "ha completato la serie" : "ha completato" };
      case "plan": return { icon: "pin" as const, color: "#ff365f", text: "vuole vedere" };
      case "suggested": return { icon: "lightbulb" as const, color: "#f5c26b", text: "ha consigliato" };
      default: return { icon: "check" as const, color: "#c8d0d8", text: "ha aggiunto" };
    }
  };

  const openActivity = (activity: Activity) => {
    const type = activity.media_type === "tv" ? "tv" : "movie";
    onItemClick?.({
      tmdbId: activity.tmdb_id,
      type,
      title: activity.media_title,
      poster: activity.media_poster,
      year: "",
      overview: "",
      backdrop: "",
      rating: 0,
    });
  };

  return (
    <section className="community-pulse-container" aria-labelledby="sfa-live-title">
      <div className="community-header">
        <div className="community-live-title">
          <span className="pulse-dot" />
          <div>
            <span className="community-eyebrow">La community adesso</span>
            <h2 id="sfa-live-title">In diretta su SFA</h2>
          </div>
          <span className="live-badge">LIVE</span>
        </div>
        <p>Scopri cosa stanno guardando, votando e salvando gli altri utenti.</p>
      </div>

      {loading ? (
        <div className="community-pulse-empty">Caricamento diretta community...</div>
      ) : activities.length === 0 ? (
        <div className="community-pulse-empty">Nessuna attività live disponibile in questo momento.</div>
      ) : (
        <div className="activity-track">
          {activities.map((activity, index) => {
            const type = activity.media_type === "tv" ? "tv" : "movie";
            const config = getActionConfig(activity, type);
            const maskedName = activity.user_name.includes("@")
              ? `${activity.user_name.split("@")[0].slice(0, 3)}***`
              : activity.user_name;
            const showEpisode = type === "tv" && activity.action_type === "watching" && activity.season && activity.episode;

            return (
              <button
                type="button"
                key={`${activity.tmdb_id}-${activity.created_at}-${index}`}
                className="activity-card"
                onClick={() => openActivity(activity)}
                aria-label={`${maskedName} ${config.text} ${activity.media_title}`}
              >
                <img
                  src={getTmdbImageUrl(activity.media_poster, "w500", "https://via.placeholder.com/500x750")}
                  alt=""
                  className="activity-poster"
                  draggable={false}
                />
                <span className="activity-scrim" />
                <span className="activity-content">
                  <span className="user-row">
                    <img
                      src={activity.user_avatar || "https://api.dicebear.com/7.x/adventurer/svg?seed=Default"}
                      alt=""
                      className="user-avatar-small"
                    />
                    <span className="user-name">{maskedName}</span>
                  </span>
                  <span className="action-row" style={{ color: config.color }}>
                    <Icon name={config.icon} size={14} /> {config.text}
                  </span>
                  <strong className="media-title-row">
                    {activity.media_title}
                    {showEpisode && <span className="ep-tag">S{activity.season}:E{activity.episode}</span>}
                  </strong>
                  {activity.rating > 0 && <span className="rating-pill-small">★ {activity.rating}</span>}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
