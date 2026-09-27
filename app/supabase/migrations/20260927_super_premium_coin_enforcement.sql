create or replace function private.zm_has_coin_unlock(
  p_device_id uuid,
  p_unlock_key text
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select p_device_id is not null
    and exists (
      select 1
      from public.coin_unlocks u
      where u.device_id = p_device_id
        and u.unlock_key = p_unlock_key
    );
$$;

create or replace function private.zm_enforce_super_premium_coin_unlocks()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
begin
  if new.creator_tier <> 'super_premium' then
    return new;
  end if;

  if new.round_time_limit_seconds is not null
     and not private.zm_has_coin_unlock(new.letter_deck_owner_id, 'feature_round_time')
  then
    raise exception 'Round time limit is coin-locked';
  end if;

  if new.round_count_limit is not null
     and not private.zm_has_coin_unlock(new.letter_deck_owner_id, 'feature_round_count')
  then
    raise exception 'Round count is coin-locked';
  end if;

  if coalesce(btrim(new.custom_category), '') <> ''
     and not private.zm_has_coin_unlock(new.letter_deck_owner_id, 'feature_custom_categories')
  then
    raise exception 'Custom categories are coin-locked';
  end if;

  if coalesce(new.active_categories, '[]'::jsonb) ? 'Herec / Herečka'
     and not private.zm_has_coin_unlock(new.letter_deck_owner_id, 'category_actor')
  then
    raise exception 'Actor category is coin-locked';
  end if;

  if coalesce(new.active_categories, '[]'::jsonb) ? 'Zpěvák / Zpěvačka / Kapela'
     and not private.zm_has_coin_unlock(new.letter_deck_owner_id, 'category_music')
  then
    raise exception 'Music category is coin-locked';
  end if;

  if coalesce(new.active_categories, '[]'::jsonb) ? 'Řeka / Hora'
     and not private.zm_has_coin_unlock(new.letter_deck_owner_id, 'category_river_mountain')
  then
    raise exception 'River / mountain category is coin-locked';
  end if;

  if coalesce(new.active_categories, '[]'::jsonb) ? 'Povolání'
     and not private.zm_has_coin_unlock(new.letter_deck_owner_id, 'category_job')
  then
    raise exception 'Job category is coin-locked';
  end if;

  if coalesce(new.active_categories, '[]'::jsonb) ? 'Barva'
     and not private.zm_has_coin_unlock(new.letter_deck_owner_id, 'category_color')
  then
    raise exception 'Colour category is coin-locked';
  end if;

  return new;
end;
$$;

drop trigger if exists rooms_enforce_super_premium_coin_unlocks on public.rooms;
create trigger rooms_enforce_super_premium_coin_unlocks
before insert or update of
  creator_tier,
  letter_deck_owner_id,
  active_categories,
  custom_category,
  round_time_limit_seconds,
  round_count_limit
on public.rooms
for each row
execute function private.zm_enforce_super_premium_coin_unlocks();
