-- Server-side visibility into who actually holds a paid subscription.
--
-- Until now the ONLY record of a real purchase lived in RevenueCat: the app
-- read `entitlements.active.pro` and gated features on it, and nothing was ever
-- written back to Supabase. `profiles.premium_until` is the manual comp lane and
-- is never touched by a purchase. That left a blind spot — a paying user whose
-- entitlement failed to attach looked identical to a free user in the database,
-- with no way to notice it from here. (This is exactly how a household purchase
-- could be charged by Google while the app still showed the Free plan.)
--
-- This adds a set of `pro_*` mirror columns that the app writes on every launch,
-- purchase and restore (see syncSubscriptionState in src/context/PremiumContext.js).
-- They are deliberately SEPARATE from premium_until so that:
--   * comps and paid subscriptions stay distinguishable, and
--   * a sync can never overwrite a manual grant.
--
-- The mirror is only as fresh as the user's last app launch — `pro_synced_at`
-- tells you how much to trust it. A RevenueCat webhook writing the same columns
-- with the service role is the eventual upgrade; the schema here is already
-- shaped for it.
--
-- Requires CREATE_PROFILES.sql and CREATE_HOUSEHOLD_PREMIUM.sql.
-- Run once in the Supabase SQL editor. Re-runnable.

-- ============================================================================
-- 1. Mirror columns
-- ============================================================================

alter table public.profiles add column if not exists pro_until       timestamptz;
alter table public.profiles add column if not exists pro_product_id  text;
alter table public.profiles add column if not exists pro_store       text;
alter table public.profiles add column if not exists pro_period_type text;
alter table public.profiles add column if not exists pro_will_renew  boolean;
alter table public.profiles add column if not exists pro_synced_at   timestamptz;
alter table public.profiles add column if not exists rc_app_user_id  text;

create index if not exists profiles_pro_until_idx on public.profiles (pro_until);

comment on column public.profiles.pro_until is
  'Store subscription expiry as reported by RevenueCat. NULL = no active `pro` entitlement at last sync. Distinct from premium_until, which is the manual comp.';
comment on column public.profiles.pro_synced_at is
  'When the app last reported this user''s entitlement state. Stale value = the user has not opened the app since; it does NOT mean the subscription lapsed.';
comment on column public.profiles.rc_app_user_id is
  'RevenueCat app user id the entitlement was read under. Paste into the RevenueCat dashboard customer search when diagnosing a missing purchase.';

-- ============================================================================
-- 2. Sync RPC — called by the app, writes ONLY the mirror columns
-- ============================================================================
--
-- SECURITY DEFINER because profiles has no insert/update policy (users must not
-- be able to write their own Pro status). This function is the one narrow hole,
-- and it deliberately cannot touch premium_until or is_admin.

