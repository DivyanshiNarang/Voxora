alter table public.profiles
add column if not exists trial_used boolean not null default false;

-- Anyone who already has premium access (granted by a previous run of
-- start-trial, before trial_used existed) has already used their trial.
update public.profiles
set trial_used = true
where premium_expires_at is not null;
