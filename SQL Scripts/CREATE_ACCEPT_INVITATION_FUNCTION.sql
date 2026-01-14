-- Create a function to accept household invitations
-- This uses SECURITY DEFINER to bypass RLS when adding the new member
CREATE OR REPLACE FUNCTION accept_household_invitation(p_invitation_id UUID)
RETURNS TABLE (
    success BOOLEAN,
    household_id UUID,
    message TEXT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    v_invitation RECORD;
    v_user_email TEXT;
    v_household_id UUID;
BEGIN
    -- Get the current user's email
    SELECT u.email INTO v_user_email
    FROM auth.users u
    WHERE u.id = auth.uid();

    -- Get the invitation details
    SELECT hi.* INTO v_invitation
    FROM public.household_invitations hi
    WHERE hi.id = p_invitation_id
    AND hi.invited_email = v_user_email
    AND hi.status = 'pending'
    AND hi.expires_at > NOW();

    -- Check if invitation exists and is valid
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, 'Invalid or expired invitation'::TEXT;
        RETURN;
    END IF;

    -- Store household_id in a variable to avoid ambiguity
    v_household_id := v_invitation.household_id;

    -- Check if user is already a member
    IF EXISTS (
        SELECT 1 FROM public.household_members hm
        WHERE hm.household_id = v_household_id
        AND hm.user_id = auth.uid()
    ) THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, 'Already a member of this household'::TEXT;
        RETURN;
    END IF;

    -- Add user as a member
    INSERT INTO public.household_members (household_id, user_id, role)
    VALUES (v_household_id, auth.uid(), 'member');

    -- Update invitation status
    UPDATE public.household_invitations
    SET status = 'accepted'
    WHERE id = p_invitation_id;

    -- Return success
    RETURN QUERY SELECT TRUE, v_household_id::UUID, 'Successfully joined household'::TEXT;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION accept_household_invitation(UUID) TO authenticated;
