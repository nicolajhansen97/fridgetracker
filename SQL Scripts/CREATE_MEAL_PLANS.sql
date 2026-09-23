-- Weekly meal plan.
--
-- The app can already suggest a recipe from what's in the freezer, but each
-- suggestion is a one-shot: ask, read, forget. Nothing connects "these three
-- things expire on Thursday" to "here is what we're eating on Thursday", and
-- nothing carries the missing ingredients through to the shopping list. This
-- table is the missing middle — a plan that persists, is shared across the
-- household, and knows which items it was built to use up.
--
-- Scope notes:
--   * ONE meal per day. Breakfast/lunch/dinner slots were tempting, but the
--     question people actually ask is "what's for dinner", and three empty
--     slots per day makes an empty week look like homework. A `slot` column
--     can be added later without touching what's here.
--   * recipe is the whole recipe object, denormalised on purpose. Saved
--     recipes can be edited or deleted, and a plan for last Tuesday should
--     keep saying what was actually cooked.
--   * source_item_ids records which expiring items the plan was built around,
--     so the week view can show "uses 3 items expiring soon" and stop
--     claiming it once they're gone.
--
-- Mirrors the household/RLS model of saved_recipes.
-- Re-runnable.

CREATE TABLE IF NOT EXISTS public.meal_plans (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    household_id UUID REFERENCES public.households(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_date DATE NOT NULL,
    title TEXT NOT NULL,
    recipe JSONB,
    source TEXT NOT NULL DEFAULT 'manual',
    source_item_ids UUID[] DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.meal_plans DROP CONSTRAINT IF EXISTS meal_plans_source_check;
ALTER TABLE public.meal_plans ADD CONSTRAINT meal_plans_source_check
  CHECK (source IN ('manual', 'saved', 'generated'));

-- One meal per day per scope. Partial indexes for the same reason as
-- item_prices: a NULL household_id would never collide on its own.
CREATE UNIQUE INDEX IF NOT EXISTS meal_plans_household_date_idx
    ON public.meal_plans (household_id, plan_date)
    WHERE household_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS meal_plans_user_date_idx
    ON public.meal_plans (user_id, plan_date)
    WHERE household_id IS NULL;

CREATE INDEX IF NOT EXISTS meal_plans_date_idx ON public.meal_plans (plan_date);

ALTER TABLE public.meal_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read own or household meal plans" ON public.meal_plans;
CREATE POLICY "Read own or household meal plans" ON public.meal_plans
    FOR SELECT USING (
        (household_id IS NULL AND user_id = auth.uid())
        OR (household_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.household_members hm
            WHERE hm.household_id = meal_plans.household_id
              AND hm.user_id = auth.uid()
        ))
    );

DROP POLICY IF EXISTS "Write own or household meal plans" ON public.meal_plans;
CREATE POLICY "Write own or household meal plans" ON public.meal_plans
    FOR ALL USING (
        (household_id IS NULL AND user_id = auth.uid())
        OR (household_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.household_members hm
            WHERE hm.household_id = meal_plans.household_id
              AND hm.user_id = auth.uid()
        ))
    ) WITH CHECK (
        (household_id IS NULL AND user_id = auth.uid())
        OR (household_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.household_members hm
            WHERE hm.household_id = meal_plans.household_id
              AND hm.user_id = auth.uid()
        ))
    );

-- Upsert a day's meal. Keeps the household-vs-personal branching out of the
-- app, exactly like remember_item_price.
CREATE OR REPLACE FUNCTION public.set_meal_plan(
    p_date DATE,
    p_title TEXT,
    p_recipe JSONB DEFAULT NULL,
    p_household_id UUID DEFAULT NULL,
    p_source TEXT DEFAULT 'manual',
    p_source_item_ids UUID[] DEFAULT '{}'
)
RETURNS public.meal_plans
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_row public.meal_plans;
BEGIN
  IF p_household_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.household_members hm
      WHERE hm.household_id = p_household_id AND hm.user_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'Not authorized for this household';
    END IF;

    INSERT INTO public.meal_plans (household_id, user_id, plan_date, title, recipe, source, source_item_ids)
    VALUES (p_household_id, auth.uid(), p_date, p_title, p_recipe, p_source, COALESCE(p_source_item_ids, '{}'))
    ON CONFLICT (household_id, plan_date) WHERE household_id IS NOT NULL
    DO UPDATE SET title = EXCLUDED.title,
                  recipe = EXCLUDED.recipe,
                  source = EXCLUDED.source,
                  source_item_ids = EXCLUDED.source_item_ids,
                  user_id = EXCLUDED.user_id,
                  updated_at = timezone('utc'::text, now())
    RETURNING * INTO v_row;
  ELSE
    INSERT INTO public.meal_plans (household_id, user_id, plan_date, title, recipe, source, source_item_ids)
    VALUES (NULL, auth.uid(), p_date, p_title, p_recipe, p_source, COALESCE(p_source_item_ids, '{}'))
    ON CONFLICT (user_id, plan_date) WHERE household_id IS NULL
    DO UPDATE SET title = EXCLUDED.title,
                  recipe = EXCLUDED.recipe,
                  source = EXCLUDED.source,
                  source_item_ids = EXCLUDED.source_item_ids,
                  updated_at = timezone('utc'::text, now())
    RETURNING * INTO v_row;
  END IF;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_meal_plan(DATE, TEXT, JSONB, UUID, TEXT, UUID[]) TO authenticated;
