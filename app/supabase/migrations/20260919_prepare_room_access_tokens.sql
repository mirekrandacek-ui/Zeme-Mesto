begin;

alter table public.rooms
  add column if not exists creator_token_hash text;

alter table public.players
  add column if not exists player_token_hash text;

update public.rooms
set creator_token_hash =
  pg_catalog.encode(
    extensions.digest(creator_token, 'sha256'),
    'hex'
  )
where creator_token is not null
  and creator_token <> ''
  and creator_token_hash is null;

create index if not exists players_room_player_token_hash_idx
  on public.players (room_id, player_token_hash);

create index if not exists rounds_room_round_no_idx
  on public.rounds (room_id, round_no desc);

commit;
