-- RPC function to retrieve activity log with user emails
-- Returns paginated activity history for household or personal items

CREATE OR REPLACE FUNCTION get_activity_log(
    p_household_id UUID DEFAULT NULL,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    household_id UUID,
    item_id UUID,
    user_id UUID,
    user_email TEXT,
    action TEXT,
    item_name TEXT,
    item_drawer TEXT,
    changes JSONB,
    created_at TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    -- Authorization check
    IF p_household_id IS NOT NULL THEN
        -- User must be member of household to view household activity
        IF NOT EXISTS (
            SELECT 1 FROM public.household_members hm
            WHERE hm.household_id = p_household_id
            AND hm.user_id = auth.uid()
        ) THEN
            RAISE EXCEPTION 'Not authorized to view this household activity';
        END IF;
    END IF;
    -- For personal items (p_household_id IS NULL), RLS will handle authorization

    -- Return activity log with user emails joined
    RETURN QUERY
    SELECT
        al.id::UUID,
        al.household_id::UUID,
        al.item_id::UUID,
        al.user_id::UUID,
        COALESCE(u.email, 'Unknown')::TEXT as user_email,
        al.action::TEXT,
        al.item_name::TEXT,
        al.item_drawer::TEXT,
        al.changes::JSONB,
        al.created_at::TIMESTAMPTZ
    FROM public.activity_log al
    LEFT JOIN auth.users u ON al.user_id = u.id
    WHERE
        -- Filter by household or personal items
        (p_household_id IS NULL AND al.household_id IS NULL AND al.user_id = auth.uid())
        OR (p_household_id IS NOT NULL AND al.household_id = p_household_id)
    ORDER BY al.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_activity_log(UUID, INTEGER, INTEGER) TO authenticated;

-- Note: This function supports pagination via p_limit and p_offset
-- Example usage: SELECT * FROM get_activity_log('household-uuid', 50, 0);
