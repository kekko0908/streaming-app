create or replace function public.get_community_top_titles(period_days integer default 30)
returns table (
  tmdb_id bigint,
  title text,
  media_type text,
  poster_path text,
  watched_count integer,
  completed_count integer,
  community_rating numeric,
  last_activity_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  select
    mi.tmdb_id,
    mi.title,
    mi.media_type,
    coalesce(mi.poster_path, '') as poster_path,
    count(distinct ul.user_id) filter (
      where ul.status in ('in-corso', 'gia-guardato')
         or coalesce(ul.total_watched_episodes, 0) > 0
    )::integer as watched_count,
    count(distinct ul.user_id) filter (where ul.status = 'gia-guardato')::integer as completed_count,
    coalesce(round(avg(nullif(ul.rating, 0))::numeric, 1), 0)::numeric as community_rating,
    max(coalesce(ul.last_watched_at, ul.added_at)) as last_activity_at
  from public.user_library ul
  join public.media_items mi on mi.tmdb_id = ul.tmdb_id
  where (select auth.uid()) is not null
    and coalesce(ul.last_watched_at, ul.added_at) >= now() - make_interval(days => least(greatest(period_days, 1), 365))
    and (
      ul.status in ('in-corso', 'gia-guardato')
      or coalesce(ul.total_watched_episodes, 0) > 0
      or coalesce(ul.rating, 0) > 0
    )
  group by mi.tmdb_id, mi.title, mi.media_type, mi.poster_path
  order by
    count(distinct ul.user_id) filter (
      where ul.status in ('in-corso', 'gia-guardato')
         or coalesce(ul.total_watched_episodes, 0) > 0
    ) desc,
    count(distinct ul.user_id) filter (where ul.status = 'gia-guardato') desc,
    coalesce(round(avg(nullif(ul.rating, 0))::numeric, 1), 0) desc,
    max(coalesce(ul.last_watched_at, ul.added_at)) desc,
    mi.title asc
  limit 10;
$$;

revoke all on function public.get_community_top_titles(integer) from public, anon;
grant execute on function public.get_community_top_titles(integer) to authenticated;
