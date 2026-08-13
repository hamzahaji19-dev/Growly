alter table public.profiles
  add column if not exists username text,
  add column if not exists xp bigint not null default 0,
  add column if not exists current_streak bigint not null default 0,
  add column if not exists best_streak bigint not null default 0;

update public.profiles
set username = lower(regexp_replace(name, '[^A-Za-z0-9_]', '', 'g'))
where username is null or username = '';

create unique index if not exists profiles_username_lower_idx
  on public.profiles (lower(username));

create or replace function public.profiles_normalize_username()
returns trigger
language plpgsql
as $$
begin
  new.username := lower(btrim(new.username));
  if new.username !~ '^[a-z0-9_]{3,20}$' then
    raise exception 'Username must be 3-20 characters and can only contain letters, numbers, and underscores.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_normalize_username on public.profiles;
create trigger trg_profiles_normalize_username
  before insert or update of username on public.profiles
  for each row execute function public.profiles_normalize_username();
