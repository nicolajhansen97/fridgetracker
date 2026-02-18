-- Verification and Fix Script for Household Functions
-- Run this in Supabase SQL Editor if you're getting errors about missing functions

-- ============================================
-- STEP 1: Check if functions exist
-- ============================================

-- Check if get_household_members exists
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name = 'get_household_members';

-- If the above returns no rows, the function is missing!

-- ============================================
-- STEP 2: Recreate the function
-- ============================================

-- Drop and recreate get_household_members function
DROP FUNCTION IF EXISTS get_household_members(UUID);

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

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_household_members(UUID) TO authenticated;

-- ============================================
-- STEP 3: Verify other required functions
-- ============================================

-- Check for other household-related functions
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN (
    'get_user_invitations',
    'create_household_with_owner',
    'accept_household_invitation'
);

-- If any are missing, you'll need to run their respective CREATE scripts:
-- - CREATE_INVITATIONS_VIEW.sql for get_user_invitations
-- - CREATE_HOUSEHOLD_WITH_OWNER.sql for create_household_with_owner
-- - ACCEPT_INVITATION_RPC.sql for accept_household_invitation
