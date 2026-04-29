drop function if exists public.get_profile_stats(uuid);

create or replace function public.get_profile_stats(target_user_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  movie_minutes_total integer := 0;
  tv_minutes_total integer := 0;
  total_minutes_total integer := 0;
  genres_summary jsonb := '{}'::jsonb;
  advanced_summary jsonb := '{}'::jsonb;
  records_summary jsonb := '{}'::jsonb;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select
    coalesce(wm.movie_minutes, 0),
    coalesce(wm.tv_minutes, 0),
    coalesce(wm.total_minutes, 0)
  into movie_minutes_total, tv_minutes_total, total_minutes_total
  from public.get_user_watch_minutes('all') wm
  where wm.user_id = current_user_id;

  select
    coalesce(jsonb_object_agg(genre_name, genre_count), '{}'::jsonb)
  into genres_summary
  from (
    select
      genre_name,
      count(*)::integer as genre_count
    from public.user_library ul
    join public.media_items mi on mi.tmdb_id = ul.tmdb_id
    cross join lateral jsonb_array_elements_text(coalesce(mi.genres, '[]'::jsonb)) as genre_name
    where ul.user_id = current_user_id
    group by genre_name
  ) genre_counts;

  with library_rows as (
    select
      ul.tmdb_id,
      ul.status,
      coalesce(ul.rating, 0) as rating,
      coalesce(ul.total_watched_episodes, 0) as total_watched_episodes,
      mi.title,
      mi.media_type,
      coalesce(mi.runtime, 0) as runtime,
      coalesce(mi.poster_path, '') as poster_path
    from public.user_library ul
    join public.media_items mi on mi.tmdb_id = ul.tmdb_id
    where ul.user_id = current_user_id
  ),
  row_metrics as (
    select
      *,
      case
        when media_type = 'movie' and status = 'gia-guardato' then runtime
        when media_type = 'tv' then total_watched_episodes * runtime
        else 0
      end as estimated_minutes
    from library_rows
  ),
  longest_series as (
    select title, poster_path, total_watched_episodes
    from row_metrics
    where media_type = 'tv'
    order by total_watched_episodes desc, title asc
    limit 1
  ),
  heaviest_title as (
    select title, media_type, poster_path, estimated_minutes
    from row_metrics
    where estimated_minutes > 0
    order by estimated_minutes desc, title asc
    limit 1
  ),
  longest_movie as (
    select title, poster_path, runtime
    from row_metrics
    where media_type = 'movie'
      and status = 'gia-guardato'
      and runtime > 0
    order by runtime desc, title asc
    limit 1
  )
  select jsonb_build_object(
    'episodes_total', coalesce(sum(case when media_type = 'tv' then total_watched_episodes else 0 end), 0)::integer,
    'completed_series', coalesce(count(*) filter (where media_type = 'tv' and status = 'gia-guardato'), 0)::integer,
    'active_series', coalesce(count(*) filter (where media_type = 'tv' and status = 'in-corso'), 0)::integer,
    'watched_movies', coalesce(count(*) filter (where media_type = 'movie' and status = 'gia-guardato'), 0)::integer,
    'library_total', coalesce(count(*), 0)::integer,
    'watchlist_total', coalesce(count(*) filter (where status in ('da-guardare', 'pianificato')), 0)::integer,
    'rated_titles', coalesce(count(*) filter (where rating > 0), 0)::integer,
    'avg_rating', coalesce(round(avg(nullif(rating, 0))::numeric, 1), 0),
    'movie_share_percent', case when total_minutes_total > 0 then round((movie_minutes_total::numeric / total_minutes_total::numeric) * 100)::integer else 0 end,
    'tv_share_percent', case when total_minutes_total > 0 then round((tv_minutes_total::numeric / total_minutes_total::numeric) * 100)::integer else 0 end,
    'longest_series_title', coalesce((select title from longest_series), ''),
    'longest_series_poster', coalesce((select poster_path from longest_series), ''),
    'longest_series_episodes', coalesce((select total_watched_episodes from longest_series), 0)::integer,
    'heaviest_title', coalesce((select title from heaviest_title), ''),
    'heaviest_poster', coalesce((select poster_path from heaviest_title), ''),
    'heaviest_media_type', coalesce((select media_type from heaviest_title), ''),
    'heaviest_minutes', coalesce((select estimated_minutes from heaviest_title), 0)::integer,
    'longest_movie_title', coalesce((select title from longest_movie), ''),
    'longest_movie_poster', coalesce((select poster_path from longest_movie), ''),
    'longest_movie_minutes', coalesce((select runtime from longest_movie), 0)::integer
  )
  into advanced_summary
  from row_metrics;

  with event_days as (
    select
      watched_at::date as watch_day,
      sum(episodes_count)::integer as episodes,
      sum(minutes_count)::integer as minutes
    from public.watch_events
    where user_id = current_user_id
    group by watched_at::date
  ),
  best_episode_day as (
    select watch_day, episodes
    from event_days
    order by episodes desc, watch_day desc
    limit 1
  ),
  best_minutes_day as (
    select watch_day, minutes
    from event_days
    order by minutes desc, watch_day desc
    limit 1
  ),
  same_series_days as (
    select
      we.watched_at::date as watch_day,
      we.tmdb_id,
      coalesce(mi.title, 'Titolo sconosciuto') as title,
      sum(we.episodes_count)::integer as episodes,
      sum(we.minutes_count)::integer as minutes
    from public.watch_events we
    left join public.media_items mi on mi.tmdb_id = we.tmdb_id
    where we.user_id = current_user_id
      and we.media_type = 'tv'
    group by we.watched_at::date, we.tmdb_id, mi.title
  ),
  best_same_series_day as (
    select watch_day, title, episodes
    from same_series_days
    order by episodes desc, watch_day desc, title asc
    limit 1
  ),
  top_binge_series as (
    select title, episodes, minutes
    from same_series_days
    order by episodes desc, minutes desc, title asc
    limit 1
  ),
  streak_source as (
    select
      watch_day,
      watch_day - (row_number() over (order by watch_day))::integer as streak_group
    from event_days
  ),
  streaks as (
    select count(*)::integer as streak_days
    from streak_source
    group by streak_group
  )
  select jsonb_build_object(
    'max_episodes_day', coalesce((select episodes from best_episode_day), 0)::integer,
    'max_episodes_day_date', coalesce((select watch_day::text from best_episode_day), ''),
    'max_same_series_day', coalesce((select episodes from best_same_series_day), 0)::integer,
    'max_same_series_title', coalesce((select title from best_same_series_day), ''),
    'max_minutes_day', coalesce((select minutes from best_minutes_day), 0)::integer,
    'max_minutes_day_date', coalesce((select watch_day::text from best_minutes_day), ''),
    'top_binge_series_title', coalesce((select title from top_binge_series), ''),
    'top_binge_series_episodes', coalesce((select episodes from top_binge_series), 0)::integer,
    'watch_streak_days', coalesce((select max(streak_days) from streaks), 0)::integer
  )
  into records_summary;

  return jsonb_build_object(
    'movie_minutes', movie_minutes_total,
    'tv_minutes', tv_minutes_total,
    'total_minutes', total_minutes_total,
    'genres', genres_summary,
    'advanced_stats', coalesce(advanced_summary, '{}'::jsonb),
    'personal_records', coalesce(records_summary, '{}'::jsonb)
  );
end;
$$;

revoke all on function public.get_profile_stats(uuid) from public, anon;
grant execute on function public.get_profile_stats(uuid) to authenticated;
