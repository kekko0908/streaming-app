alter table public.upcoming_releases
  add column if not exists release_kind text not null default 'unknown'
    check (release_kind in ('digital', 'unknown')),
  add column if not exists verification text not null default 'unknown'
    check (verification in ('verified_it', 'unknown')),
  add column if not exists last_seen_at timestamptz not null default now();

create index if not exists upcoming_releases_verified_digital_idx
  on public.upcoming_releases (region, release_status, release_date)
  where release_kind = 'digital' and verification = 'verified_it';

create table if not exists public.release_notification_events (
  user_id uuid not null references auth.users(id) on delete cascade,
  tmdb_id integer not null,
  media_type text not null check (media_type in ('movie', 'tv')),
  event_key text not null,
  event_kind text not null check (event_kind in ('date_changed', 'released')),
  event_date date,
  title text not null,
  item_snapshot jsonb not null default '{}'::jsonb,
  previous_snapshot jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  primary key (user_id, tmdb_id, media_type, event_key)
);

create index if not exists release_notification_events_user_created_idx
  on public.release_notification_events (user_id, created_at desc);

create index if not exists release_notification_events_user_unread_idx
  on public.release_notification_events (user_id, created_at desc)
  where read_at is null;

alter table public.release_notification_events enable row level security;

drop policy if exists "release_notification_events_select_own" on public.release_notification_events;
drop policy if exists "release_notification_events_insert_own" on public.release_notification_events;
drop policy if exists "release_notification_events_update_own" on public.release_notification_events;
drop policy if exists "release_notification_events_delete_own" on public.release_notification_events;

create policy "release_notification_events_select_own"
on public.release_notification_events for select to authenticated
using (auth.uid() is not null and auth.uid() = user_id);

create policy "release_notification_events_insert_own"
on public.release_notification_events for insert to authenticated
with check (auth.uid() is not null and auth.uid() = user_id);

create policy "release_notification_events_update_own"
on public.release_notification_events for update to authenticated
using (auth.uid() is not null and auth.uid() = user_id)
with check (auth.uid() is not null and auth.uid() = user_id);

create policy "release_notification_events_delete_own"
on public.release_notification_events for delete to authenticated
using (auth.uid() is not null and auth.uid() = user_id);

grant select, insert, update, delete on table public.release_notification_events to authenticated;

with legacy_read_events as (
  select
    user_id,
    tmdb_id,
    media_type,
    coalesce(
      case when media_type = 'movie' then item_snapshot #>> '{releaseInfo,date}' end,
      case when media_type = 'movie' then item_snapshot ->> 'releaseDateFull' end,
      case when media_type = 'tv' then item_snapshot #>> '{nextEpisodeToAir,air_date}' end
    ) as event_date_text,
    coalesce(item_snapshot ->> 'title', 'Titolo monitorato') as title,
    item_snapshot,
    enabled_at,
    read_at
  from public.release_notification_settings
  where read_at is not null
)
insert into public.release_notification_events (
  user_id, tmdb_id, media_type, event_key, event_kind, event_date,
  title, item_snapshot, created_at, read_at
)
select
  user_id,
  tmdb_id,
  media_type,
  'legacy-read:' || coalesce(event_date_text, 'unknown'),
  'released',
  case when event_date_text ~ '^\d{4}-\d{2}-\d{2}$' then event_date_text::date else null end,
  title,
  item_snapshot,
  enabled_at,
  read_at
from legacy_read_events
on conflict (user_id, tmdb_id, media_type, event_key) do nothing;
