-- Optional prices on items, so waste can be counted in money instead of units.
--
-- Background: the stats screen can already say "you threw away 7 things this
-- month" and name the top three. Counts don't land. "That cost you 340 kr"
-- does, and it is the same data with one number attached.
--
-- Design notes:
--
--   * price is the TOTAL paid for the row, not a per-unit rate. "2 pcs of
--     chicken, 45 kr" means the 45 kr covers both. Per-unit was tempting but
--     forces the user to do division at the till, which nobody will do.
--   * price is NULLABLE and stays that way. Items without a price simply don't
--     contribute to any money total; nothing nags, and every existing row
--     keeps working untouched. A money figure is always "at least this much".
--   * The activity snapshot carries the value at the moment of the event, so
--     history survives the item being deleted and later price changes don't
--     silently rewrite last month's waste.
--
-- Requires ADD_CONSUMED_ACTION.sql, ADD_PARTIAL_CONSUME.sql, ADD_THROWN_ACTION.sql
-- and CREATE_CONSUMPTION_STATS_RPC.sql (all already run).
-- Re-runnable.

-- ============================================================================
-- 1. The price itself
-- ============================================================================

ALTER TABLE public.fridge_items
  ADD COLUMN IF NOT EXISTS price NUMERIC(10,2);

-- ============================================================================
-- 2. Remembered prices
-- ============================================================================
-- Typing a price on every single add is the friction that kills this kind of
-- feature. Instead the last price used for a given item name is remembered and
-- pre-filled next time. Scoped to the household (falling back to the user for
-- personal inventories) so both partners benefit from either one typing it.

CREATE TABLE IF NOT EXISTS public.item_prices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    household_id UUID REFERENCES public.households(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name_key TEXT NOT NULL,
    item_name TEXT NOT NULL,
    price NUMERIC(10,2) NOT NULL,
    quantity NUMERIC,
    unit TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- One remembered price per name per scope. Two partial indexes rather than one
-- constraint, because NULL household_id would otherwise never collide.
CREATE UNIQUE INDEX IF NOT EXISTS item_prices_household_name_idx
    ON public.item_prices (household_id, name_key)
    WHERE household_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS item_prices_user_name_idx
    ON public.item_prices (user_id, name_key)
    WHERE household_id IS NULL;

ALTER TABLE public.item_prices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read own or household prices" ON public.item_prices;
CREATE POLICY "Read own or household prices" ON public.item_prices
    FOR SELECT USING (
        (household_id IS NULL AND user_id = auth.uid())
        OR (household_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.household_members hm
            WHERE hm.household_id = item_prices.household_id
              AND hm.user_id = auth.uid()
        ))
    );

DROP POLICY IF EXISTS "Write own or household prices" ON public.item_prices;
CREATE POLICY "Write own or household prices" ON public.item_prices
    FOR ALL USING (
        (household_id IS NULL AND user_id = auth.uid())
        OR (household_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.household_members hm
            WHERE hm.household_id = item_prices.household_id
              AND hm.user_id = auth.uid()
        ))
    ) WITH CHECK (
        (household_id IS NULL AND user_id = auth.uid())
        OR (household_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.household_members hm
            WHERE hm.household_id = item_prices.household_id
              AND hm.user_id = auth.uid()
        ))
    );

-- Upsert helper so the app doesn't have to branch on household vs personal.
CREATE OR REPLACE FUNCTION public.remember_item_price(
    p_name TEXT,
    p_price NUMERIC,
    p_household_id UUID DEFAULT NULL,
    p_quantity NUMERIC DEFAULT NULL,
    p_unit TEXT DEFAULT NULL
)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_key TEXT := lower(trim(p_name));
BEGIN
  IF v_key = '' OR p_price IS NULL THEN
    RETURN;
  END IF;

  IF p_household_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.household_members hm
      WHERE hm.household_id = p_household_id AND hm.user_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'Not authorized for this household';
    END IF;

    INSERT INTO public.item_prices (household_id, user_id, name_key, item_name, price, quantity, unit)
    VALUES (p_household_id, auth.uid(), v_key, trim(p_name), p_price, p_quantity, p_unit)
    ON CONFLICT (household_id, name_key) WHERE household_id IS NOT NULL
    DO UPDATE SET price = EXCLUDED.price,
                  item_name = EXCLUDED.item_name,
                  quantity = EXCLUDED.quantity,
                  unit = EXCLUDED.unit,
                  user_id = EXCLUDED.user_id,
                  updated_at = timezone('utc'::text, now());
  ELSE
    INSERT INTO public.item_prices (household_id, user_id, name_key, item_name, price, quantity, unit)
    VALUES (NULL, auth.uid(), v_key, trim(p_name), p_price, p_quantity, p_unit)
    ON CONFLICT (user_id, name_key) WHERE household_id IS NULL
    DO UPDATE SET price = EXCLUDED.price,
                  item_name = EXCLUDED.item_name,
                  quantity = EXCLUDED.quantity,
                  unit = EXCLUDED.unit,
                  updated_at = timezone('utc'::text, now());
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.remember_item_price(TEXT, NUMERIC, UUID, NUMERIC, TEXT) TO authenticated;

-- ============================================================================
-- 3. Carry the value into the activity snapshots
-- ============================================================================
-- Each of the three "item left the inventory" RPCs gains 'price' (what the row
-- cost) and 'value' (the money this particular event represents). They are the
-- same for a whole item and differ for a partial use, where only the used
-- fraction counts. Storing 'value' outright keeps the stats queries to a plain
-- SUM and means a later price edit can't rewrite history.
--
-- All three are CREATE OR REPLACE and only affect events logged from now on.

