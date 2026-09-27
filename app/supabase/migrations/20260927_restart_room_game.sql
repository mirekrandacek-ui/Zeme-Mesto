create or replace function public.restart_room_game(
  p_room_id uuid,
  p_creator_token text
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
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
      and (
        (r.creator_token_hash is not null
          and r.creator_token_hash =
            encode(digest(p_creator_token, 'sha256'), 'hex'))
        or
        (r.creator_token is not null
          and r.creator_token = p_creator_token)
      )
  )
  into v_authorized;

  if not v_authorized then
    raise exception 'Creator token required';
  end if;

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

revoke all on function public.restart_room_game(uuid, text) from public;
grant execute on function public.restart_room_game(uuid, text)
  to anon, authenticated;
