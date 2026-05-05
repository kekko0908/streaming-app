create table if not exists public.release_notification_settings (
  user_id uuid not null references auth.users(id) on delete cascade,
  tmdb_id integer not null,
  media_type text not null check (media_type in ('movie', 'tv')),
  item_snapshot jsonb not null default '{}'::jsonb,
  enabled_at timestamptz not null default now(),
  read_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, tmdb_id, media_type)
);

create index if not exists release_notification_settings_user_updated_idx
  on public.release_notification_settings (user_id, updated_at desc);

alter table public.release_notification_settings enable row level security;

drop policy if exists "release_notification_settings_select_own" on public.release_notification_settings;
drop policy if exists "release_notification_settings_insert_own" on public.release_notification_settings;
drop policy if exists "release_notification_settings_update_own" on public.release_notification_settings;
drop policy if exists "release_notification_settings_delete_own" on public.release_notification_settings;

create policy "release_notification_settings_select_own"
on public.release_notification_settings
for select
to authenticated
using (auth.uid() is not null and auth.uid() = user_id);

create policy "release_notification_settings_insert_own"
on public.release_notification_settings
for insert
to authenticated
with check (auth.uid() is not null and auth.uid() = user_id);

create policy "release_notification_settings_update_own"
on public.release_notification_settings
for update
to authenticated
using (auth.uid() is not null and auth.uid() = user_id)
with check (auth.uid() is not null and auth.uid() = user_id);

create policy "release_notification_settings_delete_own"
on public.release_notification_settings
for delete
to authenticated
using (auth.uid() is not null and auth.uid() = user_id);
