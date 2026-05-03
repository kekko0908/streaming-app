create table if not exists public.user_episode_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  tmdb_id integer not null,
  season_number integer not null,
  episode_number integer not null,
  progress_seconds integer not null default 0,
  progress_minutes numeric not null default 0,
  completed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, tmdb_id, season_number, episode_number)
);

alter table public.user_episode_progress enable row level security;

drop policy if exists "user_episode_progress_select_own" on public.user_episode_progress;
drop policy if exists "user_episode_progress_insert_own" on public.user_episode_progress;
drop policy if exists "user_episode_progress_update_own" on public.user_episode_progress;
drop policy if exists "user_episode_progress_delete_own" on public.user_episode_progress;

create policy "user_episode_progress_select_own"
on public.user_episode_progress
for select
using (auth.uid() = user_id);

create policy "user_episode_progress_insert_own"
on public.user_episode_progress
for insert
with check (auth.uid() = user_id);

create policy "user_episode_progress_update_own"
on public.user_episode_progress
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "user_episode_progress_delete_own"
on public.user_episode_progress
for delete
using (auth.uid() = user_id);

create index if not exists user_episode_progress_title_idx
  on public.user_episode_progress (user_id, tmdb_id);
