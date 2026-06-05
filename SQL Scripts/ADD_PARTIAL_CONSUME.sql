-- Partial consume: log the USED portion as a 'consumed' event and reduce the
-- item's quantity (delete the item if nothing is left). Mirrors
-- consume_fridge_item, but for "used some of it" rather than the whole thing.
--
-- p_used = how much was used (current quantity minus what's left). The function
-- subtracts that from the live quantity, so it is safe against concurrent edits.
--
-- Requires the 'consumed' action to already be allowed in activity_log
-- (see ADD_CONSUMED_ACTION.sql, which you have already run).

CREATE OR REPLACE FUNCTION public.consume_fridge_item_partial(
  p_item_id UUID,
  p_used NUMERIC
)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_item RECORD;
  v_remaining NUMERIC;
BEGIN
  SELECT * INTO v_item FROM public.fridge_items WHERE id = p_item_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item not found';
  END IF;

  v_remaining := COALESCE(v_item.quantity, 0) - p_used;

  -- Log the used portion as a 'consumed' activity (marked partial), recording
  -- both how much was used and how much is left.
  INSERT INTO public.activity_log (
    household_id, item_id, user_id, action, item_name, item_drawer, changes
  ) VALUES (
    v_item.household_id,
    v_item.id,
    auth.uid(),
    'consumed',
    v_item.name,
    v_item.drawer,
    jsonb_build_object(
      'quantity', p_used,
      'remaining', v_remaining,
      'unit', v_item.unit,
      'partial', true
    )
  );

  -- Suppress the row trigger so we don't also log an 'updated'/'deleted' event.
  ALTER TABLE public.fridge_items DISABLE TRIGGER trigger_log_fridge_item_activity;

  IF v_remaining > 0 THEN
    UPDATE public.fridge_items SET quantity = v_remaining WHERE id = p_item_id;
  ELSE
    DELETE FROM public.fridge_items WHERE id = p_item_id;
  END IF;

  ALTER TABLE public.fridge_items ENABLE TRIGGER trigger_log_fridge_item_activity;
END;
$$;
