-- Keep watch_events as an append-only history, but prevent counting the same
-- watched title/episode more than once for profile stats.

with ranked_tv_events as (
  select
    id,
    row_number() over (
      partition by user_id, tmdb_id, season_number, episode_number, event_type
      order by watched_at asc, id asc
    ) as duplicate_rank
  from public.watch_events
  where media_type = 'tv'
    and event_type = 'tv_progress'
    and season_number is not null
    and episode_number is not null
)
delete from public.watch_events we
using ranked_tv_events ranked
where we.id = ranked.id
  and ranked.duplicate_rank > 1;

with ranked_movie_events as (
  select
    id,
    row_number() over (
      partition by user_id, tmdb_id, event_type
      order by watched_at asc, id asc
    ) as duplicate_rank
  from public.watch_events
  where media_type = 'movie'
    and event_type = 'movie_completed'
)
delete from public.watch_events we
using ranked_movie_events ranked
where we.id = ranked.id
  and ranked.duplicate_rank > 1;

create unique index if not exists watch_events_unique_tv_episode
on public.watch_events (user_id, tmdb_id, season_number, episode_number, event_type)
where media_type = 'tv'
  and event_type = 'tv_progress'
  and season_number is not null
  and episode_number is not null;

create unique index if not exists watch_events_unique_movie_completed
on public.watch_events (user_id, tmdb_id, event_type)
where media_type = 'movie'
  and event_type = 'movie_completed';
