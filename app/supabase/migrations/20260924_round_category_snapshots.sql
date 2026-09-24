alter table public.rounds
  add column if not exists categories jsonb not null default '[]'::jsonb;

update public.rounds as r
set categories = case
  when jsonb_typeof(coalesce(ro.active_categories, '[]'::jsonb)) = 'array'
       and jsonb_array_length(coalesce(ro.active_categories, '[]'::jsonb)) > 0
    then ro.active_categories
  else '["Země","Město","Jméno"]'::jsonb
end
from public.rooms as ro
where r.room_id = ro.id
  and (r.categories is null or r.categories = '[]'::jsonb);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'rounds_categories_is_array'
      and conrelid = 'public.rounds'::regclass
  ) then
    alter table public.rounds
      add constraint rounds_categories_is_array
      check (jsonb_typeof(categories) = 'array');
  end if;
end
$$;
