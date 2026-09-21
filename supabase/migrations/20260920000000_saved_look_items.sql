-- Keep the source photo on saved_looks.image_path. A later AI job can write its
-- output to generated_image_path without replacing the original reference.
alter table public.saved_looks add column if not exists generated_image_path text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'styleout_generated_image_owned' and conrelid = 'public.saved_looks'::regclass) then
    alter table public.saved_looks add constraint styleout_generated_image_owned
      check (generated_image_path is null or split_part(generated_image_path, '/', 1) = user_id);
  end if;
end $$;

create unique index if not exists saved_looks_id_user_idx on public.saved_looks (id, user_id);
create unique index if not exists wardrobe_items_id_user_idx on public.wardrobe_items (id, user_id);

create table if not exists public.saved_look_items (
  look_id uuid not null,
  user_id text not null default (auth.jwt() ->> 'sub'),
  item_id uuid not null,
  slot_index integer not null check (slot_index >= 0),
  primary key (look_id, slot_index),
  foreign key (look_id, user_id) references public.saved_looks (id, user_id) on delete cascade,
  foreign key (item_id, user_id) references public.wardrobe_items (id, user_id) on delete restrict
);

create index if not exists saved_look_items_user_look_idx on public.saved_look_items (user_id, look_id);
alter table public.saved_look_items enable row level security;
grant select, insert, delete on public.saved_look_items to authenticated;

create policy "saved_look_items_select_own" on public.saved_look_items
  for select to authenticated using (user_id = (select auth.jwt() ->> 'sub'));
create policy "saved_look_items_insert_own" on public.saved_look_items
  for insert to authenticated with check (user_id = (select auth.jwt() ->> 'sub'));
create policy "saved_look_items_delete_own" on public.saved_look_items
  for delete to authenticated using (user_id = (select auth.jwt() ->> 'sub'));

-- One RPC keeps the parent look and all of its item links in one transaction.
create or replace function public.save_styleout_look(
  p_signature text,
  p_image_path text,
  p_pieces text[],
  p_selections jsonb
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id text := auth.jwt() ->> 'sub';
  v_look_id uuid;
begin
  if v_user_id is null or p_image_path is null or split_part(p_image_path, '/', 1) <> v_user_id then
    raise exception 'A saved look needs your own source photo';
  end if;
  if jsonb_typeof(p_selections) <> 'array' then
    raise exception 'Selections must be an array';
  end if;
  if jsonb_array_length(p_selections) = 0 then
    raise exception 'Select at least one wardrobe item';
  end if;

  insert into public.saved_looks (user_id, signature, image_path, pieces)
  values (v_user_id, p_signature, p_image_path, p_pieces)
  returning id into v_look_id;

  insert into public.saved_look_items (look_id, user_id, item_id, slot_index)
  select v_look_id, v_user_id, (selection ->> 'itemId')::uuid, (selection ->> 'slotIndex')::integer
  from jsonb_array_elements(p_selections) as selection;

  return v_look_id;
end $$;

revoke all on function public.save_styleout_look(text, text, text[], jsonb) from public;
grant execute on function public.save_styleout_look(text, text, text[], jsonb) to authenticated;
