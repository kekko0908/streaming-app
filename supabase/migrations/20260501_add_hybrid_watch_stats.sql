create table if not exists public.watch_events (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  tmdb_id bigint not null,
  media_type text not null check (media_type in ('movie', 'tv')),
  season_number integer,
  episode_number integer,
  episodes_count integer not null default 0 check (episodes_count >= 0),
  minutes_count integer not null default 0 check (minutes_count >= 0),
  event_type text not null check (event_type in ('tv_progress', 'movie_completed')),
  watched_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists watch_events_user_watched_at_idx
on public.watch_events (user_id, watched_at desc);

create index if not exists watch_events_tmdb_watched_at_idx
on public.watch_events (tmdb_id, watched_at desc);

alter table public.watch_events enable row level security;

drop policy if exists "watch_events_select_own" on public.watch_events;
drop policy if exists "watch_events_insert_own" on public.watch_events;
drop policy if exists "watch_events_delete_own" on public.watch_events;

create policy "watch_events_select_own"
on public.watch_events
for select
to authenticated
using (auth.uid() is not null and auth.uid() = user_id);

create policy "watch_events_insert_own"
on public.watch_events
for insert
to authenticated
with check (auth.uid() is not null and auth.uid() = user_id);

create policy "watch_events_delete_own"
on public.watch_events
for delete
to authenticated
using (auth.uid() is not null and auth.uid() = user_id);

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
      coalesce(mi.runtime, 0) as runtime
    from public.user_library ul
    join public.media_items mi on mi.tmdb_id = ul.tmdb_id
    where ul.user_id = current_user_id
  ),
  row_metrics as (
    select
      *,
      case
        when media_type = 'movie' then runtime
        when media_type = 'tv' then total_watched_episodes * runtime
        else 0
      end as estimated_minutes
    from library_rows
  ),
  longest_series as (
    select title, total_watched_episodes
    from row_metrics
    where media_type = 'tv'
    order by total_watched_episodes desc, title asc
    limit 1
  ),
  heaviest_title as (
    select title, media_type, estimated_minutes
    from row_metrics
    order by estimated_minutes desc, title asc
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
    'longest_series_episodes', coalesce((select total_watched_episodes from longest_series), 0)::integer,
    'heaviest_title', coalesce((select title from heaviest_title), ''),
    'heaviest_media_type', coalesce((select media_type from heaviest_title), ''),
    'heaviest_minutes', coalesce((select estimated_minutes from heaviest_title), 0)::integer
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

create or replace function public.get_ranking_daily_episodes(time_range text default 'all')
returns table (
  username text,
  avatar_url text,
  score integer,
  title text,
  media_type text,
  rank bigint
)
language sql
security definer
set search_path = public
as $$
  with filtered_events as (
    select *
    from public.watch_events we
    where we.episodes_count > 0
      and case
        when time_range = 'week' then we.watched_at >= now() - interval '7 days'
        when time_range = 'month' then we.watched_at >= now() - interval '30 days'
        else true
      end
  ),
  daily_totals as (
    select
      user_id,
      watched_at::date as watch_day,
      sum(episodes_count)::integer as score
    from filtered_events
    group by user_id, watched_at::date
  ),
  day_titles as (
    select
      fe.user_id,
      fe.watched_at::date as watch_day,
      coalesce(mi.title, 'Titolo sconosciuto') as title,
      coalesce(mi.media_type, fe.media_type) as media_type,
      sum(fe.episodes_count)::integer as title_score,
      row_number() over (
        partition by fe.user_id, fe.watched_at::date
        order by sum(fe.episodes_count) desc, coalesce(mi.title, 'Titolo sconosciuto') asc
      ) as rn
    from filtered_events fe
    left join public.media_items mi on mi.tmdb_id = fe.tmdb_id
    group by fe.user_id, fe.watched_at::date, mi.title, mi.media_type, fe.media_type
  ),
  best_per_user as (
    select distinct on (dt.user_id)
      dt.user_id,
      dt.score,
      coalesce(dtl.title, 'Serie TV') as title,
      coalesce(dtl.media_type, 'tv') as media_type
    from daily_totals dt
    left join day_titles dtl on dtl.user_id = dt.user_id and dtl.watch_day = dt.watch_day and dtl.rn = 1
    order by dt.user_id, dt.score desc, dt.watch_day desc
  ),
  ranked_users as (
    select
      coalesce(nullif(p.username, ''), 'Utente SFA') as username,
      coalesce(nullif(p.avatar_url, ''), 'https://api.dicebear.com/7.x/adventurer/svg?seed=Default') as avatar_url,
      bpu.score,
      bpu.title,
      bpu.media_type
    from best_per_user bpu
    left join public.profiles p on p.id = bpu.user_id
    where bpu.score > 0
  )
  select
    ru.username,
    ru.avatar_url,
    ru.score,
    ru.title,
    ru.media_type,
    rank() over (order by ru.score desc) as rank
  from ranked_users ru
  order by ru.score desc, ru.username asc
  limit 50;
$$;

create or replace function public.get_ranking_same_series_episodes(time_range text default 'all')
returns table (
  username text,
  avatar_url text,
  score integer,
  title text,
  media_type text,
  rank bigint
)
language sql
security definer
set search_path = public
as $$
  with series_days as (
    select
      we.user_id,
      we.tmdb_id,
      we.watched_at::date as watch_day,
      coalesce(mi.title, 'Titolo sconosciuto') as title,
      coalesce(mi.media_type, we.media_type) as media_type,
      sum(we.episodes_count)::integer as score
    from public.watch_events we
    left join public.media_items mi on mi.tmdb_id = we.tmdb_id
    where we.media_type = 'tv'
      and we.episodes_count > 0
      and case
        when time_range = 'week' then we.watched_at >= now() - interval '7 days'
        when time_range = 'month' then we.watched_at >= now() - interval '30 days'
        else true
      end
    group by we.user_id, we.tmdb_id, we.watched_at::date, mi.title, mi.media_type, we.media_type
  ),
  best_per_user as (
    select distinct on (user_id)
      user_id,
      score,
      title,
      media_type
    from series_days
    order by user_id, score desc, watch_day desc, title asc
  ),
  ranked_users as (
    select
      coalesce(nullif(p.username, ''), 'Utente SFA') as username,
      coalesce(nullif(p.avatar_url, ''), 'https://api.dicebear.com/7.x/adventurer/svg?seed=Default') as avatar_url,
      bpu.score,
      bpu.title,
      bpu.media_type
    from best_per_user bpu
    left join public.profiles p on p.id = bpu.user_id
    where bpu.score > 0
  )
  select
    ru.username,
    ru.avatar_url,
    ru.score,
    ru.title,
    ru.media_type,
    rank() over (order by ru.score desc) as rank
  from ranked_users ru
  order by ru.score desc, ru.username asc
  limit 50;
$$;

create or replace function public.get_ranking_daily_minutes(time_range text default 'all')
returns table (
  username text,
  avatar_url text,
  score integer,
  title text,
  media_type text,
  rank bigint
)
language sql
security definer
set search_path = public
as $$
  with filtered_events as (
    select *
    from public.watch_events we
    where we.minutes_count > 0
      and case
        when time_range = 'week' then we.watched_at >= now() - interval '7 days'
        when time_range = 'month' then we.watched_at >= now() - interval '30 days'
        else true
      end
  ),
  daily_totals as (
    select
      user_id,
      watched_at::date as watch_day,
      sum(minutes_count)::integer as score
    from filtered_events
    group by user_id, watched_at::date
  ),
  day_titles as (
    select
      fe.user_id,
      fe.watched_at::date as watch_day,
      coalesce(mi.title, 'Titolo sconosciuto') as title,
      coalesce(mi.media_type, fe.media_type) as media_type,
      sum(fe.minutes_count)::integer as title_score,
      row_number() over (
        partition by fe.user_id, fe.watched_at::date
        order by sum(fe.minutes_count) desc, coalesce(mi.title, 'Titolo sconosciuto') asc
      ) as rn
    from filtered_events fe
    left join public.media_items mi on mi.tmdb_id = fe.tmdb_id
    group by fe.user_id, fe.watched_at::date, mi.title, mi.media_type, fe.media_type
  ),
  best_per_user as (
    select distinct on (dt.user_id)
      dt.user_id,
      dt.score,
      coalesce(dtl.title, 'Titolo sconosciuto') as title,
      coalesce(dtl.media_type, 'movie') as media_type
    from daily_totals dt
    left join day_titles dtl on dtl.user_id = dt.user_id and dtl.watch_day = dt.watch_day and dtl.rn = 1
    order by dt.user_id, dt.score desc, dt.watch_day desc
  ),
  ranked_users as (
    select
      coalesce(nullif(p.username, ''), 'Utente SFA') as username,
      coalesce(nullif(p.avatar_url, ''), 'https://api.dicebear.com/7.x/adventurer/svg?seed=Default') as avatar_url,
      bpu.score,
      bpu.title,
      bpu.media_type
    from best_per_user bpu
    left join public.profiles p on p.id = bpu.user_id
    where bpu.score > 0
  )
  select
    ru.username,
    ru.avatar_url,
    ru.score,
    ru.title,
    ru.media_type,
    rank() over (order by ru.score desc) as rank
  from ranked_users ru
  order by ru.score desc, ru.username asc
  limit 50;
$$;

create or replace function public.get_ranking_completed_series(time_range text default 'all')
returns table (
  username text,
  avatar_url text,
  score integer,
  title text,
  media_type text,
  rank bigint
)
language sql
security definer
set search_path = public
as $$
  with completed as (
    select
      ul.user_id,
      count(*)::integer as score,
      'Serie completate'::text as title,
      'tv'::text as media_type
    from public.user_library ul
    join public.media_items mi on mi.tmdb_id = ul.tmdb_id
    where mi.media_type = 'tv'
      and ul.status = 'gia-guardato'
      and case
        when time_range = 'week' then ul.added_at >= now() - interval '7 days'
        when time_range = 'month' then ul.added_at >= now() - interval '30 days'
        else true
      end
    group by ul.user_id
  ),
  ranked_users as (
    select
      coalesce(nullif(p.username, ''), 'Utente SFA') as username,
      coalesce(nullif(p.avatar_url, ''), 'https://api.dicebear.com/7.x/adventurer/svg?seed=Default') as avatar_url,
      c.score,
      c.title,
      c.media_type
    from completed c
    left join public.profiles p on p.id = c.user_id
    where c.score > 0
  )
  select
    ru.username,
    ru.avatar_url,
    ru.score,
    ru.title,
    ru.media_type,
    rank() over (order by ru.score desc) as rank
  from ranked_users ru
  order by ru.score desc, ru.username asc
  limit 50;
$$;

revoke all on table public.watch_events from public, anon;
grant select, insert, delete on table public.watch_events to authenticated;
grant usage, select on sequence public.watch_events_id_seq to authenticated;

revoke all on function public.get_profile_stats(uuid) from public, anon;
grant execute on function public.get_profile_stats(uuid) to authenticated;

revoke all on function public.get_ranking_daily_episodes(text) from public, anon;
grant execute on function public.get_ranking_daily_episodes(text) to authenticated;

revoke all on function public.get_ranking_same_series_episodes(text) from public, anon;
grant execute on function public.get_ranking_same_series_episodes(text) to authenticated;

revoke all on function public.get_ranking_daily_minutes(text) from public, anon;
grant execute on function public.get_ranking_daily_minutes(text) to authenticated;

revoke all on function public.get_ranking_completed_series(text) from public, anon;
grant execute on function public.get_ranking_completed_series(text) to authenticated;