CREATE OR REPLACE FUNCTION public.consume_fridge_item(p_item_id UUID)
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
    'consumed',
    v_item.name,
    v_item.drawer,
    jsonb_build_object(
      'quantity', v_item.quantity,
      'unit', v_item.unit,
      'expiry_date', v_item.expiry_date,
      'position', v_item.position,
      'notes', v_item.notes,
      'price', v_item.price,
      'value', v_item.price
    )
  );

  ALTER TABLE public.fridge_items DISABLE TRIGGER trigger_log_fridge_item_activity;
  DELETE FROM public.fridge_items WHERE id = p_item_id;
  ALTER TABLE public.fridge_items ENABLE TRIGGER trigger_log_fridge_item_activity;
END;
$$;

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
      'notes', v_item.notes,
      'price', v_item.price,
      'value', v_item.price
    )
  );

  ALTER TABLE public.fridge_items DISABLE TRIGGER trigger_log_fridge_item_activity;
  DELETE FROM public.fridge_items WHERE id = p_item_id;
  ALTER TABLE public.fridge_items ENABLE TRIGGER trigger_log_fridge_item_activity;
END;
$$;

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
  v_value NUMERIC;
BEGIN
  SELECT * INTO v_item FROM public.fridge_items WHERE id = p_item_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item not found';
  END IF;

  v_remaining := COALESCE(v_item.quantity, 0) - p_used;

  -- Pro-rate the price across the used portion. Guarded against a zero or NULL
  -- quantity, which would otherwise divide by zero on a malformed row.
  IF v_item.price IS NOT NULL AND COALESCE(v_item.quantity, 0) > 0 THEN
    v_value := ROUND(v_item.price * (p_used / v_item.quantity), 2);
  ELSE
    v_value := NULL;
  END IF;

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
      'position', v_item.position,
      'partial', true,
      'price', v_item.price,
      'value', v_value
    )
  );

  ALTER TABLE public.fridge_items DISABLE TRIGGER trigger_log_fridge_item_activity;

  IF v_remaining > 0 THEN
    -- Reduce the remaining price alongside the quantity, so what's left in the
    -- fridge is still valued correctly for the next event.
    IF v_item.price IS NOT NULL AND v_value IS NOT NULL THEN
      UPDATE public.fridge_items
        SET quantity = v_remaining,
            price = GREATEST(v_item.price - v_value, 0)
        WHERE id = p_item_id;
    ELSE
      UPDATE public.fridge_items SET quantity = v_remaining WHERE id = p_item_id;
    END IF;
  ELSE
    DELETE FROM public.fridge_items WHERE id = p_item_id;
  END IF;

  ALTER TABLE public.fridge_items ENABLE TRIGGER trigger_log_fridge_item_activity;
END;
$$;

-- ============================================================================
-- 4. Fix and extend get_consumption_stats
-- ============================================================================
-- BUG FIX, independent of prices: this function counted thrown_events as
-- action = 'deleted'. That was correct when it was written, because throwing
-- something away WAS a plain delete. ADD_THROWN_ACTION.sql then introduced a
-- real 'thrown' action, and this function was never updated — so since that
-- migration went live it has been counting tidy-up deletions as waste while
-- ignoring every actual throw-away. The "buying too often / wasteful" flag in
-- useStockInsights has been running on the wrong column ever since.
--
-- Counting only 'thrown' from here on means pre-migration waste drops out of
-- the numbers. That is the honest result: those old 'deleted' rows mix real
-- waste with routine corrections and can never be separated (see the note in
-- ADD_THROWN_ACTION.sql).
--
-- Also adds consumed_value / thrown_value, summing the per-event 'value' from
-- section 3. Events logged before that section ran have no value and count as
-- zero, so money totals start accruing now and read as "at least this much".
--
-- The return type changes, so the old function has to be dropped first.

DROP FUNCTION IF EXISTS public.get_consumption_stats(UUID, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION public.get_consumption_stats(
    p_household_id UUID DEFAULT NULL,
    p_since TIMESTAMPTZ DEFAULT (timezone('utc'::text, now()) - INTERVAL '90 days')
)
RETURNS TABLE (
    name_key TEXT,
    item_name TEXT,
    consumed_events INTEGER,
    consumed_qty NUMERIC,
    consumed_value NUMERIC,
    thrown_events INTEGER,
    thrown_qty NUMERIC,
    thrown_value NUMERIC,
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
        COALESCE(
            SUM((s.changes->>'value')::NUMERIC) FILTER (WHERE s.action = 'consumed'),
            0
        )::NUMERIC AS consumed_value,
        COUNT(*) FILTER (WHERE s.action = 'thrown')::INTEGER AS thrown_events,
        COALESCE(
            SUM((s.changes->>'quantity')::NUMERIC) FILTER (WHERE s.action = 'thrown'),
            0
        )::NUMERIC AS thrown_qty,
        COALESCE(
            SUM((s.changes->>'value')::NUMERIC) FILTER (WHERE s.action = 'thrown'),
            0
        )::NUMERIC AS thrown_value,
        MAX(s.created_at) FILTER (WHERE s.action = 'consumed') AS last_consumed,
        MIN(s.created_at) AS first_activity
    FROM scoped s
    GROUP BY lower(trim(s.item_name));
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_consumption_stats(UUID, TIMESTAMPTZ) TO authenticated;

-- ============================================================================
-- Handy after a few weeks of data:
--
--   select date_trunc('month', created_at) as month,
--          round(sum((changes->>'value')::numeric) filter (where action = 'thrown'), 2)   as wasted,
--          round(sum((changes->>'value')::numeric) filter (where action = 'consumed'), 2) as eaten
--   from public.activity_log
--   where action in ('consumed', 'thrown')
--   group by 1 order by 1 desc;
-- ============================================================================
