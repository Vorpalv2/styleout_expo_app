alter table public.saved_looks add column if not exists title text not null default 'Saved style';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'saved_look_title_valid' and conrelid = 'public.saved_looks'::regclass) then
    alter table public.saved_looks add constraint saved_look_title_valid check (length(trim(title)) between 1 and 60);
  end if;
end $$;

alter table public.saved_look_items add column if not exists item_name text;
alter table public.saved_look_items add column if not exists item_category text;
alter table public.saved_look_items add column if not exists item_image_path text;

update public.saved_look_items as link
set item_name = item.name, item_category = item.category, item_image_path = item.image_path
from public.wardrobe_items as item
where link.item_id = item.id and link.user_id = item.user_id and link.item_name is null;

alter table public.saved_look_items alter column item_name set not null;
alter table public.saved_look_items alter column item_category set not null;
alter table public.saved_look_items alter column item_image_path set not null;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'saved_look_item_image_owned' and conrelid = 'public.saved_look_items'::regclass) then
    alter table public.saved_look_items add constraint saved_look_item_image_owned
      check (split_part(item_image_path, '/', 1) = user_id);
  end if;
end $$;

create or replace function public.save_styleout_look_v2(
  p_signature text, p_image_path text, p_pieces text[], p_selections jsonb, p_title text
) returns uuid
language plpgsql security invoker set search_path = public
as $$
declare
  v_user_id text := auth.jwt() ->> 'sub';
  v_look_id uuid;
  v_linked_count integer;
begin
  if v_user_id is null or p_image_path is null or split_part(p_image_path, '/', 1) <> v_user_id then
    raise exception 'A saved look needs your own source photo';
  end if;
  if length(trim(p_title)) not between 1 and 60 then
    raise exception 'Name your style (up to 60 characters)';
  end if;
  if jsonb_typeof(p_selections) <> 'array' or jsonb_array_length(p_selections) = 0 then
    raise exception 'Select at least one wardrobe item';
  end if;

  insert into public.saved_looks (user_id, signature, image_path, pieces, title)
  values (v_user_id, p_signature, p_image_path, p_pieces, trim(p_title))
  returning id into v_look_id;

  insert into public.saved_look_items (look_id, user_id, item_id, slot_index, item_name, item_category, item_image_path)
  select v_look_id, v_user_id, item.id, (selection.value ->> 'slotIndex')::integer,
         item.name, item.category, item.image_path
  from jsonb_array_elements(p_selections) as selection(value)
  join public.wardrobe_items as item
    on item.id = (selection.value ->> 'itemId')::uuid and item.user_id = v_user_id;
  get diagnostics v_linked_count = row_count;
  if v_linked_count <> jsonb_array_length(p_selections) then
    raise exception 'One or more wardrobe items are unavailable';
  end if;
  return v_look_id;
end $$;

revoke all on function public.save_styleout_look_v2(text, text, text[], jsonb, text) from public;
grant execute on function public.save_styleout_look_v2(text, text, text[], jsonb, text) to authenticated;
revoke execute on function public.save_styleout_look(text, text, text[], jsonb) from authenticated;
