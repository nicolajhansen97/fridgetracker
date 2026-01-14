-- Create a function to atomically create a household and add the creator as owner
-- This bypasses RLS since it runs with SECURITY DEFINER
CREATE OR REPLACE FUNCTION create_household_with_owner(household_name TEXT)
RETURNS TABLE (
    household_id UUID,
    name TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    new_household_id UUID;
BEGIN
    -- Insert the household
    INSERT INTO public.households (name, created_by)
    VALUES (household_name, auth.uid())
    RETURNING id INTO new_household_id;

    -- Add the creator as owner
    INSERT INTO public.household_members (household_id, user_id, role)
    VALUES (new_household_id, auth.uid(), 'owner');

    -- Return the household data
    RETURN QUERY
    SELECT h.id, h.name, h.created_by, h.created_at, h.updated_at
    FROM public.households h
    WHERE h.id = new_household_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_household_with_owner(TEXT) TO authenticated;
