-- =============================================================================
-- Growly — complete Supabase schema
-- -----------------------------------------------------------------------------
-- Derived exclusively from the existing application code (src/lib/*, src/pages/*,
-- src/hooks/*) and supabase/username_auth.sql.
--
-- The app uses username-only authentication: clients generate their own UUIDs
-- and write directly to public.profiles. There is NO Supabase auth.users flow,
-- so every table relies on the anon role (see the RLS section for the exact
-- rationale). This file is safe to run on a fresh Supabase project and is
-- idempotent (safe to re-run).
--
-- Target: PostgreSQL 15 (Supabase default). Uses gen_random_uuid() (built-in
-- since PG13) and the pre-existing `supabase_realtime` publication.
-- =============================================================================

-- =============================================================================
-- 1. profiles (username-only auth identity)
-- =============================================================================
create table if not exists public.profiles (
  id             uuid primary key default gen_random_uuid(),
  username       text not null,
  name           text not null,
  email          text not null default '',       -- required by Profile type; always stored as ''
  bio            text,
  avatar_url     text,
  xp             bigint not null default 0,
  current_streak bigint not null default 0,
  best_streak    bigint not null default 0,
  created_at     timestamptz not null default now()
);

-- Username uniqueness is case-insensitive (kept from username_auth.sql).
create unique index if not exists profiles_username_lower_idx
  on public.profiles (lower(username));

-- Username normalization + validation (kept from username_auth.sql).
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

-- Backfill usernames from display names (kept from username_auth.sql).
-- No-op on a fresh database; preserved for parity with existing data.
update public.profiles
set username = lower(regexp_replace(name, '[^A-Za-z0-9_]', '', 'g'))
where username is null or username = '';

-- =============================================================================
-- 2. challenges
-- =============================================================================
create table if not exists public.challenges (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid not null constraint challenges_owner_id_fkey references public.profiles (id),
  name              text not null,
  description       text,
  start_date        date not null,
  end_date          date not null,
  visibility        text not null default 'private' check (visibility in ('private', 'public')),
  daily_target      integer not null default 70 check (daily_target between 0 and 100),
  competitive_mode  boolean not null default false,
  proof_required    boolean not null default false,
  invite_code       text not null,
  created_at        timestamptz not null default now(),
  constraint challenges_dates_check check (end_date >= start_date)
);

create unique index if not exists challenges_invite_code_key on public.challenges (invite_code);
create index if not exists challenges_owner_id_idx on public.challenges (owner_id);
create index if not exists challenges_visibility_idx on public.challenges (visibility);

-- =============================================================================
-- 3. challenge_members
-- =============================================================================
create table if not exists public.challenge_members (
  id           uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  role         text not null default 'member' check (role in ('owner', 'member')),
  joined_at    timestamptz not null default now(),
  unique (challenge_id, user_id)
);

create index if not exists challenge_members_user_id_idx on public.challenge_members (user_id);

-- =============================================================================
-- 4. tasks
-- =============================================================================
create table if not exists public.tasks (
  id             uuid primary key default gen_random_uuid(),
  challenge_id   uuid not null references public.challenges (id) on delete cascade,
  created_by     uuid not null references public.profiles (id) on delete cascade,
  name           text not null,
  description    text,
  category       text not null check (category in ('workout', 'coding', 'reading', 'web', 'content', 'mindfulness', 'diet', 'productivity', 'other')),
  difficulty     text not null check (difficulty in ('easy', 'medium', 'hard')),
  points         integer not null default 10 check (points >= 0),
  time           text,
  repeat         text not null default 'daily' check (repeat in ('daily', 'weekdays', 'weekends')),
  proof_required boolean not null default false,
  created_at     timestamptz not null default now()
);

create index if not exists tasks_challenge_id_idx on public.tasks (challenge_id);

-- =============================================================================
-- 5. task_completions
-- =============================================================================
create table if not exists public.task_completions (
  id           uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  task_id      uuid not null references public.tasks (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  date         date not null,
  created_at   timestamptz not null default now(),
  unique (task_id, user_id, date)
);

create index if not exists task_completions_challenge_id_idx on public.task_completions (challenge_id);
create index if not exists task_completions_user_date_idx on public.task_completions (user_id, date);

-- =============================================================================
-- 6. proof_submissions
-- =============================================================================
create table if not exists public.proof_submissions (
  id            uuid primary key default gen_random_uuid(),
  challenge_id  uuid not null references public.challenges (id) on delete cascade,
  task_id       uuid not null references public.tasks (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  completion_id uuid not null references public.task_completions (id) on delete cascade,
  type          text not null check (type in ('image', 'text', 'url')),
  content       text not null,
  status        text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  -- reviewed_by is intentionally NOT an FK to profiles: proof_submissions already
  -- has an FK to profiles via user_id, and the app's `profile:profiles(*)` embed
  -- (supabase-db.ts listProofs) would become ambiguous in PostgREST with two FKs.
  reviewed_by   uuid,
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists proof_submissions_challenge_id_idx on public.proof_submissions (challenge_id);
create index if not exists proof_submissions_user_id_idx on public.proof_submissions (user_id);
create index if not exists proof_submissions_status_idx on public.proof_submissions (status);

-- =============================================================================
-- 7. activity
-- =============================================================================
create table if not exists public.activity (
  id           uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  kind         text not null,
  text         text not null,
  created_at   timestamptz not null default now()
);

create index if not exists activity_challenge_id_idx on public.activity (challenge_id);
create index if not exists activity_user_id_idx on public.activity (user_id);

-- =============================================================================
-- 8. invites
-- =============================================================================
create table if not exists public.invites (
  id           uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  code         text not null,
  created_by   uuid not null references public.profiles (id) on delete cascade,
  created_at   timestamptz not null default now()
);

create index if not exists invites_challenge_id_idx on public.invites (challenge_id);
create index if not exists invites_code_idx on public.invites (code);

-- =============================================================================
-- 9. user_achievements
-- =============================================================================
create table if not exists public.user_achievements (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  achievement_key text not null,
  unlocked_at     timestamptz not null default now(),
  unique (user_id, achievement_key)
);

-- =============================================================================
-- 10. notifications
-- =============================================================================
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  kind       text not null,
  text       text not null,
  link       text,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_id_idx on public.notifications (user_id);

-- =============================================================================
-- 11. Grants (Supabase default privileges usually cover this; explicit is safe)
-- =============================================================================
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant usage on all sequences in schema public to anon, authenticated;
grant execute on all functions in schema public to anon, authenticated;

-- =============================================================================
-- 12. Row Level Security
-- -----------------------------------------------------------------------------
-- The app authenticates purely by username and holds NO Supabase auth session,
-- so all client requests arrive as the `anon` role. RLS policies must therefore
-- permit anon full CRUD on every table for the app to function at all. Roles
-- `authenticated` are included for forward compatibility. This is an intentional
-- trust-the-client model (the same trust model the local demo uses); hardening
-- it would require switching to Supabase Auth and is documented in the review.
-- =============================================================================
alter table public.profiles enable row level security;
drop policy if exists profiles_anon_all on public.profiles;
create policy profiles_anon_all on public.profiles
  for all to anon, authenticated
  using (true) with check (true);

alter table public.challenges enable row level security;
drop policy if exists challenges_anon_all on public.challenges;
create policy challenges_anon_all on public.challenges
  for all to anon, authenticated
  using (true) with check (true);

alter table public.challenge_members enable row level security;
drop policy if exists challenge_members_anon_all on public.challenge_members;
create policy challenge_members_anon_all on public.challenge_members
  for all to anon, authenticated
  using (true) with check (true);

alter table public.tasks enable row level security;
drop policy if exists tasks_anon_all on public.tasks;
create policy tasks_anon_all on public.tasks
  for all to anon, authenticated
  using (true) with check (true);

alter table public.task_completions enable row level security;
drop policy if exists task_completions_anon_all on public.task_completions;
create policy task_completions_anon_all on public.task_completions
  for all to anon, authenticated
  using (true) with check (true);

alter table public.proof_submissions enable row level security;
drop policy if exists proof_submissions_anon_all on public.proof_submissions;
create policy proof_submissions_anon_all on public.proof_submissions
  for all to anon, authenticated
  using (true) with check (true);

alter table public.activity enable row level security;
drop policy if exists activity_anon_all on public.activity;
create policy activity_anon_all on public.activity
  for all to anon, authenticated
  using (true) with check (true);

alter table public.invites enable row level security;
drop policy if exists invites_anon_all on public.invites;
create policy invites_anon_all on public.invites
  for all to anon, authenticated
  using (true) with check (true);

alter table public.user_achievements enable row level security;
drop policy if exists user_achievements_anon_all on public.user_achievements;
create policy user_achievements_anon_all on public.user_achievements
  for all to anon, authenticated
  using (true) with check (true);

alter table public.notifications enable row level security;
drop policy if exists notifications_anon_all on public.notifications;
create policy notifications_anon_all on public.notifications
  for all to anon, authenticated
  using (true) with check (true);

-- =============================================================================
-- 13. Storage — `proofs` bucket
-- -----------------------------------------------------------------------------
-- Used by the app for BOTH avatar uploads (avatars/<user_id>/...) and proof
-- files. The app calls .upload() and .getPublicUrl(), so the bucket must be
-- public and anon must be able to insert/update objects.
-- =============================================================================
insert into storage.buckets (id, name, public)
values ('proofs', 'proofs', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists proofs_public_read on storage.objects;
create policy proofs_public_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'proofs');

drop policy if exists proofs_public_insert on storage.objects;
create policy proofs_public_insert on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'proofs');

drop policy if exists proofs_public_update on storage.objects;
create policy proofs_public_update on storage.objects
  for update to anon, authenticated
  using (bucket_id = 'proofs') with check (bucket_id = 'proofs');

drop policy if exists proofs_public_delete on storage.objects;
create policy proofs_public_delete on storage.objects
  for delete to anon, authenticated
  using (bucket_id = 'proofs');

-- =============================================================================
-- 14. Realtime
-- -----------------------------------------------------------------------------
-- The app subscribes to postgres_changes on schema `public` filtered by
-- challenge_id / user_id. Tables must be members of the supabase_realtime
-- publication for those events to be delivered.
-- =============================================================================
do $$
declare
  t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array[
      'profiles',
      'challenges',
      'challenge_members',
      'tasks',
      'task_completions',
      'proof_submissions',
      'activity',
      'invites',
      'user_achievements',
      'notifications'
    ]
    loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = t
      ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end
$$;
