alter table public.saved_looks
  add column if not exists generation_status text not null default 'idle',
  add column if not exists generation_started_at timestamptz,
  add column if not exists generation_error text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'saved_looks_generation_status_valid' and conrelid = 'public.saved_looks'::regclass) then
    alter table public.saved_looks add constraint saved_looks_generation_status_valid
      check (generation_status in ('idle', 'running', 'complete', 'failed'));
  end if;
end $$;

update public.saved_looks set generation_status = 'complete'
where generated_image_path is not null and generation_status <> 'complete';
