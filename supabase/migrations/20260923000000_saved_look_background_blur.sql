alter table public.saved_looks
  add column if not exists background_blur boolean not null default false;
