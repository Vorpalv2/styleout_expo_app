alter table public.styleout_profiles
  add column if not exists onboarding_completed_at timestamptz;

-- Existing accounts predate onboarding and should not be interrupted by it.
update public.styleout_profiles
set onboarding_completed_at = created_at
where onboarding_completed_at is null;

comment on column public.styleout_profiles.onboarding_completed_at is
  'Set after the user finishes or skips the first-login tutorial.';
