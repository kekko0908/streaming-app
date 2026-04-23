drop function if exists public.get_profile_stats(uuid);

create or replace function public.get_profile_stats(target_user_id uuid default null)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  movie_minutes_total integer := 0;
  tv_minutes_total integer := 0;
  genres_summary jsonb := '{}'::jsonb;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select
    coalesce(sum(
      case
        when mi.media_type = 'movie' then coalesce(mi.runtime, 0)
        else 0
      end
    ), 0)::integer,
    coalesce(sum(
      case
        when mi.media_type = 'tv' then coalesce(ul.total_watched_episodes, 0) * coalesce(mi.runtime, 0)
        else 0
      end
    ), 0)::integer
  into movie_minutes_total, tv_minutes_total
  from public.user_library ul
  join public.media_items mi on mi.tmdb_id = ul.tmdb_id
  where ul.user_id = current_user_id;

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
    'genres', genres_summary
  );
end;
$$;

revoke all on function public.get_profile_stats(uuid) from public, anon;
grant execute on function public.get_profile_stats(uuid) to authenticated;
