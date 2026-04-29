import { MediaType } from "./types";

export interface AdvancedStats {
  episodes_total: number;
  completed_series: number;
  active_series: number;
  watched_movies: number;
  library_total: number;
  watchlist_total: number;
  rated_titles: number;
  avg_rating: number;
  movie_share_percent: number;
  tv_share_percent: number;
  longest_series_title: string;
  longest_series_poster: string;
  longest_series_episodes: number;
  heaviest_title: string;
  heaviest_poster: string;
  heaviest_media_type: MediaType | "";
  heaviest_minutes: number;
  longest_movie_title: string;
  longest_movie_poster: string;
  longest_movie_minutes: number;
}

export interface PersonalRecords {
  max_episodes_day: number;
  max_episodes_day_date: string;
  max_same_series_day: number;
  max_same_series_title: string;
  max_minutes_day: number;
  max_minutes_day_date: string;
  top_binge_series_title: string;
  top_binge_series_episodes: number;
  watch_streak_days: number;
}

export interface ProfileStats {
  movie_minutes: number;
  tv_minutes: number;
  total_minutes: number;
  genres: Record<string, number>;
  advanced_stats: AdvancedStats;
  personal_records: PersonalRecords;
  joinDate?: string;
}
