import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import "../css/community.css";

interface Activity {
  user_name: string;
  action_type: string;
  media_title: string;
  media_poster: string;
  rating: number;
  created_at: string;
}

export default function CommunityPulse() {
  const [activities, setActivities] = useState<Activity[]>([]);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase.rpc('get_community_activity');
      if (!error && data) setActivities(data);
    }
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  if (activities.length === 0) return null;

  // TRUCCO: Duplichiamo la lista per creare l'effetto loop infinito senza buchi
  const loopActivities = [...activities, ...activities];

  return (
    <div className="community-pulse-container">
      <div className="community-header">
        <span className="pulse-dot"></span>
        <h3>In diretta su SFA</h3>
      </div>
      
      {/* Usiamo la classe 'activity-track' invece di 'scroller' */}
      <div className="activity-track">
        {loopActivities.map((act, i) => (
          <div key={i} className="activity-card">
            <img src={act.media_poster} alt={act.media_title} className="activity-poster" />
            <div className="activity-text">
              <span className="user-name">{act.user_name}</span>
              <span className="action-text"> {act.action_type} </span>
              <span className="media-title">{act.media_title}</span>
              {act.rating === 10 && <span className="activity-crown">👑</span>}
            </div>
            <div className="time-ago">
               {new Date(act.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}