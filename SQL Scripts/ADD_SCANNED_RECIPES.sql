-- Scanned recipes (Freezely Pro): a recipe read from a photo of a cookbook
-- page, printout or handwritten card lives in the same household cookbook
-- (public.saved_recipes) as AI recipes. It has the same shape (title,
-- servings, minutes, ingredients JSON, steps JSON), so no new table:
--
--   saved_recipes.source  'ai' (default, every existing row) | 'scan'
--
-- The app uses `source` to label scanned recipes ("Scanned") and to treat
-- removing one as a delete (there is no AI to get it back from).
--
-- recipe_generation_log.kind lets the scan-recipe edge function count scans
-- separately from recipe generations, so scanning a cookbook doesn't use up
-- the 3 daily "find recipes" requests (and vice versa).
--
-- It also adds the UPDATE policy that editing a scanned recipe needs.
--
-- Safe to re-run. Until it runs: editing a recipe fails with "Couldn't save
-- your changes" (nothing is lost), the app still saves scans (it retries the
-- insert without `source`, so they show as ordinary saved recipes), and
-- scan-recipe skips its daily cap (it fails open).

ALTER TABLE public.saved_recipes
    ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'ai';

ALTER TABLE public.saved_recipes
    DROP CONSTRAINT IF EXISTS saved_recipes_source_check;
ALTER TABLE public.saved_recipes
    ADD CONSTRAINT saved_recipes_source_check CHECK (source IN ('ai', 'scan'));

-- Editing a saved recipe (fixing a misread word or amount in a scan).
-- Same rule as delete: any household member, or the owner of a solo row.
-- Without this policy, RLS silently turns every UPDATE into a no-op.
DROP POLICY IF EXISTS "saved_recipes_update" ON public.saved_recipes;
CREATE POLICY "saved_recipes_update"
    ON public.saved_recipes FOR UPDATE
    USING (
        (household_id IS NULL AND saved_by_user_id = auth.uid())
        OR EXISTS (
            SELECT 1 FROM public.household_members hm
            WHERE hm.household_id = saved_recipes.household_id
              AND hm.user_id = auth.uid()
        )
    )
    WITH CHECK (
        (household_id IS NULL AND saved_by_user_id = auth.uid())
        OR EXISTS (
            SELECT 1 FROM public.household_members hm
            WHERE hm.household_id = saved_recipes.household_id
              AND hm.user_id = auth.uid()
        )
    );

-- Only the recipe content is editable; who saved it and where stays fixed.
REVOKE UPDATE ON public.saved_recipes FROM authenticated;
GRANT UPDATE (title, description, total_minutes, servings, ingredients, steps)
    ON public.saved_recipes TO authenticated;

-- The AI usage log (CREATE_RECIPE_GENERATION_LOG.sql) may never have been
-- created in prod; without it the daily AI caps silently don't apply. Create
-- it here if missing (same definition, service_role only, no policies).
CREATE TABLE IF NOT EXISTS public.recipe_generation_log (
    id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_recipe_gen_log_user_day
    ON public.recipe_generation_log(user_id, created_at DESC);
ALTER TABLE public.recipe_generation_log ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.recipe_generation_log
    ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'recipes';

CREATE INDEX IF NOT EXISTS idx_recipe_gen_log_user_kind_day
    ON public.recipe_generation_log(user_id, kind, created_at DESC);

-- The updated generate-recipes counts only kind = 'recipes' toward its cap
-- (and falls back to counting every row while this column doesn't exist).
-- Deploy it together with scan-recipe.

-- Make the API see the new column right away.
NOTIFY pgrst, 'reload schema';

-- Check:
-- SELECT source, count(*) FROM public.saved_recipes GROUP BY 1;
-- SELECT kind, count(*) FROM public.recipe_generation_log GROUP BY 1;