create or replace function public.sync_subscription_state(
  p_pro_until      timestamptz,
  p_product_id     text,
  p_store          text,
  p_period_type    text,
  p_will_renew     boolean,
  p_rc_app_user_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  insert into public.profiles (
    id, email, pro_until, pro_product_id, pro_store,
    pro_period_type, pro_will_renew, rc_app_user_id, pro_synced_at
  )
  values (
    auth.uid(),
    (select email from auth.users where id = auth.uid()),
    p_pro_until, p_product_id, p_store,
    p_period_type, p_will_renew, p_rc_app_user_id, now()
  )
  on conflict (id) do update set
    pro_until       = excluded.pro_until,
    pro_product_id  = excluded.pro_product_id,
    pro_store       = excluded.pro_store,
    pro_period_type = excluded.pro_period_type,
    pro_will_renew  = excluded.pro_will_renew,
    -- Keep the last known id if the client reports nothing this time.
    rc_app_user_id  = coalesce(excluded.rc_app_user_id, public.profiles.rc_app_user_id),
    pro_synced_at   = now(),
    updated_at      = now();
end;
$$;

grant execute on function
  public.sync_subscription_state(timestamptz, text, text, text, boolean, text)
  to authenticated;

-- ============================================================================
-- 3. Overview — one row per user, every Pro route resolved
-- ============================================================================
--
-- RESTRICTED like profiles_overview: security_invoker makes it honour the base
-- table's RLS instead of the owner's rights, and the API roles are revoked. Only
-- the SQL editor (service role) can read it.

create or replace view public.subscription_overview
with (security_invoker = true) as
with member_premium as (
  -- One household per user: the one whose shared premium runs longest.
  select distinct on (hm.user_id)
    hm.user_id,
    hp.premium_until as household_until,
    h.name           as household_name
  from public.household_members hm
  join public.household_premium hp on hp.household_id = hm.household_id
  join public.households        h  on h.id            = hm.household_id
  order by hm.user_id, hp.premium_until desc nulls last
),
resolved as (
  select
    p.*,
    mp.household_until,
    mp.household_name,
    greatest(p.pro_until, p.premium_until, mp.household_until) as expires_at
  from public.profiles p
  left join member_premium mp on mp.user_id = p.id
)
select
  email,
  coalesce(expires_at > now(), false) as is_pro,
  case
    when pro_until        is not null and pro_until        > now() then 'paid'
    when premium_until    is not null and premium_until    > now() then 'comped'
    when household_until  is not null and household_until  > now() then 'household'
  end                                 as pro_source,
  expires_at                          as expires_at,
  case
    when expires_at > now()
    then ceil(extract(epoch from (expires_at - now())) / 86400)::int
  end                                 as days_left,
  pro_will_renew                      as will_renew,
  pro_period_type                     as period,      -- NORMAL / TRIAL / INTRO
  pro_product_id                      as product,
  pro_store                           as store,       -- PLAY_STORE / APP_STORE
  household_name,
  pro_synced_at                       as last_synced_at,
  last_seen_at,
  app_version,
  platform,
  rc_app_user_id,
  id                                  as user_id,
  -- Red flag. The entitlement was read under a throwaway anonymous customer
  -- instead of the signed-in user, which is how a real purchase goes missing.
  -- NOTE: only meaningful from app v1.1.2+; earlier builds recorded
  -- originalAppUserId, which reads anonymous for every pre-existing install
  -- regardless of whether identification actually works.
  coalesce(rc_app_user_id like '$RCAnonymousID:%', false) as rc_anonymous
from resolved
order by is_pro desc, expires_at desc nulls last;

revoke all on public.subscription_overview from anon, authenticated;

-- ============================================================================
-- HOW TO USE (run in the SQL editor)
-- ============================================================================
--
-- Everyone who is Pro right now, and for how much longer:
--   select email, pro_source, days_left, expires_at, will_renew, product
--   from public.subscription_overview
--   where is_pro
--   order by days_left;
--
-- Paying subscribers only (excludes comps and household members):
--   select email, days_left, expires_at, will_renew, product, store
--   from public.subscription_overview
--   where pro_source = 'paid'
--   order by expires_at;
--
-- Expiring within a week and NOT set to renew — i.e. actually churning:
--   select email, days_left, expires_at, product
--   from public.subscription_overview
--   where is_pro and days_left <= 7 and will_renew is not true
--   order by days_left;
--
-- Free trials in progress:
--   select email, days_left, expires_at, product
--   from public.subscription_overview
--   where period = 'TRIAL' and is_pro;
--
-- Stale mirrors — subscription looks expired but the user simply hasn't opened
-- the app. Check RevenueCat before assuming they churned:
--   select email, expires_at, last_synced_at, last_seen_at
--   from public.subscription_overview
--   where not is_pro
--     and last_synced_at is not null
--     and last_synced_at < now() - interval '30 days';
--
-- Diagnosing "I paid but the app says Free": grab their RevenueCat customer id
-- and look it up in the dashboard. pro_until NULL here means the app asked
-- RevenueCat and was told there is no active entitlement.
--   select email, pro_until, rc_app_user_id, last_synced_at, app_version, platform
--   from public.subscription_overview
--   where email = 'person@example.com';
