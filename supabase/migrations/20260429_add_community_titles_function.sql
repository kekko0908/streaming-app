drop function if exists public.get_community_titles(text);

create function public.get_community_titles(sort_mode text default 'watched')
returns table (
  tmdb_id bigint,
  title text,
  media_type text,
  poster_path text,
  listed_count integer,
  watched_count integer,
  completed_count integer,
  rated_count integer,
  community_rating numeric,
  community_score numeric
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with title_stats as (
    select
      mi.tmdb_id,
      mi.title,
      mi.media_type,
      coalesce(mi.poster_path, '') as poster_path,
      count(distinct ul.user_id)::integer as listed_count,
      count(
        distinct case
          when ul.status in ('in-corso', 'gia-guardato')
            or coalesce(ul.total_watched_episodes, 0) > 0
            or coalesce(ul.rating, 0) > 0
          then ul.user_id
        end
      )::integer as watched_count,
      count(distinct case when ul.status = 'gia-guardato' then ul.user_id end)::integer as completed_count,
      count(distinct case when coalesce(ul.rating, 0) > 0 then ul.user_id end)::integer as rated_count,
      coalesce(round(avg(nullif(ul.rating, 0))::numeric, 1), 0)::numeric as community_rating
    from public.user_library ul
    join public.media_items mi on mi.tmdb_id = ul.tmdb_id
    group by mi.tmdb_id, mi.title, mi.media_type, mi.poster_path
  ),
  ranked_titles as (
    select
      ts.*,
      round(
        (
          ts.listed_count * 1.0
          + ts.watched_count * 2.0
          + ts.completed_count * 2.0
          + ts.rated_count * 1.5
          + ts.community_rating * 4.0
        )::numeric,
        1
      ) as community_score
    from title_stats ts
    where ts.listed_count > 0
  )
  select
    rt.tmdb_id,
    rt.title,
    rt.media_type,
    rt.poster_path,
    rt.listed_count,
    rt.watched_count,
    rt.completed_count,
    rt.rated_count,
    rt.community_rating,
    rt.community_score
  from ranked_titles rt
  order by
    case when lower(sort_mode) = 'loved' then rt.community_score end desc nulls last,
    case when lower(sort_mode) = 'watched' then rt.watched_count end desc nulls last,
    rt.completed_count desc,
    rt.listed_count desc,
    rt.title asc
  limit 20;
end;
$$;

revoke all on function public.get_community_titles(text) from public, anon;
grant execute on function public.get_community_titles(text) to authenticated;
