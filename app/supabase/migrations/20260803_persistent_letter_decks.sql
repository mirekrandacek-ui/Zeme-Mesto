alter table public.rooms
add column if not exists letter_deck_owner_id uuid;


create table if not exists public.letter_decks (
  owner_id uuid not null,
  language text not null,
  remaining_letters text[] not null default array[]::text[],
  last_letter text,
  updated_at timestamptz not null default now(),
  primary key (owner_id, language),
  constraint letter_decks_language_check
    check (
      language in (
        'cs', 'en', 'es', 'de', 'fr',
        'pt-BR', 'id', 'tr', 'pl', 'it'
      )
    )
);

alter table public.letter_decks enable row level security;

revoke all on table public.letter_decks from public;
revoke all on table public.letter_decks from anon;
revoke all on table public.letter_decks from authenticated;


create or replace function public.draw_room_letter(p_room_id uuid)
returns text
language plpgsql
security definer
set search_path = public
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

revoke all on function public.draw_room_letter(uuid) from public;
grant execute on function public.draw_room_letter(uuid)
  to anon, authenticated;
