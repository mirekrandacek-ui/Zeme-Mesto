alter table public.rooms
add column if not exists free_rounds_unlocked integer not null default 3;

alter table public.rooms
add column if not exists free_rounds_started integer not null default 0;


create or replace function public.unlock_free_rounds(p_room_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_limit integer;
begin
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

revoke all on function public.unlock_free_rounds(uuid) from public;
grant execute on function public.unlock_free_rounds(uuid) to anon, authenticated;


create or replace function public.begin_free_round(
  p_room_id uuid,
  p_expected_status text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_started integer;
begin
  if p_expected_status not in ('lobby', 'scoring') then
    return 0;
  end if;

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

revoke all on function public.begin_free_round(uuid, text) from public;
grant execute on function public.begin_free_round(uuid, text) to anon, authenticated;
