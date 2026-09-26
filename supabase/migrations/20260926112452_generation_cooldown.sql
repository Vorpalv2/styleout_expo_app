-- Persist the last accepted generation per Clerk user. The cooldown is 3 minutes.
-- Clients can read only their own timestamp for UI feedback; only the Edge Function
-- can claim a generation slot through the service-role-only RPC below.
create table if not exists public.styleout_generation_limits (
  user_id text primary key,
  last_generation_started_at timestamptz,
  constraint styleout_generation_limits_user_id_valid
    check (length(user_id) between 1 and 255)
);

alter table public.styleout_generation_limits enable row level security;
revoke all on public.styleout_generation_limits from anon, authenticated;
grant select on public.styleout_generation_limits to authenticated;
grant select, insert, update, delete on public.styleout_generation_limits to service_role;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'styleout_generation_limits'
      and policyname = 'styleout_generation_limits_select_own'
  ) then
    create policy styleout_generation_limits_select_own
      on public.styleout_generation_limits
      for select to authenticated
      using (user_id = (select auth.jwt() ->> 'sub'));
  end if;
end $$;

create or replace function public.styleout_claim_generation(
  p_user_id text,
  p_look_id uuid,
  p_force_regenerate boolean,
  p_expected_generated_image_path text,
  p_background_blur boolean
)
returns table (result text, next_allowed_at timestamptz, retry_after_seconds integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz;
  v_last_started_at timestamptz;
  v_next_allowed_at timestamptz;
  v_look public.saved_looks%rowtype;
  v_is_stale boolean;
begin
  if p_user_id is null or length(p_user_id) = 0 or length(p_user_id) > 255 or p_look_id is null then
    raise exception 'Invalid generation request.' using errcode = '22023';
  end if;

  -- Lock the look first so duplicate requests for the same look return its current state.
  select * into v_look
  from public.saved_looks
  where id = p_look_id and user_id = p_user_id
  for update;

  if not found then
    return query select 'not_found'::text, null::timestamptz, 0::integer;
    return;
  end if;

  v_now := clock_timestamp();
  v_is_stale := v_look.generation_status = 'running'
    and v_look.generation_started_at is not null
    and v_look.generation_started_at <= v_now - interval '150 seconds';

  if v_look.generation_status = 'running' and not v_is_stale then
    return query select 'running'::text, null::timestamptz, 0::integer;
    return;
  end if;

  if v_look.generated_image_path is not null and not p_force_regenerate then
    return query select 'complete'::text, null::timestamptz, 0::integer;
    return;
  end if;

  if p_force_regenerate and v_look.generated_image_path is distinct from p_expected_generated_image_path then
    return query select 'conflict'::text, null::timestamptz, 0::integer;
    return;
  end if;

  if not v_is_stale and not (
    (p_force_regenerate and v_look.generation_status in ('idle', 'failed', 'complete'))
    or (not p_force_regenerate and v_look.generated_image_path is null and v_look.generation_status in ('idle', 'failed'))
  ) then
    return query select 'not_claimed'::text, null::timestamptz, 0::integer;
    return;
  end if;

  insert into public.styleout_generation_limits (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select last_generation_started_at into v_last_started_at
  from public.styleout_generation_limits
  where user_id = p_user_id
  for update;
  v_now := clock_timestamp();

  if v_last_started_at is not null then
    v_next_allowed_at := v_last_started_at + interval '3 minutes';
    if v_next_allowed_at > v_now then
      return query select
        'cooldown'::text,
        v_next_allowed_at,
        greatest(0, ceil(extract(epoch from (v_next_allowed_at - v_now)))::integer);
      return;
    end if;
  end if;

  update public.saved_looks
  set generation_status = 'running',
      generation_started_at = v_now,
      generation_error = null,
      background_blur = p_background_blur
  where id = p_look_id and user_id = p_user_id;

  update public.styleout_generation_limits
  set last_generation_started_at = v_now
  where user_id = p_user_id;

  return query select 'started'::text, v_now + interval '3 minutes', 180::integer;
end;
$$;

revoke all on function public.styleout_claim_generation(text, uuid, boolean, text, boolean) from public, anon, authenticated;
grant execute on function public.styleout_claim_generation(text, uuid, boolean, text, boolean) to service_role;

-- The signed-in app uses this invoker RPC to read a server-calculated countdown.
create or replace function public.styleout_get_generation_cooldown()
returns table (retry_after_seconds integer)
language sql
volatile
security invoker
set search_path = ''
as $$
  select greatest(
    0,
    ceil(extract(epoch from (limits.last_generation_started_at + interval '3 minutes' - clock_timestamp())))::integer
  )
  from public.styleout_generation_limits as limits
  where limits.user_id = (select auth.jwt() ->> 'sub')
    and limits.last_generation_started_at is not null
    and limits.last_generation_started_at + interval '3 minutes' > clock_timestamp();
$$;

revoke all on function public.styleout_get_generation_cooldown() from public, anon;
grant execute on function public.styleout_get_generation_cooldown() to authenticated;
