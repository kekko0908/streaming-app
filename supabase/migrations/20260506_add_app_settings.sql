create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

drop policy if exists "app_settings_select_authenticated" on public.app_settings;
drop policy if exists "app_settings_insert_admin" on public.app_settings;
drop policy if exists "app_settings_update_admin" on public.app_settings;
drop policy if exists "app_settings_delete_admin" on public.app_settings;

create policy "app_settings_select_authenticated"
on public.app_settings
for select
to authenticated
using (auth.uid() is not null);

create policy "app_settings_insert_admin"
on public.app_settings
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_admin = true
  )
);

create policy "app_settings_update_admin"
on public.app_settings
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_admin = true
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_admin = true
  )
);

create policy "app_settings_delete_admin"
on public.app_settings
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_admin = true
  )
);
