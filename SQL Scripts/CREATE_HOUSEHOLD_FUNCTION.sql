-- Atomically create a household, add the creator as owner, and migrate the
-- creator's personal items (fridge_items / drawers / shopping_list rows that
-- have household_id IS NULL) into the new household so nothing "disappears"
-- when the user goes from solo → household mode.
--
-- IMPORTANT: returns SETOF public.households (not RETURNS TABLE(...)) on
-- purpose. A named OUT parameter list silently puts every OUT name into the
-- function body's scope; with table columns called id/name/created_by/etc.,
-- *any* of those collide and Postgres raises "column reference X is
-- ambiguous". SETOF <table> reuses the table's rowtype with no named OUT
-- params, so there's nothing to shadow.

-- Drop every overload (TEXT, VARCHAR, no-arg, …) so an old signature can't
-- linger and get called instead of this one.
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oid::regprocedure AS sig
        FROM pg_proc
        WHERE proname = 'create_household_with_owner'
          AND pronamespace = 'public'::regnamespace
    LOOP
        EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE';
    END LOOP;
END $$;

CREATE FUNCTION create_household_with_owner(p_household_name TEXT)
RETURNS SETOF public.households
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
#variable_conflict use_column
DECLARE
    v_household_id UUID;
    v_user_id      UUID := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- 1. Create the household
    INSERT INTO public.households (name, created_by)
    VALUES (p_household_name, v_user_id)
    RETURNING public.households.id INTO v_household_id;

    -- 2. Add the creator as owner
    INSERT INTO public.household_members (household_id, user_id, role)
    VALUES (v_household_id, v_user_id, 'owner');

    -- 3. Move the creator's personal items into the new household so they
    --    stay visible after the switch. Only touches rows currently in
    --    "personal" mode (household_id IS NULL) belonging to this user.
    UPDATE public.fridge_items f
       SET household_id = v_household_id
     WHERE f.user_id = v_user_id
       AND f.household_id IS NULL;

    UPDATE public.drawers d
       SET household_id = v_household_id
     WHERE d.user_id = v_user_id
       AND d.household_id IS NULL;

    UPDATE public.shopping_list sl
       SET household_id = v_household_id
     WHERE sl.user_id = v_user_id
       AND sl.household_id IS NULL;

    -- 4. Return the new household row
    RETURN QUERY
    SELECT h.*
    FROM public.households h
    WHERE h.id = v_household_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_household_with_owner(TEXT) TO authenticated;
