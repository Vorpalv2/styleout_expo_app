-- Clerk user IDs are text. The Clerk/Supabase third-party auth integration supplies
-- an authenticated JWT whose sub claim is the current Clerk user ID.
create table if not exists public.styleout_profiles (
  user_id text primary key default (auth.jwt() ->> 'sub'),
  display_name text not null default 'Your profile',
  bio text not null default 'A wardrobe that feels like you.',
  main_image_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint styleout_main_image_owned check (main_image_path is null or split_part(main_image_path, '/', 1) = user_id)
);

create table if not exists public.wardrobe_items (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default (auth.jwt() ->> 'sub'),
  image_path text not null,
  source_id text,
  name text not null check (length(trim(name)) > 0),
  category text not null check (category in ('Tops', 'Bottoms', 'Outerwear', 'Dresses', 'Shoes', 'Bags', 'Accessories')),
  color text not null default '',
  brand text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint styleout_item_image_owned check (split_part(image_path, '/', 1) = user_id)
);

create table if not exists public.saved_looks (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default (auth.jwt() ->> 'sub'),
  signature text not null,
  image_path text,
  pieces text[] not null default '{}',
  saved_at timestamptz not null default now(),
  constraint styleout_saved_image_owned check (image_path is null or split_part(image_path, '/', 1) = user_id),
  unique (user_id, signature)
);

create index if not exists wardrobe_items_user_created_idx on public.wardrobe_items (user_id, created_at desc);
create unique index if not exists wardrobe_items_user_source_idx on public.wardrobe_items (user_id, source_id) where source_id is not null;
create index if not exists saved_looks_user_saved_idx on public.saved_looks (user_id, saved_at desc);

alter table public.styleout_profiles enable row level security;
alter table public.wardrobe_items enable row level security;
alter table public.saved_looks enable row level security;

grant select, insert, update, delete on public.styleout_profiles, public.wardrobe_items, public.saved_looks to authenticated;

create policy "styleout_profiles_select_own" on public.styleout_profiles for select to authenticated using (user_id = (select auth.jwt() ->> 'sub'));
create policy "styleout_profiles_insert_own" on public.styleout_profiles for insert to authenticated with check (user_id = (select auth.jwt() ->> 'sub'));
create policy "styleout_profiles_update_own" on public.styleout_profiles for update to authenticated using (user_id = (select auth.jwt() ->> 'sub')) with check (user_id = (select auth.jwt() ->> 'sub'));
create policy "styleout_profiles_delete_own" on public.styleout_profiles for delete to authenticated using (user_id = (select auth.jwt() ->> 'sub'));

create policy "wardrobe_items_select_own" on public.wardrobe_items for select to authenticated using (user_id = (select auth.jwt() ->> 'sub'));
create policy "wardrobe_items_insert_own" on public.wardrobe_items for insert to authenticated with check (user_id = (select auth.jwt() ->> 'sub'));
create policy "wardrobe_items_update_own" on public.wardrobe_items for update to authenticated using (user_id = (select auth.jwt() ->> 'sub')) with check (user_id = (select auth.jwt() ->> 'sub'));
create policy "wardrobe_items_delete_own" on public.wardrobe_items for delete to authenticated using (user_id = (select auth.jwt() ->> 'sub'));

create policy "saved_looks_select_own" on public.saved_looks for select to authenticated using (user_id = (select auth.jwt() ->> 'sub'));
create policy "saved_looks_insert_own" on public.saved_looks for insert to authenticated with check (user_id = (select auth.jwt() ->> 'sub'));
create policy "saved_looks_update_own" on public.saved_looks for update to authenticated using (user_id = (select auth.jwt() ->> 'sub')) with check (user_id = (select auth.jwt() ->> 'sub'));
create policy "saved_looks_delete_own" on public.saved_looks for delete to authenticated using (user_id = (select auth.jwt() ->> 'sub'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('styleout-images', 'styleout-images', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do nothing;

create policy "styleout_images_select_own" on storage.objects for select to authenticated
using (bucket_id = 'styleout-images' and (storage.foldername(name))[1] = (select auth.jwt() ->> 'sub'));
create policy "styleout_images_insert_own" on storage.objects for insert to authenticated
with check (bucket_id = 'styleout-images' and (storage.foldername(name))[1] = (select auth.jwt() ->> 'sub'));
create policy "styleout_images_delete_own" on storage.objects for delete to authenticated
using (bucket_id = 'styleout-images' and (storage.foldername(name))[1] = (select auth.jwt() ->> 'sub'));
