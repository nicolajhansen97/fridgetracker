-- Delete a tag everywhere at once: the definition and every item carrying it.
--
-- ADD_TAG_DEFINITIONS.sql made creating a tag deliberate, but gave no way back
-- out. A mistyped "gril" that slipped past the near-match check stayed in the
-- household's list for good.
--
-- Both halves have to go together. The picker only shows defined tags, so a
-- tag removed from the catalogue but left on items would become invisible and
-- impossible to untick, while still matching searches. And a definition left
-- behind with no items is exactly the clutter this is meant to clear.
--
-- Scoped exactly like define_tag and rename_tag. Requires ADD_TAG_DEFINITIONS.sql.
-- Re-runnable.

CREATE OR REPLACE FUNCTION public.delete_tag(
    p_name TEXT,
    p_household_id UUID DEFAULT NULL
)
RETURNS INTEGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_name TEXT := lower(trim(p_name));
  v_items INTEGER := 0;
BEGIN
  IF v_name = '' THEN
    RETURN 0;
  END IF;

  IF p_household_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.household_members hm
      WHERE hm.household_id = p_household_id AND hm.user_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'Not authorized for this household';
    END IF;
  END IF;

  DELETE FROM public.tag_definitions
   WHERE name = v_name
     AND (
       (p_household_id IS NULL AND household_id IS NULL AND user_id = auth.uid())
       OR (p_household_id IS NOT NULL AND household_id = p_household_id)
     );

  -- array_remove rather than the array_agg rename_tag uses: removing the last
  -- tag must leave '{}', and array_agg over nothing is NULL, which the NOT NULL
  -- column would reject.
  UPDATE public.fridge_items
     SET tags = array_remove(tags, v_name)
   WHERE tags @> ARRAY[v_name]
     AND (
       (p_household_id IS NULL AND household_id IS NULL AND user_id = auth.uid())
       OR (p_household_id IS NOT NULL AND household_id = p_household_id)
     );

  GET DIAGNOSTICS v_items = ROW_COUNT;
  RETURN v_items;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_tag(TEXT, UUID) TO authenticated;
