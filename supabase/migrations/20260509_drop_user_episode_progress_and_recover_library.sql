with tv_event_rollup as (
  select
    user_id,
    tmdb_id,
    coalesce(sum(episodes_count), 0)::integer as watched_episodes
  from public.watch_events
  where media_type = 'tv'
    and event_type = 'tv_progress'
  group by user_id, tmdb_id
),
latest_tv_event as (
  select distinct on (user_id, tmdb_id)
    user_id,
    tmdb_id,
    season_number,
    episode_number
  from public.watch_events
  where media_type = 'tv'
    and event_type = 'tv_progress'
    and season_number is not null
    and episode_number is not null
  order by user_id, tmdb_id, watched_at desc, id desc
)
update public.user_library ul
set
  current_season = coalesce(nullif(ul.current_season, 1), latest_tv_event.season_number, ul.current_season),
  current_episode = coalesce(nullif(ul.current_episode, 1), latest_tv_event.episode_number, ul.current_episode),
  total_watched_episodes = greatest(coalesce(ul.total_watched_episodes, 0), tv_event_rollup.watched_episodes)
from tv_event_rollup
left join latest_tv_event
  on latest_tv_event.user_id = tv_event_rollup.user_id
 and latest_tv_event.tmdb_id = tv_event_rollup.tmdb_id
where ul.user_id = tv_event_rollup.user_id
  and ul.tmdb_id = tv_event_rollup.tmdb_id
  and (
    coalesce(ul.total_watched_episodes, 0) < tv_event_rollup.watched_episodes
    or (coalesce(ul.current_season, 1) = 1 and coalesce(ul.current_episode, 1) = 1)
  );

drop table if exists public.user_episode_progress;
