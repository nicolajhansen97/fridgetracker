-- RPC function to check if a position number is available
-- Checks uniqueness within household or personal scope

CREATE OR REPLACE FUNCTION is_position_available(
    p_position INTEGER,
    p_household_id UUID DEFAULT NULL,
    p_exclude_item_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    position_exists BOOLEAN;
BEGIN
    -- Check if position is NULL (always available for NULL)
    IF p_position IS NULL THEN
        RETURN TRUE;
    END IF;

    IF p_household_id IS NOT NULL THEN
        -- Check in household context: position must be unique per household
        SELECT EXISTS (
            SELECT 1 FROM public.fridge_items
            WHERE household_id = p_household_id
            AND position = p_position
            AND (p_exclude_item_id IS NULL OR id != p_exclude_item_id)
        ) INTO position_exists;
    ELSE
        -- Check in personal context: position must be unique per user
        SELECT EXISTS (
            SELECT 1 FROM public.fridge_items
            WHERE user_id = auth.uid()
            AND household_id IS NULL
            AND position = p_position
            AND (p_exclude_item_id IS NULL OR id != p_exclude_item_id)
        ) INTO position_exists;
    END IF;

    -- Return TRUE if position is available (NOT exists)
    RETURN NOT position_exists;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION is_position_available(INTEGER, UUID, UUID) TO authenticated;

-- Note: Use p_exclude_item_id when updating an item to exclude it from the check
-- Example usage:
--   SELECT is_position_available(5, 'household-uuid', NULL); -- Check if position 5 available
--   SELECT is_position_available(5, 'household-uuid', 'item-uuid'); -- Check for update
