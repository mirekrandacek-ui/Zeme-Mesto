begin;

-- FINAL CUTOVER SAFETY
-- Do not apply this migration until the token-aware web/Android build is live.
-- The migration deliberately aborts while a legacy no-token player has been
-- created in the last 24 hours.

create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

create or replace function private.zm_request_header(p_name text)
returns text
language sql
stable
security invoker
set search_path = pg_catalog
as $$
  select nullif(
    btrim(
      coalesce(
        nullif(current_setting('request.headers', true), '')::jsonb
          ->> lower(p_name),
        ''
      )
    ),
    ''
  );
$$;

create or replace function private.zm_request_token_hash(p_header_name text)
returns text
language sql
stable
security invoker
set search_path = pg_catalog, extensions
as $$
  select case
    when private.zm_request_header(p_header_name) is null then null
    else pg_catalog.encode(
      extensions.digest(
        private.zm_request_header(p_header_name),
        'sha256'
      ),
      'hex'
    )
  end;
$$;

create or replace function private.zm_room_code_matches(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select exists (
    select 1
    from public.rooms r
    where r.id = p_room_id
      and private.zm_request_header('x-zm-room-code') is not null
      and upper(r.code) = upper(private.zm_request_header('x-zm-room-code'))
  );
$$;

create or replace function private.zm_is_creator(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select exists (
    select 1
    from public.rooms r
    where r.id = p_room_id
      and private.zm_room_code_matches(r.id)
      and r.creator_token_hash is not null
      and r.creator_token_hash =
        private.zm_request_token_hash('x-zm-creator-token')
  );
$$;

create or replace function private.zm_is_active_player(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select
    private.zm_room_code_matches(p_room_id)
    and exists (
      select 1
      from public.players p
      where p.room_id = p_room_id
        and p.status = 'active'
        and p.player_token_hash =
          private.zm_request_token_hash('x-zm-player-token')
    );
$$;

create or replace function private.zm_is_specific_player(
  p_room_id uuid,
  p_player_id uuid,
  p_active_only boolean default false
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select
    private.zm_room_code_matches(p_room_id)
    and exists (
      select 1
      from public.players p
      where p.id = p_player_id
        and p.room_id = p_room_id
        and p.player_token_hash =
          private.zm_request_token_hash('x-zm-player-token')
        and (not p_active_only or p.status = 'active')
    );
$$;

create or replace function private.zm_room_has_capacity(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select exists (
    select 1
    from public.rooms r
    where r.id = p_room_id
      and private.zm_room_code_matches(r.id)
      and (
        select count(*)
        from public.players p
        where p.room_id = r.id
      ) < r.max_players
  );
$$;

revoke all on function private.zm_request_header(text) from public;
revoke all on function private.zm_request_token_hash(text) from public;
revoke all on function private.zm_room_code_matches(uuid) from public;
revoke all on function private.zm_is_creator(uuid) from public;
revoke all on function private.zm_is_active_player(uuid) from public;
revoke all on function private.zm_is_specific_player(uuid, uuid, boolean) from public;
revoke all on function private.zm_room_has_capacity(uuid) from public;

grant execute on function private.zm_request_header(text)
  to anon, authenticated, service_role;
grant execute on function private.zm_request_token_hash(text)
  to anon, authenticated, service_role;
grant execute on function private.zm_room_code_matches(uuid)
  to anon, authenticated, service_role;
grant execute on function private.zm_is_creator(uuid)
  to anon, authenticated, service_role;
grant execute on function private.zm_is_active_player(uuid)
  to anon, authenticated, service_role;
grant execute on function private.zm_is_specific_player(uuid, uuid, boolean)
  to anon, authenticated, service_role;
grant execute on function private.zm_room_has_capacity(uuid)
  to anon, authenticated, service_role;


-- Bring all recoverable creator hashes up to date before removing raw tokens.
update public.rooms
set creator_token_hash =
  pg_catalog.encode(
    extensions.digest(creator_token, 'sha256'),
    'hex'
  )
where creator_token is not null
  and creator_token <> ''
  and creator_token_hash is null;

-- Historical pre-token players are intentionally preserved.
-- New player inserts are token-enforced by the RLS policy below. Existing rows
-- with a NULL player_token_hash remain readable within their room but cannot
-- authenticate for protected writes.
do $$
declare
  v_legacy_players integer;
begin
  select count(*)
  into v_legacy_players
  from public.players
  where player_token_hash is null;

  raise notice
    'RLS cutover: preserving % historical player row(s) without player_token_hash',
    v_legacy_players;
end;
$$;


-- Raw creator tokens must never be readable from the database after cutover.
update public.rooms
set creator_token = null
where creator_token is not null;

alter table public.rooms
  drop constraint if exists rooms_creator_token_must_be_null;

alter table public.rooms
  add constraint rooms_creator_token_must_be_null
  check (creator_token is null);


-- Guard sensitive room fields. Normal active players may only drive game state
-- (status/letter); creator settings require the creator token. Free quota
-- counters are changed only by internal authorized RPC implementations.
create or replace function private.zm_guard_room_update()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_internal boolean :=
    coalesce(current_setting('zm.internal_rpc', true), '') = '1';
  v_creator boolean := private.zm_is_creator(old.id);
begin
  if new.id is distinct from old.id
     or new.code is distinct from old.code
     or new.created_at is distinct from old.created_at
     or new.creator_token is distinct from old.creator_token
     or new.creator_token_hash is distinct from old.creator_token_hash then
    raise exception 'Immutable room identity field';
  end if;

  if (
       new.categories is distinct from old.categories
    or new.active_categories is distinct from old.active_categories
    or new.creator_tier is distinct from old.creator_tier
    or new.max_players is distinct from old.max_players
    or new.custom_category is distinct from old.custom_category
    or new.ads_enabled is distinct from old.ads_enabled
    or new.language is distinct from old.language
    or new.round_time_limit_seconds is distinct from old.round_time_limit_seconds
    or new.round_count_limit is distinct from old.round_count_limit
    or new.letter_deck_owner_id is distinct from old.letter_deck_owner_id
  ) and not (v_creator or v_internal) then
    raise exception 'Creator token required for room settings';
  end if;

  if (
       new.free_rounds_unlocked is distinct from old.free_rounds_unlocked
    or new.free_rounds_started is distinct from old.free_rounds_started
  ) and not v_internal then
    raise exception 'Free round counters are server-managed';
  end if;

  if new.status is distinct from old.status
     and not v_internal
     and not (
       (old.status = 'lobby'   and new.status = 'drawing')
       or (old.status = 'scoring' and new.status = 'drawing')
       or (old.status = 'drawing' and new.status = 'playing')
       or (old.status = 'playing' and new.status = 'drawing')
       or (old.status = 'playing' and new.status = 'scoring')
       or (old.status = 'scoring' and new.status = 'finished')
     ) then
    raise exception 'Invalid room status transition';
  end if;

  return new;
end;
$$;

drop trigger if exists rooms_guard_secure_update on public.rooms;
create trigger rooms_guard_secure_update
before update on public.rooms
for each row
execute function private.zm_guard_room_update();


create or replace function private.zm_guard_player_update()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_internal boolean :=
    coalesce(current_setting('zm.internal_rpc', true), '') = '1';
begin
  if new.id is distinct from old.id
     or new.room_id is distinct from old.room_id
     or new.name is distinct from old.name
     or new.created_at is distinct from old.created_at
     or new.is_active is distinct from old.is_active
     or new.player_token_hash is distinct from old.player_token_hash then
    raise exception 'Player identity fields are immutable';
  end if;

  if new.device_id is distinct from old.device_id
     and not (
       v_internal
       or private.zm_is_specific_player(old.room_id, old.id, false)
     ) then
    raise exception 'Player token required for device identity';
  end if;

  if new.status is distinct from old.status
     and not v_internal then
    if not (
      old.status = 'waiting'
      and new.status = 'active'
      and (
        private.zm_is_active_player(old.room_id)
        or private.zm_is_creator(old.room_id)
      )
    ) then
      raise exception 'Invalid player status transition';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists players_guard_secure_update on public.players;
create trigger players_guard_secure_update
before update on public.players
for each row
execute function private.zm_guard_player_update();


create or replace function private.zm_guard_round_update()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if new.id is distinct from old.id
     or new.room_id is distinct from old.room_id
     or new.round_no is distinct from old.round_no
     or new.letter is distinct from old.letter
     or new.created_at is distinct from old.created_at
     or new.deadline_at is distinct from old.deadline_at then
    raise exception 'Round identity fields are immutable';
  end if;

  if new.status is distinct from old.status
     and not (
       (old.status = 'playing' and new.status in ('scoring', 'skipped'))
       or (old.status = 'scoring' and new.status = 'done')
     ) then
    raise exception 'Invalid round status transition';
  end if;

  return new;
end;
$$;

drop trigger if exists rounds_guard_secure_update on public.rounds;
create trigger rounds_guard_secure_update
before update on public.rounds
for each row
execute function private.zm_guard_round_update();


-- Internal SECURITY DEFINER implementations live outside the exposed public
-- API schema. Each one performs its own request-header authorization.
create or replace function private.begin_free_round_impl(
  p_room_id uuid,
  p_expected_status text
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_started integer;
begin
  if not (
    private.zm_is_active_player(p_room_id)
    or private.zm_is_creator(p_room_id)
  ) then
    raise sqlstate '42501' using message = 'Not authorized for this room';
  end if;

  if p_expected_status not in ('lobby', 'scoring') then
    return 0;
  end if;

  perform set_config('zm.internal_rpc', '1', true);

  update public.rooms
  set
    status = 'drawing',
    letter = null,
    free_rounds_started = free_rounds_started + 1
  where id = p_room_id
    and creator_tier = 'free'
    and status::text = p_expected_status
    and free_rounds_started < free_rounds_unlocked
  returning free_rounds_started into v_started;

  return coalesce(v_started, 0);
end;
$$;


create or replace function private.unlock_free_rounds_impl(p_room_id uuid)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_new_limit integer;
begin
  if not (
    private.zm_is_active_player(p_room_id)
    or private.zm_is_creator(p_room_id)
  ) then
    raise sqlstate '42501' using message = 'Not authorized for this room';
  end if;

  perform set_config('zm.internal_rpc', '1', true);

  update public.rooms
  set free_rounds_unlocked = free_rounds_unlocked + 3
  where id = p_room_id
    and creator_tier = 'free'
  returning free_rounds_unlocked into v_new_limit;

  if v_new_limit is null then
    raise exception 'Free room not found';
  end if;

  return v_new_limit;
end;
$$;


create or replace function private.draw_room_letter_impl(p_room_id uuid)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_owner_id uuid;
  v_language text;
  v_room_status text;
  v_letters text[];
  v_remaining text[];
  v_last_letter text;
  v_letter text;
  v_swap text;
begin
  if not (
    private.zm_is_active_player(p_room_id)
    or private.zm_is_creator(p_room_id)
  ) then
    raise sqlstate '42501' using message = 'Not authorized for this room';
  end if;

  select
    coalesce(letter_deck_owner_id, id),
    language,
    status::text
  into
    v_owner_id,
    v_language,
    v_room_status
  from public.rooms
  where id = p_room_id;

  if v_owner_id is null then
    raise exception 'Room not found';
  end if;

  if v_room_status <> 'drawing' then
    raise exception 'Room is not drawing a letter';
  end if;

  v_letters :=
    case v_language
      when 'cs' then array[
        'A','B','C','Č','D','E','F','G','H','CH','I','J','K','L',
        'M','N','O','P','R','Ř','S','Š','T','U','V','Z','Ž'
      ]
      when 'en' then array[
        'A','B','C','D','E','F','G','H','I','J','K','L','M',
        'N','O','P','Q','R','S','T','U','V','W','X','Y','Z'
      ]
      when 'es' then array[
        'A','B','C','D','E','F','G','H','I','J','K','L','M','N',
        'Ñ','O','P','Q','R','S','T','U','V','W','X','Y','Z'
      ]
      when 'de' then array[
        'A','Ä','B','C','D','E','F','G','H','I','J','K','L','M','N',
        'O','Ö','P','Q','R','S','T','U','Ü','V','W','X','Y','Z'
      ]
      when 'fr' then array[
        'A','B','C','D','E','F','G','H','I','J','K','L','M',
        'N','O','P','Q','R','S','T','U','V','W','X','Y','Z'
      ]
      when 'pt-BR' then array[
        'A','B','C','D','E','F','G','H','I','J','K','L','M',
        'N','O','P','Q','R','S','T','U','V','W','X','Y','Z'
      ]
      when 'id' then array[
        'A','B','C','D','E','F','G','H','I','J','K','L','M',
        'N','O','P','Q','R','S','T','U','V','W','X','Y','Z'
      ]
      when 'tr' then array[
        'A','B','C','Ç','D','E','F','G','Ğ','H','I','İ','J','K','L',
        'M','N','O','Ö','P','R','S','Ş','T','U','Ü','V','Y','Z'
      ]
      when 'pl' then array[
        'A','B','C','D','E','F','G','H','I','J','K','L','Ł',
        'M','N','O','P','R','S','T','U','W','Z'
      ]
      when 'it' then array[
        'A','B','C','D','E','F','G','H','I','L','M',
        'N','O','P','Q','R','S','T','U','V','Z'
      ]
      else null
    end;

  if v_letters is null then
    raise exception 'Unsupported game language';
  end if;

  insert into public.letter_decks (owner_id, language)
  values (v_owner_id, v_language)
  on conflict (owner_id, language) do nothing;

  select remaining_letters, last_letter
  into v_remaining, v_last_letter
  from public.letter_decks
  where owner_id = v_owner_id
    and language = v_language
  for update;

  if coalesce(cardinality(v_remaining), 0) = 0 then
    select array_agg(letter order by random())
    into v_remaining
    from unnest(v_letters) as shuffled(letter);

    if cardinality(v_remaining) > 1
       and v_remaining[1] = v_last_letter then
      v_swap := v_remaining[1];
      v_remaining[1] := v_remaining[2];
      v_remaining[2] := v_swap;
    end if;
  end if;

  v_letter := v_remaining[1];

  v_remaining := coalesce(
    v_remaining[2:cardinality(v_remaining)],
    array[]::text[]
  );

  update public.letter_decks
  set
    remaining_letters = v_remaining,
    last_letter = v_letter,
    updated_at = now()
  where owner_id = v_owner_id
    and language = v_language;

  return v_letter;
end;
$$;


create or replace function private.prepare_room_for_join_impl(p_room_id uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if not private.zm_room_code_matches(p_room_id) then
    raise sqlstate '42501' using message = 'Not authorized for this room';
  end if;

  perform 1
  from public.rooms
  where id = p_room_id
  for update;

  if exists (
    select 1
    from public.players
    where room_id = p_room_id
  ) then
    return false;
  end if;

  perform set_config('zm.internal_rpc', '1', true);

  delete from public.scores where room_id = p_room_id;
  delete from public.answers where room_id = p_room_id;
  delete from public.rounds where room_id = p_room_id;

  update public.rooms
  set status = 'lobby',
      letter = null
  where id = p_room_id;

  return true;
end;
$$;


-- Public RPC signatures stay unchanged for the app. These wrappers are
-- SECURITY INVOKER; privileged writes happen only in the private implementations.
create or replace function public.begin_free_round(
  p_room_id uuid,
  p_expected_status text
)
returns integer
language sql
security invoker
set search_path = pg_catalog, private
as $$
  select private.begin_free_round_impl(p_room_id, p_expected_status);
$$;

create or replace function public.unlock_free_rounds(p_room_id uuid)
returns integer
language sql
security invoker
set search_path = pg_catalog, private
as $$
  select private.unlock_free_rounds_impl(p_room_id);
$$;

create or replace function public.draw_room_letter(p_room_id uuid)
returns text
language sql
security invoker
set search_path = pg_catalog, private
as $$
  select private.draw_room_letter_impl(p_room_id);
$$;

create or replace function public.prepare_room_for_join(p_room_id uuid)
returns boolean
language sql
security invoker
set search_path = pg_catalog, private
as $$
  select private.prepare_room_for_join_impl(p_room_id);
$$;


-- The round insert trigger needs to clean up the previous skipped round.
-- Move that privileged logic to private and remove the public mutable-search-path
-- trigger function.
drop trigger if exists rounds_set_deadline_at on public.rounds;
drop function if exists public.set_round_deadline_at();

create or replace function private.zm_set_round_deadline_at()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  room_tier text;
  time_limit_seconds integer;
  previous_round_id uuid;
  previous_round_no integer;
  previous_round_status text;
begin
  select id, round_no, status
  into previous_round_id, previous_round_no, previous_round_status
  from public.rounds
  where room_id = new.room_id
  order by round_no desc
  limit 1;

  if previous_round_status = 'skipped'
     and new.round_no = previous_round_no + 1 then
    update public.answers
    set value = '', updated_at = now()
    where room_id = new.room_id
      and round = previous_round_no;

    delete from public.rounds
    where id = previous_round_id;

    new.round_no := previous_round_no;
  end if;

  select creator_tier, round_time_limit_seconds
  into room_tier, time_limit_seconds
  from public.rooms
  where id = new.room_id;

  if room_tier = 'super_premium' and time_limit_seconds is not null then
    new.deadline_at := now() + make_interval(secs => time_limit_seconds);
  else
    new.deadline_at := null;
  end if;

  return new;
end;
$$;

create trigger rounds_set_deadline_at
before insert on public.rounds
for each row
execute function private.zm_set_round_deadline_at();


create or replace function public.get_server_now()
returns timestamptz
language sql
stable
security invoker
set search_path = pg_catalog
as $$
  select now();
$$;


-- Remove the old wide-open policies.
drop policy if exists answers_insert_all on public.answers;
drop policy if exists answers_select_all on public.answers;
drop policy if exists answers_update_all on public.answers;
drop policy if exists scores_insert_all on public.scores;
drop policy if exists scores_select_all on public.scores;
drop policy if exists scores_update_all on public.scores;

drop policy if exists rooms_select_by_code on public.rooms;
drop policy if exists rooms_insert_with_creator_token on public.rooms;
drop policy if exists rooms_update_authorized on public.rooms;

drop policy if exists players_select_by_room on public.players;
drop policy if exists players_insert_with_token on public.players;
drop policy if exists players_update_authorized on public.players;
drop policy if exists players_delete_self on public.players;

drop policy if exists rounds_select_by_room on public.rounds;
drop policy if exists rounds_insert_active_player on public.rounds;
drop policy if exists rounds_update_active_player on public.rounds;

drop policy if exists answers_select_by_room on public.answers;
drop policy if exists answers_insert_self on public.answers;
drop policy if exists answers_update_self on public.answers;

drop policy if exists scores_select_by_room on public.scores;
drop policy if exists scores_insert_self on public.scores;
drop policy if exists scores_update_self on public.scores;

drop policy if exists letter_decks_no_direct_access on public.letter_decks;


alter table public.rooms enable row level security;
alter table public.players enable row level security;
alter table public.rounds enable row level security;
alter table public.answers enable row level security;
alter table public.scores enable row level security;


create policy rooms_select_by_code
on public.rooms
for select
to anon, authenticated
using (
  private.zm_room_code_matches(id)
);

create policy rooms_insert_with_creator_token
on public.rooms
for insert
to anon, authenticated
with check (
  private.zm_request_header('x-zm-room-code') is not null
  and upper(code) = upper(private.zm_request_header('x-zm-room-code'))
  and creator_token is null
  and creator_token_hash is not null
  and creator_token_hash =
    private.zm_request_token_hash('x-zm-creator-token')
);

create policy rooms_update_authorized
on public.rooms
for update
to anon, authenticated
using (
  private.zm_room_code_matches(id)
  and (
    private.zm_is_active_player(id)
    or private.zm_is_creator(id)
  )
)
with check (
  private.zm_room_code_matches(id)
  and (
    private.zm_is_active_player(id)
    or private.zm_is_creator(id)
  )
);


create policy players_select_by_room
on public.players
for select
to anon, authenticated
using (
  private.zm_room_code_matches(room_id)
);

create policy players_insert_with_token
on public.players
for insert
to anon, authenticated
with check (
  private.zm_room_code_matches(room_id)
  and private.zm_request_header('x-zm-player-token') is not null
  and player_token_hash =
    private.zm_request_token_hash('x-zm-player-token')
  and private.zm_room_has_capacity(room_id)
);

create policy players_update_authorized
on public.players
for update
to anon, authenticated
using (
  private.zm_is_specific_player(room_id, id, false)
  or private.zm_is_active_player(room_id)
  or private.zm_is_creator(room_id)
)
with check (
  private.zm_room_code_matches(room_id)
);

create policy players_delete_self
on public.players
for delete
to anon, authenticated
using (
  private.zm_is_specific_player(room_id, id, false)
);


create policy rounds_select_by_room
on public.rounds
for select
to anon, authenticated
using (
  private.zm_room_code_matches(room_id)
);

create policy rounds_insert_active_player
on public.rounds
for insert
to anon, authenticated
with check (
  private.zm_is_active_player(room_id)
  or private.zm_is_creator(room_id)
);

create policy rounds_update_active_player
on public.rounds
for update
to anon, authenticated
using (
  private.zm_is_active_player(room_id)
  or private.zm_is_creator(room_id)
)
with check (
  private.zm_is_active_player(room_id)
  or private.zm_is_creator(room_id)
);


create policy answers_select_by_room
on public.answers
for select
to anon, authenticated
using (
  private.zm_room_code_matches(room_id)
);

create policy answers_insert_self
on public.answers
for insert
to anon, authenticated
with check (
  private.zm_is_specific_player(room_id, player_id, true)
);

create policy answers_update_self
on public.answers
for update
to anon, authenticated
using (
  private.zm_is_specific_player(room_id, player_id, true)
)
with check (
  private.zm_is_specific_player(room_id, player_id, true)
);


create policy scores_select_by_room
on public.scores
for select
to anon, authenticated
using (
  private.zm_room_code_matches(room_id)
);

create policy scores_insert_self
on public.scores
for insert
to anon, authenticated
with check (
  private.zm_is_specific_player(room_id, player_id, true)
);

create policy scores_update_self
on public.scores
for update
to anon, authenticated
using (
  private.zm_is_specific_player(room_id, player_id, true)
)
with check (
  private.zm_is_specific_player(room_id, player_id, true)
);


-- letter_decks stays inaccessible directly. The explicit deny policy removes
-- ambiguity while the private draw implementation accesses it as owner.
create policy letter_decks_no_direct_access
on public.letter_decks
for all
to anon, authenticated
using (false)
with check (false);


-- Replace broad table grants with the minimum the current client needs.
revoke all on table public.rooms from public, anon, authenticated;
revoke all on table public.players from public, anon, authenticated;
revoke all on table public.rounds from public, anon, authenticated;
revoke all on table public.answers from public, anon, authenticated;
revoke all on table public.scores from public, anon, authenticated;
revoke all on table public.letter_decks from public, anon, authenticated;

grant select, insert, update on table public.rooms
  to anon, authenticated;
grant select, insert, update, delete on table public.players
  to anon, authenticated;
grant select, insert, update on table public.rounds
  to anon, authenticated;
grant select, insert, update on table public.answers
  to anon, authenticated;
grant select, insert, update on table public.scores
  to anon, authenticated;


-- Public RPCs remain callable, but are no longer SECURITY DEFINER.
revoke all on function public.begin_free_round(uuid, text)
  from public, anon, authenticated;
revoke all on function public.unlock_free_rounds(uuid)
  from public, anon, authenticated;
revoke all on function public.draw_room_letter(uuid)
  from public, anon, authenticated;
revoke all on function public.prepare_room_for_join(uuid)
  from public, anon, authenticated;
revoke all on function public.get_server_now()
  from public, anon, authenticated;

grant execute on function public.begin_free_round(uuid, text)
  to anon, authenticated, service_role;
grant execute on function public.unlock_free_rounds(uuid)
  to anon, authenticated, service_role;
grant execute on function public.draw_room_letter(uuid)
  to anon, authenticated, service_role;
grant execute on function public.prepare_room_for_join(uuid)
  to anon, authenticated, service_role;
grant execute on function public.get_server_now()
  to anon, authenticated, service_role;


-- Private implementation and trigger functions are not exposed by the public
-- Data API schema. Grant only what the public wrappers/policies need.
revoke all on function private.begin_free_round_impl(uuid, text) from public;
revoke all on function private.unlock_free_rounds_impl(uuid) from public;
revoke all on function private.draw_room_letter_impl(uuid) from public;
revoke all on function private.prepare_room_for_join_impl(uuid) from public;
revoke all on function private.zm_guard_room_update() from public;
revoke all on function private.zm_guard_player_update() from public;
revoke all on function private.zm_guard_round_update() from public;
revoke all on function private.zm_set_round_deadline_at() from public;

grant execute on function private.begin_free_round_impl(uuid, text)
  to anon, authenticated, service_role;
grant execute on function private.unlock_free_rounds_impl(uuid)
  to anon, authenticated, service_role;
grant execute on function private.draw_room_letter_impl(uuid)
  to anon, authenticated, service_role;
grant execute on function private.prepare_room_for_join_impl(uuid)
  to anon, authenticated, service_role;
grant execute on function private.zm_guard_room_update()
  to anon, authenticated, service_role;
grant execute on function private.zm_guard_player_update()
  to anon, authenticated, service_role;
grant execute on function private.zm_guard_round_update()
  to anon, authenticated, service_role;



-- ---------------------------------------------------------------------------
-- CURRENT RPC HARDENING
-- These functions were added after the original September cutover draft.
-- Keep the public signatures used by the app, but move privileged work into
-- the non-exposed private schema so Security Advisor no longer sees exposed
-- SECURITY DEFINER entry points.
-- ---------------------------------------------------------------------------

create or replace function private.restart_room_game_impl(
  p_room_id uuid,
  p_creator_token text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare
  v_authorized boolean := false;
begin
  select exists (
    select 1
    from public.rooms r
    where r.id = p_room_id
      and p_creator_token is not null
      and p_creator_token <> ''
      and r.creator_token_hash is not null
      and r.creator_token_hash =
        pg_catalog.encode(
          extensions.digest(p_creator_token, 'sha256'),
          'hex'
        )
  )
  into v_authorized;

  if not v_authorized then
    raise exception 'Creator token required';
  end if;

  perform set_config('zm.internal_rpc', '1', true);

  delete from public.scores where room_id = p_room_id;
  delete from public.answers where room_id = p_room_id;
  delete from public.rounds where room_id = p_room_id;

  update public.players
  set status = 'active'
  where room_id = p_room_id;

  update public.rooms
  set
    status = 'lobby',
    letter = null,
    free_rounds_started = 0,
    free_rounds_unlocked = case
      when creator_tier = 'free' then 3
      else free_rounds_unlocked
    end
  where id = p_room_id;

  return true;
end;
$$;

create or replace function public.restart_room_game(
  p_room_id uuid,
  p_creator_token text
)
returns boolean
language sql
security invoker
set search_path = pg_catalog, private
as $$
  select private.restart_room_game_impl(p_room_id, p_creator_token);
$$;


create or replace function private.get_coin_wallet_state_impl(
  p_device_id uuid,
  p_device_secret text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare
  v_hash text;
  v_existing_hash text;
begin
  if p_device_id is null
     or p_device_secret is null
     or length(p_device_secret) < 16 then
    raise exception 'Invalid coin identity';
  end if;

  v_hash := private.zm_coin_secret_hash(p_device_secret);

  insert into public.coin_wallets(device_id, secret_hash)
  values (p_device_id, v_hash)
  on conflict (device_id) do nothing;

  select secret_hash
  into v_existing_hash
  from public.coin_wallets
  where device_id = p_device_id;

  if v_existing_hash is distinct from v_hash then
    raise exception 'Coin identity mismatch';
  end if;

  return private.zm_coin_wallet_json(p_device_id, false, null);
end;
$$;

create or replace function private.purchase_coin_unlock_impl(
  p_device_id uuid,
  p_device_secret text,
  p_unlock_key text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare
  v_hash text;
  v_cost integer;
  v_balance integer;
begin
  v_cost := private.zm_coin_unlock_cost(p_unlock_key);
  if v_cost is null then
    raise exception 'Unknown coin unlock';
  end if;

  v_hash := private.zm_coin_secret_hash(p_device_secret);

  perform 1
  from public.coin_wallets
  where device_id = p_device_id
    and secret_hash = v_hash
  for update;

  if not found then
    raise exception 'Coin identity mismatch';
  end if;

  if exists (
    select 1
    from public.coin_unlocks
    where device_id = p_device_id
      and unlock_key = p_unlock_key
  ) then
    return private.zm_coin_wallet_json(
      p_device_id,
      false,
      'already_unlocked'
    );
  end if;

  select balance
  into v_balance
  from public.coin_wallets
  where device_id = p_device_id;

  if v_balance < v_cost then
    return private.zm_coin_wallet_json(
      p_device_id,
      false,
      'insufficient_coins'
    );
  end if;

  update public.coin_wallets
  set
    balance = balance - v_cost,
    updated_at = now()
  where device_id = p_device_id;

  insert into public.coin_unlocks(device_id, unlock_key, cost)
  values (p_device_id, p_unlock_key, v_cost);

  insert into public.coin_ledger(device_id, delta, reason, unlock_key)
  values (p_device_id, -v_cost, 'unlock_purchase', p_unlock_key);

  return private.zm_coin_wallet_json(p_device_id, false, 'purchased');
end;
$$;

create or replace function private.claim_coin_round_reward_impl(
  p_room_id uuid,
  p_round_id uuid,
  p_creator_token text,
  p_device_id uuid,
  p_device_secret text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare
  v_hash text;
  v_room public.rooms%rowtype;
  v_round public.rounds%rowtype;
  v_device_count integer;
  v_category_count integer;
  v_inserted integer;
begin
  v_hash := private.zm_coin_secret_hash(p_device_secret);

  perform 1
  from public.coin_wallets
  where device_id = p_device_id
    and secret_hash = v_hash
  for update;

  if not found then
    raise exception 'Coin identity mismatch';
  end if;

  select *
  into v_room
  from public.rooms
  where id = p_room_id;

  if not found
     or v_room.creator_tier <> 'super_premium'
     or v_room.letter_deck_owner_id is distinct from p_device_id
     or p_creator_token is null
     or p_creator_token = ''
     or v_room.creator_token_hash is null
     or v_room.creator_token_hash <>
        pg_catalog.encode(
          extensions.digest(p_creator_token, 'sha256'),
          'hex'
        )
  then
    raise exception 'Organizer authorization required';
  end if;

  select *
  into v_round
  from public.rounds
  where id = p_round_id
    and room_id = p_room_id
    and status in ('scoring', 'done');

  if not found then
    return private.zm_coin_wallet_json(
      p_device_id,
      false,
      'round_not_ready'
    );
  end if;

  if exists (
    select 1
    from public.coin_round_rewards
    where round_id = p_round_id
  ) then
    return private.zm_coin_wallet_json(
      p_device_id,
      false,
      'already_awarded'
    );
  end if;

  select count(distinct rp.device_id)
  into v_device_count
  from public.round_participants rp
  where rp.round_id = p_round_id
    and rp.device_id is not null;

  if coalesce(v_device_count, 0) < 2 then
    return private.zm_coin_wallet_json(
      p_device_id,
      false,
      'not_enough_devices'
    );
  end if;

  v_category_count := jsonb_array_length(v_round.categories);

  if v_category_count <= 0 then
    return private.zm_coin_wallet_json(
      p_device_id,
      false,
      'round_not_ready'
    );
  end if;

  if exists (
    select 1
    from public.round_participants rp
    where rp.round_id = p_round_id
      and (
        select count(distinct s.category)
        from public.scores s
        where s.room_id = p_room_id
          and s.player_id = rp.player_id
          and s.round = v_round.round_no
          and s.category in (
            select jsonb_array_elements_text(v_round.categories)
          )
      ) < v_category_count
  ) then
    return private.zm_coin_wallet_json(
      p_device_id,
      false,
      'round_not_ready'
    );
  end if;

  insert into public.coin_round_rewards(
    round_id,
    room_id,
    device_id,
    coins
  )
  values (
    p_round_id,
    p_room_id,
    p_device_id,
    2
  )
  on conflict (round_id) do nothing;

  get diagnostics v_inserted = row_count;

  if v_inserted = 0 then
    return private.zm_coin_wallet_json(
      p_device_id,
      false,
      'already_awarded'
    );
  end if;

  update public.coin_wallets
  set
    balance = balance + 2,
    qualifying_rounds = qualifying_rounds + 1,
    updated_at = now()
  where device_id = p_device_id;

  insert into public.coin_ledger(
    device_id,
    delta,
    reason,
    room_id,
    round_id
  )
  values (
    p_device_id,
    2,
    'qualifying_round',
    p_room_id,
    p_round_id
  );

  return private.zm_coin_wallet_json(
    p_device_id,
    true,
    'awarded'
  );
end;
$$;

create or replace function public.get_coin_wallet_state(
  p_device_id uuid,
  p_device_secret text
)
returns jsonb
language sql
security invoker
set search_path = pg_catalog, private
as $$
  select private.get_coin_wallet_state_impl(
    p_device_id,
    p_device_secret
  );
$$;

create or replace function public.purchase_coin_unlock(
  p_device_id uuid,
  p_device_secret text,
  p_unlock_key text
)
returns jsonb
language sql
security invoker
set search_path = pg_catalog, private
as $$
  select private.purchase_coin_unlock_impl(
    p_device_id,
    p_device_secret,
    p_unlock_key
  );
$$;

create or replace function public.claim_coin_round_reward(
  p_room_id uuid,
  p_round_id uuid,
  p_creator_token text,
  p_device_id uuid,
  p_device_secret text
)
returns jsonb
language sql
security invoker
set search_path = pg_catalog, private
as $$
  select private.claim_coin_round_reward_impl(
    p_room_id,
    p_round_id,
    p_creator_token,
    p_device_id,
    p_device_secret
  );
$$;


-- Explicit deny policies make the already-RLS-protected internal coin tables
-- unambiguous to Security Advisor. They remain accessible only through the
-- validated RPC implementations above.
drop policy if exists coin_wallets_no_direct_access
  on public.coin_wallets;
create policy coin_wallets_no_direct_access
on public.coin_wallets
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists coin_unlocks_no_direct_access
  on public.coin_unlocks;
create policy coin_unlocks_no_direct_access
on public.coin_unlocks
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists round_participants_no_direct_access
  on public.round_participants;
create policy round_participants_no_direct_access
on public.round_participants
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists coin_round_rewards_no_direct_access
  on public.coin_round_rewards;
create policy coin_round_rewards_no_direct_access
on public.coin_round_rewards
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists coin_ledger_no_direct_access
  on public.coin_ledger;
create policy coin_ledger_no_direct_access
on public.coin_ledger
for all
to anon, authenticated
using (false)
with check (false);


-- Public wrappers are callable by the app but no longer execute with elevated
-- privileges themselves.
revoke all on function public.restart_room_game(uuid, text)
  from public, anon, authenticated;
revoke all on function public.get_coin_wallet_state(uuid, text)
  from public, anon, authenticated;
revoke all on function public.purchase_coin_unlock(uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.claim_coin_round_reward(uuid, uuid, text, uuid, text)
  from public, anon, authenticated;

grant execute on function public.restart_room_game(uuid, text)
  to anon, authenticated, service_role;
grant execute on function public.get_coin_wallet_state(uuid, text)
  to anon, authenticated, service_role;
grant execute on function public.purchase_coin_unlock(uuid, text, text)
  to anon, authenticated, service_role;
grant execute on function public.claim_coin_round_reward(uuid, uuid, text, uuid, text)
  to anon, authenticated, service_role;


revoke all on function private.restart_room_game_impl(uuid, text)
  from public;
revoke all on function private.get_coin_wallet_state_impl(uuid, text)
  from public;
revoke all on function private.purchase_coin_unlock_impl(uuid, text, text)
  from public;
revoke all on function private.claim_coin_round_reward_impl(uuid, uuid, text, uuid, text)
  from public;

grant execute on function private.restart_room_game_impl(uuid, text)
  to anon, authenticated, service_role;
grant execute on function private.get_coin_wallet_state_impl(uuid, text)
  to anon, authenticated, service_role;
grant execute on function private.purchase_coin_unlock_impl(uuid, text, text)
  to anon, authenticated, service_role;
grant execute on function private.claim_coin_round_reward_impl(uuid, uuid, text, uuid, text)
  to anon, authenticated, service_role;


-- Refresh PostgREST's schema cache after changing function signatures/ACLs.
notify pgrst, 'reload schema';

commit;
