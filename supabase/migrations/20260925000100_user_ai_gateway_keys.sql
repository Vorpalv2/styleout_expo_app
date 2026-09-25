-- Store each user's optional AI Gateway credential encrypted in Supabase Vault.
-- These RPCs are service-role only; clients can never read decrypted key values.

create or replace function public.styleout_store_ai_gateway_key(p_user_id text, p_api_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  secret_name text := 'styleout-ai-gateway:' || p_user_id;
  existing_id uuid;
begin
  if p_user_id is null or length(p_user_id) = 0 or length(p_user_id) > 255 then
    raise exception 'Invalid user.' using errcode = '22023';
  end if;
  if p_api_key is null or length(btrim(p_api_key)) < 20 or length(p_api_key) > 512 then
    raise exception 'Invalid AI Gateway key.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext(secret_name));
  select id into existing_id from vault.secrets where name = secret_name limit 1;
  if existing_id is null then
    perform vault.create_secret(btrim(p_api_key), secret_name, 'Styleout user AI Gateway API key');
  else
    perform vault.update_secret(existing_id, btrim(p_api_key), secret_name, 'Styleout user AI Gateway API key');
  end if;
end;
$$;

create or replace function public.styleout_get_ai_gateway_key(p_user_id text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = 'styleout-ai-gateway:' || p_user_id
  limit 1;
$$;

create or replace function public.styleout_has_ai_gateway_key(p_user_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from vault.secrets where name = 'styleout-ai-gateway:' || p_user_id
  );
$$;

create or replace function public.styleout_delete_ai_gateway_key(p_user_id text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from vault.secrets where name = 'styleout-ai-gateway:' || p_user_id;
$$;

revoke all on function public.styleout_store_ai_gateway_key(text, text) from public, anon, authenticated;
revoke all on function public.styleout_get_ai_gateway_key(text) from public, anon, authenticated;
revoke all on function public.styleout_has_ai_gateway_key(text) from public, anon, authenticated;
revoke all on function public.styleout_delete_ai_gateway_key(text) from public, anon, authenticated;
grant execute on function public.styleout_store_ai_gateway_key(text, text) to service_role;
grant execute on function public.styleout_get_ai_gateway_key(text) to service_role;
grant execute on function public.styleout_has_ai_gateway_key(text) to service_role;
grant execute on function public.styleout_delete_ai_gateway_key(text) to service_role;
