alter table if exists public.profiles enable row level security;
alter table if exists public.user_library enable row level security;
alter table if exists public.suggestions enable row level security;
alter table if exists public.media_items enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;

create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (auth.uid() is not null and auth.uid() = id);

create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (auth.uid() is not null and auth.uid() = id);

create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (auth.uid() is not null and auth.uid() = id)
with check (auth.uid() is not null and auth.uid() = id);

drop policy if exists "user_library_select_own" on public.user_library;
drop policy if exists "user_library_insert_own" on public.user_library;
drop policy if exists "user_library_update_own" on public.user_library;
drop policy if exists "user_library_delete_own" on public.user_library;

create policy "user_library_select_own"
on public.user_library
for select
to authenticated
using (auth.uid() is not null and auth.uid() = user_id);

create policy "user_library_insert_own"
on public.user_library
for insert
to authenticated
with check (auth.uid() is not null and auth.uid() = user_id);

create policy "user_library_update_own"
on public.user_library
for update
to authenticated
using (auth.uid() is not null and auth.uid() = user_id)
with check (auth.uid() is not null and auth.uid() = user_id);

create policy "user_library_delete_own"
on public.user_library
for delete
to authenticated
using (auth.uid() is not null and auth.uid() = user_id);

drop policy if exists "suggestions_select_authenticated" on public.suggestions;
drop policy if exists "suggestions_insert_own" on public.suggestions;
drop policy if exists "suggestions_delete_own" on public.suggestions;

create policy "suggestions_select_authenticated"
on public.suggestions
for select
to authenticated
using (true);

create policy "suggestions_insert_own"
on public.suggestions
for insert
to authenticated
with check (auth.uid() is not null and auth.uid() = user_id);

create policy "suggestions_delete_own"
on public.suggestions
for delete
to authenticated
using (auth.uid() is not null and auth.uid() = user_id);

drop policy if exists "media_items_select_authenticated" on public.media_items;
drop policy if exists "media_items_insert_authenticated" on public.media_items;
drop policy if exists "media_items_update_authenticated" on public.media_items;
drop policy if exists "media_items_delete_authenticated" on public.media_items;

create policy "media_items_select_authenticated"
on public.media_items
for select
to authenticated
using (true);

revoke all on function public.get_profile_stats(uuid) from public, anon;
grant execute on function public.get_profile_stats(uuid) to authenticated;

revoke all on function public.get_community_activity() from public, anon;
grant execute on function public.get_community_activity() to authenticated;

revoke all on function public.get_ranking(text) from public, anon;
grant execute on function public.get_ranking(text) to authenticated;

revoke all on function public.get_ranking_avg_rating(text) from public, anon;
grant execute on function public.get_ranking_avg_rating(text) to authenticated;

revoke all on function public.get_ranking_planned(text) from public, anon;
grant execute on function public.get_ranking_planned(text) to authenticated;
