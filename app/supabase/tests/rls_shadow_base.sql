-- Shadow PostgreSQL schema used only by CI to validate the RLS cutover.
-- It models the pre-migration core tables closely enough to execute the
-- repository migrations without touching the real Supabase project.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end
$$;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
grant usage on schema public, extensions to anon, authenticated, service_role;

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  status text not null default 'lobby',
  letter text,
  categories jsonb not null default '["Země","Město","Jméno","Zvíře","Věc"]'::jsonb,
  created_at timestamptz not null default now(),
  active_categories jsonb default '["Země","Město","Jméno"]'::jsonb,
  creator_tier text not null default 'free',
  max_players integer not null default 3,
  custom_category text,
  ads_enabled boolean not null default true,
  creator_token text,
  language text not null default 'cs',
  round_time_limit_seconds integer,
  round_count_limit integer
);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  is_active boolean not null default true,
  status text not null default 'active'
);

create table public.rounds (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  round_no integer not null,
  letter text not null,
  status text not null default 'playing',
  created_at timestamptz not null default now(),
  deadline_at timestamptz
);

create table public.answers (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  round integer not null default 1,
  category text not null,
  value text not null default '',
  updated_at timestamptz not null default now(),
  round_id uuid references public.rounds(id) on delete cascade,
  unique (room_id, player_id, round, category)
);

create table public.scores (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  round integer not null default 1,
  category text not null,
  points integer not null default 0,
  updated_at timestamptz not null default now(),
  value integer not null default 0,
  unique (room_id, player_id, round, category)
);

-- One deliberately legacy session proves the cutover preserves historical
-- no-token players instead of deleting them.
insert into public.rooms (
  id, code, creator_token, creator_tier, max_players, language
)
values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
  'OLD01',
  'legacy-creator-token',
  'free',
  3,
  'cs'
);

insert into public.players (
  id, room_id, name, status
)
values (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
  'Legacy',
  'active'
);
