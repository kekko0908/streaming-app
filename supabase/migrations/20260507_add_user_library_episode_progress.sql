alter table if exists public.user_library
  add column if not exists current_season integer,
  add column if not exists current_episode integer,
  add column if not exists total_watched_episodes integer,
  add column if not exists progress_seconds integer default 0,
  add column if not exists progress_minutes numeric default 0,
  add column if not exists "current_time" integer default 0,
  add column if not exists last_watched_at timestamptz;

create index if not exists user_library_last_watched_at_idx
  on public.user_library (last_watched_at desc);
