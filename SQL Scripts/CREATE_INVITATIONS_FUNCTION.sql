-- Create a function to get household invitations with household names
-- This uses SECURITY DEFINER to access auth.users
CREATE OR REPLACE FUNCTION get_user_invitations()
RETURNS TABLE (
    id UUID,
    household_id UUID,
    invited_email TEXT,
    invited_by UUID,
    status TEXT,
    created_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    household_name TEXT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    user_email TEXT;
BEGIN
    -- Get the current user's email from auth.users
    SELECT u.email INTO user_email
    FROM auth.users u
    WHERE u.id = auth.uid();

    -- Return invitations for this user's email
    RETURN QUERY
    SELECT
        hi.id,
        hi.household_id,
        hi.invited_email,
        hi.invited_by,
        hi.status,
        hi.created_at,
        hi.expires_at,
        h.name as household_name
    FROM public.household_invitations hi
    LEFT JOIN public.households h ON hi.household_id = h.id
    WHERE hi.invited_email = user_email
    AND hi.status = 'pending'
    AND hi.expires_at > NOW();
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_user_invitations() TO authenticated;
