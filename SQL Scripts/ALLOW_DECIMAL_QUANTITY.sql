-- Let item quantities hold decimals (4.5 lbs, 1.25 kg).
--
-- fridge_items.quantity was INTEGER. "Partially used" works out the new amount
-- in NUMERIC (5 - 0.5 = 4.5), and storing that in an integer column rounds it:
-- .5 rounds up, so 4.5 lbs went straight back to 5 and 9.5 back to 10. The app
-- showed the new amount until the next refresh, while Activity still logged
-- the use. Only fractional amounts were hit, so whole-number use looked fine.
--
-- Run once. Safe to re-run: the ALTER is a no-op once the type is NUMERIC, and
-- the repair only touches items still in the rounded state.

BEGIN;

ALTER TABLE public.fridge_items
    ALTER COLUMN quantity TYPE NUMERIC(10,2) USING quantity::NUMERIC(10,2);

-- Repair items a partial use already rounded. The activity log kept the real
-- amount ("remaining"). Only fix an item when that partial use is still the
-- last thing that happened to it, the logged amount is fractional, and the
-- current quantity is exactly that amount rounded, i.e. nobody has changed it
-- by hand since.
--
-- The activity trigger is switched off so the repair doesn't show up as an
-- "updated" entry in people's activity history (same as the partial-use
-- function does).
ALTER TABLE public.fridge_items DISABLE TRIGGER trigger_log_fridge_item_activity;

WITH last_event AS (
    SELECT DISTINCT ON (item_id) item_id, action, changes
    FROM public.activity_log
    WHERE item_id IS NOT NULL
    ORDER BY item_id, created_at DESC
)
UPDATE public.fridge_items fi
SET quantity = (le.changes->>'remaining')::NUMERIC
FROM last_event le
WHERE le.item_id = fi.id
  AND le.action = 'consumed'
  AND (le.changes->>'partial')::BOOLEAN IS TRUE
  AND (le.changes->>'remaining')::NUMERIC > 0
  AND (le.changes->>'remaining')::NUMERIC <> trunc((le.changes->>'remaining')::NUMERIC)
  AND fi.quantity = round((le.changes->>'remaining')::NUMERIC)
RETURNING fi.name, fi.unit, fi.quantity AS repaired_quantity;

ALTER TABLE public.fridge_items ENABLE TRIGGER trigger_log_fridge_item_activity;

COMMIT;
