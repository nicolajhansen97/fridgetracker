-- Distinguish "thrown away" from "deleted".
--
-- Until now the Throw away action called a plain delete, which the activity
-- trigger logged as 'deleted' — the same action as removing a row you typed in
-- wrong. That makes waste impossible to measure: every food-waste statistic we
-- might want to show is mixed in with routine tidying.
--
-- This adds a 'thrown' action and a throw_fridge_item() RPC, mirroring
-- consume_fridge_item() exactly (same snapshot fields, same trigger dance) so
-- the two sit symmetrically in the history: 'consumed' = eaten, 'thrown' =
-- wasted, 'deleted' = removed for some other reason.
--
-- IMPORTANT: waste data only accrues from the moment this is live. Nothing can
-- be backfilled — historic 'deleted' rows stay ambiguous forever, so run this
-- as early as possible even if the statistics that use it come later.
--
-- Requires CREATE_ACTIVITY_LOG_TABLE.sql and ADD_CONSUMED_ACTION.sql.
-- Re-runnable.

ALTER TABLE public.activity_log DROP CONSTRAINT IF EXISTS activity_log_action_check;
ALTER TABLE public.activity_log ADD CONSTRAINT activity_log_action_check
  CHECK (action IN ('created', 'updated', 'deleted', 'consumed', 'thrown'));

-- Mark an item as thrown away: log 'thrown', then delete the row. The activity
-- trigger would otherwise add its own 'deleted' entry, so it is disabled for
-- the duration exactly as consume_fridge_item does.
CREATE OR REPLACE FUNCTION public.throw_fridge_item(p_item_id UUID)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_item RECORD;
BEGIN
  SELECT * INTO v_item FROM public.fridge_items WHERE id = p_item_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item not found';
  END IF;

  INSERT INTO public.activity_log (
    household_id, item_id, user_id, action, item_name, item_drawer, changes
  ) VALUES (
    v_item.household_id,
    v_item.id,
    auth.uid(),
    'thrown',
    v_item.name,
    v_item.drawer,
    jsonb_build_object(
      'quantity', v_item.quantity,
      'unit', v_item.unit,
      'expiry_date', v_item.expiry_date,
      'position', v_item.position,
      'notes', v_item.notes
    )
  );

  ALTER TABLE public.fridge_items DISABLE TRIGGER trigger_log_fridge_item_activity;
  DELETE FROM public.fridge_items WHERE id = p_item_id;
  ALTER TABLE public.fridge_items ENABLE TRIGGER trigger_log_fridge_item_activity;
END;
$$;

GRANT EXECUTE ON FUNCTION public.throw_fridge_item(UUID) TO authenticated;

-- ============================================================================
-- Once this has been live a while, waste becomes queryable:
--
--   select date_trunc('month', created_at) as month,
--          count(*) filter (where action = 'consumed') as used,
--          count(*) filter (where action = 'thrown')   as wasted
--   from public.activity_log
--   where action in ('consumed', 'thrown')
--   group by 1 order by 1 desc;
--
-- What gets thrown out most:
--   select item_name, count(*) as times_wasted
--   from public.activity_log
--   where action = 'thrown'
--   group by 1 order by 2 desc limit 20;
-- ============================================================================
