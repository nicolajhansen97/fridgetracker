-- Per-user profile: ONE row per auth user. Consolidates two things so we don't
-- keep adding tables:
--   1. Pro comps  — premium_until (granted outside Apple/Google billing).
--   2. Activity   — last_seen / device / app version (previously user_devices).
--
-- Pro is comped by setting premium_until to a future date (use a far date like
-- 2099-01-01 for "lifetime"). The app treats a future premium_until as Pro,
-- alongside the RevenueCat entitlement and household premium.
--
-- Run this whole file once in the Supabase SQL editor. It is re-runnable.

create table if not exists public.profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  email            text,
  premium_until    timestamptz,            -- null = no comp; future = Pro granted
  is_admin         boolean not null default false,
  last_seen_at     timestamptz,
  platform         text,
  platform_version text,
  device_model     text,
  app_version      text,
  locale           text,
  open_count       integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists profiles_last_seen_idx on public.profiles (last_seen_at desc);
create index if not exists profiles_premium_idx   on public.profiles (premium_until);

-- RLS: a user may READ only their own profile. There is intentionally NO insert/
-- update policy, so users can't grant themselves Pro — premium_until is only
-- written by the service role (SQL editor) or the SECURITY DEFINER routines below.
alter table public.profiles enable row level security;

drop policy if exists "own profile read" on public.profiles;
create policy "own profile read" on public.profiles
  for select to authenticated using (auth.uid() = id);

-- Auto-create a profile row when a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
security definer set search_path = public
language plpgsql
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for users that already exist.
insert into public.profiles (id, email)
select id, email from auth.users
on conflict (id) do nothing;

-- Repoint session tracking at profiles. SAME function name + signature the app
-- already calls (SessionTracker -> track_user_session), so no app change is
-- needed. Updates the per-user last-seen / device / version snapshot and NEVER
-- touches premium_until or is_admin. p_device_id is now unused (profiles is
-- per-user, not per-device) but kept so the existing client call still matches.
create or replace function public.track_user_session(
  p_device_id        text,
  p_platform         text,
  p_platform_version text,
  p_device_model     text,
  p_app_version      text,
  p_locale           text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;

  insert into public.profiles (
    id, email, last_seen_at, platform, platform_version,
    device_model, app_version, locale, open_count
  )
  values (
    auth.uid(),
    (select email from auth.users where id = auth.uid()),
    now(), p_platform, p_platform_version, p_device_model, p_app_version, p_locale, 1
  )
  on conflict (id) do update set
    last_seen_at     = now(),
    platform         = excluded.platform,
    platform_version = excluded.platform_version,
    device_model     = coalesce(excluded.device_model, public.profiles.device_model),
    app_version      = excluded.app_version,
    locale           = excluded.locale,
    open_count       = public.profiles.open_count + 1,
    updated_at       = now();
end;
$$;

grant execute on function public.track_user_session(text, text, text, text, text, text) to authenticated;

-- Admin overview view. RESTRICTED so it is NOT reachable from the app/API:
-- security_invoker makes it honor the base table's RLS instead of its owner's
-- rights, and we revoke the API roles outright. Only the SQL editor (service
-- role, which bypasses RLS) can read it:  SELECT * FROM profiles_overview;
-- Requires Postgres 15+ for security_invoker; on older PG drop that clause —
-- the revoke alone still restricts it.
create or replace view public.profiles_overview
with (security_invoker = true) as
select
  id, email, premium_until,
  (premium_until is not null and premium_until > now()) as pro_active,
  is_admin, last_seen_at, platform, platform_version, device_model,
  app_version, locale, open_count, created_at
from public.profiles
order by last_seen_at desc nulls last;

revoke all on public.profiles_overview from anon, authenticated;

-- ============================================================================
-- HOW TO GRANT / REVOKE PRO (run in the SQL editor)
-- ============================================================================
-- Grant Pro to someone by email (far-future date = "lifetime"):
--
--   insert into public.profiles (id, email, premium_until)
--   select id, email, '2099-01-01'::timestamptz
--   from auth.users where lower(email) = lower('person@example.com')
--   on conflict (id) do update set premium_until = excluded.premium_until, updated_at = now();
--
-- Grant for a limited time (e.g. 1 year):
--   ...  now() + interval '1 year'  ...
--
-- Revoke:
--   update public.profiles set premium_until = null where lower(email) = lower('person@example.com');

-- ============================================================================
-- OPTIONAL: in-app admin grant (only if you later build an admin screen).
-- Lets an is_admin user grant Pro by email from inside the app.
-- ============================================================================
create or replace function public.grant_premium(p_email text, p_until timestamptz)
returns void
security definer set search_path = public
language plpgsql
as $$
declare
  v_uid uuid;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin) then
    raise exception 'Not authorized';
  end if;
  select id into v_uid from auth.users where lower(email) = lower(p_email);
  if v_uid is null then
    raise exception 'No user with email %', p_email;
  end if;
  insert into public.profiles (id, email, premium_until)
  values (v_uid, p_email, p_until)
  on conflict (id) do update set premium_until = excluded.premium_until, updated_at = now();
end;
$$;

grant execute on function public.grant_premium(text, timestamptz) to authenticated;

-- Make yourself an admin (needed only for grant_premium / a future admin screen):
--   update public.profiles set is_admin = true where lower(email) = lower('nh@asasoftware.aero');

-- ============================================================================
-- OPTIONAL cleanup once profiles is live and you no longer need per-device
-- history. DESTRUCTIVE — only run when you're sure:
--   drop view  if exists public.user_devices_overview;
--   drop table if exists public.user_devices;
-- ============================================================================
