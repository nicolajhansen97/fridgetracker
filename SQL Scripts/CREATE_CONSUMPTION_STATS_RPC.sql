-- Consumption stats for the Restock feature.
--
-- Aggregates the activity_log per item (grouped by a normalised, lower-cased
-- name) over a time window, so the app can tell how fast each item is used up
-- and whether it's over- or under-stocked. Runs server-side so it isn't capped
-- by the 500-row client fetch that FreezerStatsScreen uses.
--
-- Consumed events (full + partial "used") store the amount used in
-- changes->>'quantity'; "thrown away" lands as a 'deleted' action (waste).
--
-- Mirrors the auth model of get_activity_log (see CREATE_ACTIVITY_RPC.sql).

CREATE OR REPLACE FUNCTION public.get_consumption_stats(
    p_household_id UUID DEFAULT NULL,
    p_since TIMESTAMPTZ DEFAULT (timezone('utc'::text, now()) - INTERVAL '90 days')
)
RETURNS TABLE (
    name_key TEXT,
    item_name TEXT,
    consumed_events INTEGER,
    consumed_qty NUMERIC,
    thrown_events INTEGER,
    last_consumed TIMESTAMPTZ,
    first_activity TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    -- Household members only; personal rows fall back to RLS via user_id.
    IF p_household_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.household_members hm
            WHERE hm.household_id = p_household_id
            AND hm.user_id = auth.uid()
        ) THEN
            RAISE EXCEPTION 'Not authorized to view this household activity';
        END IF;
    END IF;

    RETURN QUERY
    WITH scoped AS (
        SELECT al.item_name, al.action, al.changes, al.created_at
        FROM public.activity_log al
        WHERE al.created_at >= p_since
          AND (
              (p_household_id IS NULL AND al.household_id IS NULL AND al.user_id = auth.uid())
              OR (p_household_id IS NOT NULL AND al.household_id = p_household_id)
          )
    )
    SELECT
        lower(trim(s.item_name))::TEXT AS name_key,
        -- Display name = the spelling used most recently.
        (array_agg(s.item_name ORDER BY s.created_at DESC))[1]::TEXT AS item_name,
        COUNT(*) FILTER (WHERE s.action = 'consumed')::INTEGER AS consumed_events,
        COALESCE(
            SUM((s.changes->>'quantity')::NUMERIC) FILTER (WHERE s.action = 'consumed'),
            0
        )::NUMERIC AS consumed_qty,
        COUNT(*) FILTER (WHERE s.action = 'deleted')::INTEGER AS thrown_events,
        MAX(s.created_at) FILTER (WHERE s.action = 'consumed') AS last_consumed,
        MIN(s.created_at) AS first_activity
    FROM scoped s
    GROUP BY lower(trim(s.item_name));
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_consumption_stats(UUID, TIMESTAMPTZ) TO authenticated;

-- Example: SELECT * FROM get_consumption_stats('household-uuid', now() - interval '90 days');
