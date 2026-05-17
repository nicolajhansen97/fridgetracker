-- Per-user customization of freezer-storage durations.
--
-- The app ships with default month counts per category (meat, fish, dairy,
-- ...) and per sub-bucket (groundMeat, bacon, leanFish, ...). National food
-- agencies disagree by 1-3mo on most foods (e.g. Danish Fødevarestyrelsen
-- recommends 1-2mo for bread while USDA allows ~3mo), so users can override
-- any of those numbers here.
--
-- Storage shape: a JSONB map keyed by category-or-sub-bucket name, value =
-- whole months. Only changed values are stored; missing keys fall back to
-- the in-code defaults from src/utils/freezerStorage.js.
--   Example:  { "bread": 2, "groundMeat": 2 }
--
-- Settings are per-user (NOT per-household) because storage preferences
-- are personal — different family members on the same household may have
-- different comfort levels.

CREATE TABLE IF NOT EXISTS public.user_freezer_settings (
    user_id    UUID         PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    overrides  JSONB        NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_freezer_settings ENABLE ROW LEVEL SECURITY;

-- Re-run-safe: drop old policies before recreating.
DROP POLICY IF EXISTS "user_freezer_settings_select" ON public.user_freezer_settings;
DROP POLICY IF EXISTS "user_freezer_settings_insert" ON public.user_freezer_settings;
DROP POLICY IF EXISTS "user_freezer_settings_update" ON public.user_freezer_settings;

CREATE POLICY "user_freezer_settings_select"
    ON public.user_freezer_settings FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "user_freezer_settings_insert"
    ON public.user_freezer_settings FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_freezer_settings_update"
    ON public.user_freezer_settings FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE ON public.user_freezer_settings TO authenticated;

-- Keep updated_at fresh on every write so we can detect stale local caches
-- later if we ever add device-level sync optimizations.
CREATE OR REPLACE FUNCTION public.touch_user_freezer_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_touch_user_freezer_settings ON public.user_freezer_settings;
CREATE TRIGGER trigger_touch_user_freezer_settings
    BEFORE UPDATE ON public.user_freezer_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.touch_user_freezer_settings_updated_at();
