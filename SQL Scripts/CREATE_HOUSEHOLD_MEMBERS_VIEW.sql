-- Create a function to get household members with user emails
-- This uses SECURITY DEFINER to access auth.users
CREATE OR REPLACE FUNCTION get_household_members(p_household_id UUID)
RETURNS TABLE (
    id UUID,
    household_id UUID,
    user_id UUID,
    role TEXT,
    joined_at TIMESTAMPTZ,
    user_email TEXT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    -- Check if the current user is a member of this household
    IF NOT EXISTS (
        SELECT 1 FROM public.household_members hm2
        WHERE hm2.household_id = p_household_id
        AND hm2.user_id = auth.uid()
    ) THEN
        -- User is not a member, return empty result
        RETURN;
    END IF;

    -- User is a member, return all members with their emails
    RETURN QUERY
    SELECT
        hm.id::UUID,
        hm.household_id::UUID,
        hm.user_id::UUID,
        hm.role::TEXT,
        hm.joined_at::TIMESTAMPTZ,
        COALESCE(u.email, 'Unknown')::TEXT as user_email
    FROM public.household_members hm
    LEFT JOIN auth.users u ON hm.user_id = u.id
    WHERE hm.household_id = p_household_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_household_members(UUID) TO authenticated;
