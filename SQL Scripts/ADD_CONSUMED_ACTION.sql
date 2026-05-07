-- Add 'consumed' as a valid action in activity_log
ALTER TABLE public.activity_log DROP CONSTRAINT IF EXISTS activity_log_action_check;
ALTER TABLE public.activity_log ADD CONSTRAINT activity_log_action_check
  CHECK (action IN ('created', 'updated', 'deleted', 'consumed'));

-- RPC function: mark item as consumed (logs 'consumed' + deletes item)
-- The trigger would normally log 'deleted', so we disable it briefly.
CREATE OR REPLACE FUNCTION public.consume_fridge_item(p_item_id UUID)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_item RECORD;
BEGIN
  -- Fetch the item
  SELECT * INTO v_item FROM public.fridge_items WHERE id = p_item_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item not found';
  END IF;

  -- Insert consumed activity
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
      'quantity', v_item.quantity,
      'expiry_date', v_item.expiry_date,
      'position', v_item.position,
      'notes', v_item.notes
    )
  );

  -- Disable the trigger temporarily so we don't get a duplicate 'deleted' log
  ALTER TABLE public.fridge_items DISABLE TRIGGER trigger_log_fridge_item_activity;

  -- Delete the item
  DELETE FROM public.fridge_items WHERE id = p_item_id;

  -- Re-enable the trigger
  ALTER TABLE public.fridge_items ENABLE TRIGGER trigger_log_fridge_item_activity;
END;
$$;
