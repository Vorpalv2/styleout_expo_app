-- Instagram connections are managed only by Edge Functions using the service role.
-- The client receives connection status and media metadata, never access tokens.
create table if not exists public.instagram_connections (
  user_id text primary key,
  facebook_user_id text,
  facebook_page_id text,
  facebook_page_name text,
  instagram_user_id text not null,
  username text not null default '',
  access_token_ciphertext text not null,
  token_expires_at timestamptz,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.instagram_oauth_states (
  state_hash text primary key,
  user_id text not null,
  return_url text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.instagram_imports (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  instagram_media_id text not null,
  storage_path text not null,
  imported_at timestamptz not null default now(),
  constraint instagram_import_path_owned check (split_part(storage_path, '/', 1) = user_id),
  unique (user_id, instagram_media_id)
);

create index if not exists instagram_oauth_states_expiry_idx on public.instagram_oauth_states (expires_at);
create index if not exists instagram_imports_user_idx on public.instagram_imports (user_id, imported_at desc);

alter table public.instagram_connections enable row level security;
alter table public.instagram_oauth_states enable row level security;
alter table public.instagram_imports enable row level security;

revoke all on public.instagram_connections, public.instagram_oauth_states, public.instagram_imports from anon, authenticated;

-- Edge Functions use this RPC to have PostgREST verify the Clerk JWT and return
-- the authenticated subject without requiring an existing profile row.
create or replace function public.styleout_current_user()
returns text
language sql
stable
security invoker
set search_path = public
as $$
  select auth.jwt() ->> 'sub';
$$;

revoke all on function public.styleout_current_user() from public, anon;
grant execute on function public.styleout_current_user() to authenticated;
