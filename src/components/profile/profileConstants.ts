import { ProfileStats } from "../../types/profileStats";

export const AVATAR_OPTIONS = [
  "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=Aneka",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=Shadow",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=Kiki",
  "https://api.dicebear.com/7.x/bottts/svg?seed=C-3PO",
  "https://api.dicebear.com/7.x/bottts/svg?seed=R2D2",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Scooby",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Shaggy",
  "https://api.dicebear.com/9.x/avataaars/svg?seed=Wyatt",
  "https://api.dicebear.com/9.x/avataaars/svg?seed=Liam",
  "https://api.dicebear.com/9.x/avataaars/svg?seed=Oliver",
];

export const PROFILE_COLORS = [
  "#4ae8ff", "#ff1744", "#ffd700", "#00e676", "#d500f9",
  "#ff3d00", "#00b0ff", "#1de9b6", "#f50057", "#76ff03",
  "#651fff", "#ffea00", "#00e5ff", "#ff9100", "#18ffff",
  "#b388ff", "#c6ff00", "#ff8a80", "#84ffff", "#ea80fc",
];

export const emptyProfileStats: ProfileStats = {
  movie_minutes: 0,
  tv_minutes: 0,
  total_minutes: 0,
  genres: {},
  advanced_stats: {
    episodes_total: 0,
    completed_series: 0,
    active_series: 0,
    watched_movies: 0,
    library_total: 0,
    watchlist_total: 0,
    rated_titles: 0,
    avg_rating: 0,
    movie_share_percent: 0,
    tv_share_percent: 0,
    longest_series_title: "",
    longest_series_poster: "",
    longest_series_episodes: 0,
    heaviest_title: "",
    heaviest_poster: "",
    heaviest_media_type: "",
    heaviest_minutes: 0,
    longest_movie_title: "",
    longest_movie_poster: "",
    longest_movie_minutes: 0,
  },
  personal_records: {
    max_episodes_day: 0,
    max_episodes_day_date: "",
    max_same_series_day: 0,
    max_same_series_title: "",
    max_minutes_day: 0,
    max_minutes_day_date: "",
    top_binge_series_title: "",
    top_binge_series_episodes: 0,
    watch_streak_days: 0,
  },
};
