create or replace function public.get_user_watch_minutes(time_range text default 'all')
returns table (
  user_id uuid,
  movie_minutes integer,
  tv_minutes integer,
  total_minutes integer
)
language sql
security invoker
set search_path = public
as $$
  with filtered_library as (
    select
      ul.user_id,
      ul.tmdb_id,
      ul.total_watched_episodes,
      ul.added_at
    from public.user_library ul
    where case
      when time_range = 'week' then ul.added_at >= now() - interval '7 days'
      when time_range = 'month' then ul.added_at >= now() - interval '30 days'
      else true
    end
  )
  select
    fl.user_id,
    coalesce(sum(
      case
        when mi.media_type = 'movie' then coalesce(mi.runtime, 0)
        else 0
      end
    ), 0)::integer as movie_minutes,
    coalesce(sum(
      case
        when mi.media_type = 'tv' then coalesce(fl.total_watched_episodes, 0) * coalesce(mi.runtime, 0)
        else 0
      end
    ), 0)::integer as tv_minutes,
    (
      coalesce(sum(
        case
          when mi.media_type = 'movie' then coalesce(mi.runtime, 0)
          else 0
        end
      ), 0)
      +
      coalesce(sum(
        case
          when mi.media_type = 'tv' then coalesce(fl.total_watched_episodes, 0) * coalesce(mi.runtime, 0)
          else 0
        end
      ), 0)
    )::integer as total_minutes
  from filtered_library fl
  join public.media_items mi on mi.tmdb_id = fl.tmdb_id
  group by fl.user_id;
$$;

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
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select
    coalesce(wm.movie_minutes, 0) as movie_minutes,
    coalesce(wm.tv_minutes, 0) as tv_minutes,
    coalesce(wm.total_minutes, 0) as total_minutes
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

  return jsonb_build_object(
    'movie_minutes', movie_minutes_total,
    'tv_minutes', tv_minutes_total,
    'total_minutes', total_minutes_total,
    'genres', genres_summary
  );
end;
$$;

drop function if exists public.get_ranking(text);

create or replace function public.get_ranking(time_range text default 'all')
returns table (
  username text,
  avatar_url text,
  total_minutes integer,
  rank bigint
)
language sql
security invoker
set search_path = public
as $$
  with ranked_users as (
    select
      coalesce(
        nullif(p.username, ''),
        'Utente SFA'
      ) as username,
      coalesce(
        nullif(p.avatar_url, ''),
        'https://api.dicebear.com/7.x/adventurer/svg?seed=Default'
      ) as avatar_url,
      wm.total_minutes
    from public.get_user_watch_minutes(time_range) wm
    left join public.profiles p on p.id = wm.user_id
    where wm.total_minutes > 0
  )
  select
    ru.username,
    ru.avatar_url,
    ru.total_minutes,
    rank() over (order by ru.total_minutes desc) as rank
  from ranked_users ru
  order by ru.total_minutes desc, ru.username asc;
$$;

revoke all on function public.get_user_watch_minutes(text) from public, anon;
grant execute on function public.get_user_watch_minutes(text) to authenticated;

revoke all on function public.get_profile_stats(uuid) from public, anon;
grant execute on function public.get_profile_stats(uuid) to authenticated;

revoke all on function public.get_ranking(text) from public, anon;
grant execute on function public.get_ranking(text) to authenticated;
