-- Units people add themselves in the amount picker ("bags", "boxes"…).
-- Household-scoped like saved_recipes: every member of a household sees the
-- same list. Solo users (no household) save against household_id = NULL and
-- only see their own rows.
--
-- Items store their unit as plain text in fridge_items.unit, so removing a
-- unit here never changes existing items.

CREATE TABLE IF NOT EXISTS public.custom_units (
    id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id       UUID         REFERENCES public.households(id) ON DELETE CASCADE,
    created_by_user_id UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name               TEXT         NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 15),
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- One "bags" per household (or per solo user), whatever the letter case.
CREATE UNIQUE INDEX IF NOT EXISTS uq_custom_units_household_name
    ON public.custom_units(household_id, lower(name))
    WHERE household_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_custom_units_solo_name
    ON public.custom_units(created_by_user_id, lower(name))
    WHERE household_id IS NULL;

ALTER TABLE public.custom_units ENABLE ROW LEVEL SECURITY;

-- Reset policies so re-running this file always lands in a known state.
DROP POLICY IF EXISTS "custom_units_select" ON public.custom_units;
DROP POLICY IF EXISTS "custom_units_insert" ON public.custom_units;
DROP POLICY IF EXISTS "custom_units_delete" ON public.custom_units;

-- Read: members of the row's household, OR the owner of a solo (no-household) row.
CREATE POLICY "custom_units_select"
    ON public.custom_units FOR SELECT
    USING (
        (household_id IS NULL AND created_by_user_id = auth.uid())
        OR EXISTS (
            SELECT 1 FROM public.household_members hm
            WHERE hm.household_id = custom_units.household_id
              AND hm.user_id = auth.uid()
        )
    );

-- Insert: caller must be the creator. If household_id is set, they must be a member.
CREATE POLICY "custom_units_insert"
    ON public.custom_units FOR INSERT
    WITH CHECK (
        created_by_user_id = auth.uid()
        AND (
            household_id IS NULL
            OR EXISTS (
                SELECT 1 FROM public.household_members hm
                WHERE hm.household_id = custom_units.household_id
                  AND hm.user_id = auth.uid()
            )
        )
    );

-- Delete: any household member can remove a unit (matches saved_recipes).
-- Solo entries: only the owner.
CREATE POLICY "custom_units_delete"
    ON public.custom_units FOR DELETE
    USING (
        (household_id IS NULL AND created_by_user_id = auth.uid())
        OR EXISTS (
            SELECT 1 FROM public.household_members hm
            WHERE hm.household_id = custom_units.household_id
              AND hm.user_id = auth.uid()
        )
    );

GRANT SELECT, INSERT, DELETE ON public.custom_units TO authenticated;
