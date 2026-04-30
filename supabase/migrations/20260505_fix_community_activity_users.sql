drop function if exists public.get_community_activity();

create or replace function public.get_community_activity()
returns table (
  user_name text,
  user_avatar text,
  action_type text,
  media_title text,
  media_poster text,
  media_type text,
  tmdb_id text,
  rating numeric,
  season integer,
  episode integer,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  with identity_source as (
    select
      au.id,
      coalesce(
        nullif(p.username, ''),
        nullif(au.raw_user_meta_data->>'full_name', ''),
        nullif(split_part(au.email, '@', 1), ''),
        'Utente SFA'
      ) as user_name,
      coalesce(
        nullif(p.avatar_url, ''),
        nullif(au.raw_user_meta_data->>'avatar_url', ''),
        nullif(au.raw_user_meta_data->>'picture', ''),
        'https://api.dicebear.com/7.x/adventurer/svg?seed=Default'
      ) as user_avatar
    from auth.users au
    left join public.profiles p on p.id = au.id
  ),
  library_activity as (
    select
      ids.user_name,
      ids.user_avatar,
      case
        when ul.status = 'gia-guardato' then 'completed'
        when coalesce(ul.rating, 0) > 0 then 'vote'
        when ul.status = 'in-corso' then 'watching'
        when ul.status in ('da-guardare', 'pianificato') then 'plan'
        else 'added'
      end as action_type,
      coalesce(mi.title, 'Titolo sconosciuto') as media_title,
      coalesce(mi.poster_path, '') as media_poster,
      coalesce(mi.media_type, 'movie') as media_type,
      ul.tmdb_id::text as tmdb_id,
      coalesce(ul.rating, 0)::numeric as rating,
      ul.current_season as season,
      ul.current_episode as episode,
      ul.added_at as created_at
    from public.user_library ul
    join public.media_items mi on mi.tmdb_id = ul.tmdb_id
    join identity_source ids on ids.id = ul.user_id
    where ul.status in ('in-corso', 'gia-guardato', 'da-guardare', 'pianificato')
  ),
  suggestion_activity as (
    select
      coalesce(nullif(s.user_name, ''), ids.user_name) as user_name,
      coalesce(nullif(s.user_avatar, ''), ids.user_avatar) as user_avatar,
      'suggested'::text as action_type,
      coalesce(s.tmdb_data->>'title', 'Titolo consigliato') as media_title,
      coalesce(s.tmdb_data->>'poster', '') as media_poster,
      coalesce(s.media_type, s.tmdb_data->>'type', 'movie') as media_type,
      s.tmdb_id::text as tmdb_id,
      0::numeric as rating,
      null::integer as season,
      null::integer as episode,
      s.created_at
    from public.suggestions s
    join identity_source ids on ids.id = s.user_id
  )
  select *
  from (
    select * from library_activity
    union all
    select * from suggestion_activity
  ) combined
  order by created_at desc
  limit 30;
$$;

revoke all on function public.get_community_activity() from public, anon;
grant execute on function public.get_community_activity() to authenticated;
