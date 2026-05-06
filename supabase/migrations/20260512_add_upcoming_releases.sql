create table if not exists public.upcoming_releases (
  tmdb_id integer not null,
  media_type text not null check (media_type in ('movie', 'tv')),
  title text not null,
  poster text not null default '',
  backdrop text not null default '',
  release_date date not null,
  region text not null default 'IT',
  source text not null default 'tmdb_upcoming',
  release_status text not null default 'upcoming' check (release_status in ('upcoming', 'released', 'removed')),
  item_snapshot jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_checked_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tmdb_id, media_type, region)
);

create index if not exists upcoming_releases_region_date_idx
  on public.upcoming_releases (region, release_date asc);

create index if not exists upcoming_releases_status_date_idx
  on public.upcoming_releases (release_status, release_date asc);

create index if not exists upcoming_releases_tmdb_idx
  on public.upcoming_releases (tmdb_id, media_type);

alter table public.upcoming_releases enable row level security;

drop policy if exists "upcoming_releases_select_authenticated" on public.upcoming_releases;
drop policy if exists "upcoming_releases_insert_service_role" on public.upcoming_releases;
drop policy if exists "upcoming_releases_update_service_role" on public.upcoming_releases;
drop policy if exists "upcoming_releases_delete_service_role" on public.upcoming_releases;

create policy "upcoming_releases_select_authenticated"
on public.upcoming_releases
for select
to authenticated
using (true);

create policy "upcoming_releases_insert_service_role"
on public.upcoming_releases
for insert
to service_role
with check (true);

create policy "upcoming_releases_update_service_role"
on public.upcoming_releases
for update
to service_role
using (true)
with check (true);

create policy "upcoming_releases_delete_service_role"
on public.upcoming_releases
for delete
to service_role
using (true);

grant select on table public.upcoming_releases to authenticated;
