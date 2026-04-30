alter table if exists public.profiles
add column if not exists is_admin boolean not null default false;

create or replace function public.protect_profile_admin_flag()
returns trigger
language plpgsql
as $$
begin
  if auth.role() <> 'service_role' then
    if tg_op = 'INSERT' then
      new.is_admin := false;
    elsif tg_op = 'UPDATE' then
      new.is_admin := old.is_admin;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_profile_admin_flag on public.profiles;

create trigger protect_profile_admin_flag
before insert or update on public.profiles
for each row
execute function public.protect_profile_admin_flag();

update public.profiles p
set is_admin = true
from auth.users au
where au.id = p.id
  and lower(au.email) = 'driixgaming99@gmail.com';

insert into public.profiles (id, is_admin)
select au.id, true
from auth.users au
where lower(au.email) = 'driixgaming99@gmail.com'
  and not exists (
    select 1
    from public.profiles p
    where p.id = au.id
  );
