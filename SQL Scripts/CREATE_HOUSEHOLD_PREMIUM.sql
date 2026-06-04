-- Shared Freezely Pro status for a household.
--
-- Two subscription products both grant the RevenueCat `pro` entitlement:
--   * freezely_pro_monthly            ($0.99/mo) — Pro for the buyer only.
--   * freezely_pro_household_monthly  ($1.49/mo) — Pro for the whole household.
--
-- RevenueCat only tracks the individual buyer, so the household plan is shared
-- through this table: when a member holds the household product, the app
-- upserts the entitlement expiry here. Every member reads it and is treated as
-- Pro while premium_until is in the future. See src/context/PremiumContext.js.
--
-- One row per household. Re-run-safe (IF NOT EXISTS / DROP POLICY IF EXISTS).

CREATE TABLE IF NOT EXISTS public.household_premium (
    household_id  UUID         PRIMARY KEY REFERENCES public.households(id) ON DELETE CASCADE,
    premium_until TIMESTAMPTZ,
    updated_by    UUID         REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

ALTER TABLE public.household_premium ENABLE ROW LEVEL SECURITY;

-- Re-run-safe: drop old policies before recreating.
DROP POLICY IF EXISTS "household_premium_select" ON public.household_premium;
DROP POLICY IF EXISTS "household_premium_insert" ON public.household_premium;
DROP POLICY IF EXISTS "household_premium_update" ON public.household_premium;

-- Any member of the household can read its shared premium status.
CREATE POLICY "household_premium_select"
    ON public.household_premium FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.household_members m
            WHERE m.household_id = household_premium.household_id
              AND m.user_id = auth.uid()
        )
    );

-- Any member may write it — the buyer's client pushes their entitlement expiry.
-- (A future RevenueCat webhook with the service role can replace client writes
-- so renewals propagate even if the buyer never reopens the app.)
CREATE POLICY "household_premium_insert"
    ON public.household_premium FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.household_members m
            WHERE m.household_id = household_premium.household_id
              AND m.user_id = auth.uid()
        )
    );

CREATE POLICY "household_premium_update"
    ON public.household_premium FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.household_members m
            WHERE m.household_id = household_premium.household_id
              AND m.user_id = auth.uid()
        )
    );

GRANT SELECT, INSERT, UPDATE ON public.household_premium TO authenticated;
