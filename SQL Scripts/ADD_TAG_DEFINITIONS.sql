-- A defined set of tags, so "grill" and "gril" cannot both exist.
--
-- ADD_ITEM_TAGS.sql gave items a tags text[] and the app offered suggestions
-- from whatever was already in use. That helps, but it cannot prevent a typo:
-- suggestions are a hint, and a mistyped word still lands as a brand new tag
-- that then shows up in everyone's list forever.
--
-- This makes creating a tag a deliberate act, separate from applying one.
-- fridge_items.tags still stores the names (so filtering and the GIN index are
-- unchanged) but the app now picks from this catalogue instead of free typing.
--
-- Scoped like item_prices: per household where there is one, per user
-- otherwise, so a shared freezer shares its vocabulary.
--
-- Requires ADD_ITEM_TAGS.sql. Re-runnable.

CREATE TABLE IF NOT EXISTS public.tag_definitions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    household_id UUID REFERENCES public.households(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- One definition per name per scope. Two partial indexes rather than one
-- constraint, because a NULL household_id would never collide on its own.
CREATE UNIQUE INDEX IF NOT EXISTS tag_definitions_household_name_idx
    ON public.tag_definitions (household_id, name)
    WHERE household_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS tag_definitions_user_name_idx
    ON public.tag_definitions (user_id, name)
    WHERE household_id IS NULL;

ALTER TABLE public.tag_definitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read own or household tags" ON public.tag_definitions;
CREATE POLICY "Read own or household tags" ON public.tag_definitions
    FOR SELECT USING (
        (household_id IS NULL AND user_id = auth.uid())
        OR (household_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.household_members hm
            WHERE hm.household_id = tag_definitions.household_id
              AND hm.user_id = auth.uid()
        ))
    );

DROP POLICY IF EXISTS "Write own or household tags" ON public.tag_definitions;
CREATE POLICY "Write own or household tags" ON public.tag_definitions
    FOR ALL USING (
        (household_id IS NULL AND user_id = auth.uid())
        OR (household_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.household_members hm
            WHERE hm.household_id = tag_definitions.household_id
              AND hm.user_id = auth.uid()
        ))
    ) WITH CHECK (
        (household_id IS NULL AND user_id = auth.uid())
        OR (household_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.household_members hm
            WHERE hm.household_id = tag_definitions.household_id
              AND hm.user_id = auth.uid()
        ))
    );

-- Create a tag, or return quietly if it already exists. Lower-cased and
-- trimmed here as well as in the app, so the rule holds even if something
-- else ever writes to this table.
CREATE OR REPLACE FUNCTION public.define_tag(
    p_name TEXT,
    p_household_id UUID DEFAULT NULL
)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_name TEXT := lower(trim(p_name));
BEGIN
  IF v_name = '' THEN
    RETURN;
  END IF;

  IF p_household_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.household_members hm
      WHERE hm.household_id = p_household_id AND hm.user_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'Not authorized for this household';
    END IF;

    INSERT INTO public.tag_definitions (household_id, user_id, name)
    VALUES (p_household_id, auth.uid(), v_name)
    ON CONFLICT (household_id, name) WHERE household_id IS NOT NULL DO NOTHING;
  ELSE
    INSERT INTO public.tag_definitions (household_id, user_id, name)
    VALUES (NULL, auth.uid(), v_name)
    ON CONFLICT (user_id, name) WHERE household_id IS NULL DO NOTHING;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.define_tag(TEXT, UUID) TO authenticated;

-- Rename a tag everywhere at once: the definition and every item carrying it.
-- Without this, renaming means editing items one by one, which is exactly the
-- kind of chore that leaves a half-renamed vocabulary behind.
CREATE OR REPLACE FUNCTION public.rename_tag(
    p_old TEXT,
    p_new TEXT,
    p_household_id UUID DEFAULT NULL
)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_old TEXT := lower(trim(p_old));
  v_new TEXT := lower(trim(p_new));
BEGIN
  IF v_old = '' OR v_new = '' OR v_old = v_new THEN
    RETURN;
  END IF;

  IF p_household_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.household_members hm
      WHERE hm.household_id = p_household_id AND hm.user_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'Not authorized for this household';
    END IF;
  END IF;

  -- Merging into an existing tag is allowed: drop the old definition rather
  -- than failing on the unique index.
  DELETE FROM public.tag_definitions
   WHERE name = v_old
     AND (
       (p_household_id IS NULL AND household_id IS NULL AND user_id = auth.uid())
       OR (p_household_id IS NOT NULL AND household_id = p_household_id)
     );

  PERFORM public.define_tag(v_new, p_household_id);

  UPDATE public.fridge_items
     SET tags = (
           SELECT array_agg(DISTINCT CASE WHEN tag = v_old THEN v_new ELSE tag END)
             FROM unnest(tags) AS tag
         )
   WHERE tags @> ARRAY[v_old]
     AND (
       (p_household_id IS NULL AND household_id IS NULL AND user_id = auth.uid())
       OR (p_household_id IS NOT NULL AND household_id = p_household_id)
     );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rename_tag(TEXT, TEXT, UUID) TO authenticated;

-- Seed the catalogue from tags already applied to items, so anything created
-- before this migration keeps working instead of vanishing from the picker.
INSERT INTO public.tag_definitions (household_id, user_id, name)
SELECT DISTINCT fi.household_id, fi.user_id, tag
  FROM public.fridge_items fi, unnest(fi.tags) AS tag
 WHERE tag <> ''
ON CONFLICT DO NOTHING;
