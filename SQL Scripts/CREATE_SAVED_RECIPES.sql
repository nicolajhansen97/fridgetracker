-- Household-scoped "cookbook": members of a household share a saved-recipes
-- collection. Solo users (no household) save against household_id = NULL and
-- only see their own rows.
--
-- The full AI-generated recipe payload is stored as JSON so we can re-render
-- it offline later without re-calling the LLM. Live "in fridge" matching is
-- recomputed client-side from current fridge_items, not baked in.

CREATE TABLE IF NOT EXISTS public.saved_recipes (
    id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id     UUID         REFERENCES public.households(id) ON DELETE CASCADE,
    saved_by_user_id UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title            TEXT         NOT NULL,
    description      TEXT,
    total_minutes    INTEGER,
    servings         INTEGER,
    ingredients      JSONB        NOT NULL DEFAULT '[]'::jsonb,
    steps            JSONB        NOT NULL DEFAULT '[]'::jsonb,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_recipes_household
    ON public.saved_recipes(household_id);
CREATE INDEX IF NOT EXISTS idx_saved_recipes_user
    ON public.saved_recipes(saved_by_user_id);

ALTER TABLE public.saved_recipes ENABLE ROW LEVEL SECURITY;

-- Reset policies so re-running this file always lands in a known state.
DROP POLICY IF EXISTS "saved_recipes_select" ON public.saved_recipes;
DROP POLICY IF EXISTS "saved_recipes_insert" ON public.saved_recipes;
DROP POLICY IF EXISTS "saved_recipes_delete" ON public.saved_recipes;

-- Read: members of the row's household, OR the owner of a solo (no-household) row.
CREATE POLICY "saved_recipes_select"
    ON public.saved_recipes FOR SELECT
    USING (
        (household_id IS NULL AND saved_by_user_id = auth.uid())
        OR EXISTS (
            SELECT 1 FROM public.household_members hm
            WHERE hm.household_id = saved_recipes.household_id
              AND hm.user_id = auth.uid()
        )
    );

-- Insert: caller must be the saver. If household_id is set, they must be a member.
CREATE POLICY "saved_recipes_insert"
    ON public.saved_recipes FOR INSERT
    WITH CHECK (
        saved_by_user_id = auth.uid()
        AND (
            household_id IS NULL
            OR EXISTS (
                SELECT 1 FROM public.household_members hm
                WHERE hm.household_id = saved_recipes.household_id
                  AND hm.user_id = auth.uid()
            )
        )
    );

-- Delete: any household member can unsave (matches how shopping_list / drawers behave).
-- Solo entries: only the owner.
CREATE POLICY "saved_recipes_delete"
    ON public.saved_recipes FOR DELETE
    USING (
        (household_id IS NULL AND saved_by_user_id = auth.uid())
        OR EXISTS (
            SELECT 1 FROM public.household_members hm
            WHERE hm.household_id = saved_recipes.household_id
              AND hm.user_id = auth.uid()
        )
    );

GRANT SELECT, INSERT, DELETE ON public.saved_recipes TO authenticated;
