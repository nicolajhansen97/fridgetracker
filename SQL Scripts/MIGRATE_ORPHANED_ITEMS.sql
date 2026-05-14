-- ────────────────────────────────────────────────────────────────────────────
-- One-off recovery for users who already hit the "freezer empty after creating
-- household" bug. Their items still exist in the database with
-- household_id = NULL, but they're now in household mode so the app filters
-- them out.
--
-- This script only auto-migrates users who are in EXACTLY ONE household —
-- when that's true, there's no ambiguity about where the items should go.
-- Users in multiple households are left alone and can decide manually.
--
-- Run it in the Supabase SQL editor AFTER you've deployed the updated
-- CREATE_HOUSEHOLD_FUNCTION.sql so newly-created households won't keep
-- producing orphans.
--
-- Safe to re-run: only touches rows where household_id IS NULL.
-- ────────────────────────────────────────────────────────────────────────────

-- ── STEP 1: PREVIEW. Look at the counts before you do anything. ─────────────

WITH single_household_users AS (
  SELECT user_id, MIN(household_id) AS household_id
  FROM public.household_members
  GROUP BY user_id
  HAVING COUNT(*) = 1
)
SELECT
  'fridge_items'  AS table_name,
  COUNT(*)        AS orphans_to_migrate
FROM public.fridge_items f
JOIN single_household_users s ON s.user_id = f.user_id
WHERE f.household_id IS NULL
UNION ALL
SELECT
  'drawers',
  COUNT(*)
FROM public.drawers d
JOIN single_household_users s ON s.user_id = d.user_id
WHERE d.household_id IS NULL
UNION ALL
SELECT
  'shopping_list',
  COUNT(*)
FROM public.shopping_list sl
JOIN single_household_users s ON s.user_id = sl.user_id
WHERE sl.household_id IS NULL;

-- ── STEP 2: MIGRATE. Run this block once you're happy with the preview. ────
-- Wrapped in a transaction so it's all-or-nothing. If any statement fails,
-- nothing is changed.

BEGIN;

WITH single_household_users AS (
  SELECT user_id, MIN(household_id) AS household_id
  FROM public.household_members
  GROUP BY user_id
  HAVING COUNT(*) = 1
)
UPDATE public.fridge_items f
SET household_id = s.household_id
FROM single_household_users s
WHERE f.user_id = s.user_id
  AND f.household_id IS NULL;

WITH single_household_users AS (
  SELECT user_id, MIN(household_id) AS household_id
  FROM public.household_members
  GROUP BY user_id
  HAVING COUNT(*) = 1
)
UPDATE public.drawers d
SET household_id = s.household_id
FROM single_household_users s
WHERE d.user_id = s.user_id
  AND d.household_id IS NULL;

WITH single_household_users AS (
  SELECT user_id, MIN(household_id) AS household_id
  FROM public.household_members
  GROUP BY user_id
  HAVING COUNT(*) = 1
)
UPDATE public.shopping_list sl
SET household_id = s.household_id
FROM single_household_users s
WHERE sl.user_id = s.user_id
  AND sl.household_id IS NULL;

COMMIT;

-- ── STEP 3 (optional): WHAT'S LEFT. Anything still orphaned after the run
-- is a user in 2+ households — show them so you can decide manually.

SELECT
  u.email,
  u.id AS user_id,
  (SELECT COUNT(*) FROM public.fridge_items  WHERE user_id = u.id AND household_id IS NULL) AS items_left,
  (SELECT COUNT(*) FROM public.drawers       WHERE user_id = u.id AND household_id IS NULL) AS drawers_left,
  (SELECT COUNT(*) FROM public.shopping_list WHERE user_id = u.id AND household_id IS NULL) AS shopping_left,
  (SELECT COUNT(*) FROM public.household_members WHERE user_id = u.id) AS households_count
FROM auth.users u
WHERE
  EXISTS (SELECT 1 FROM public.fridge_items  WHERE user_id = u.id AND household_id IS NULL)
  OR EXISTS (SELECT 1 FROM public.drawers       WHERE user_id = u.id AND household_id IS NULL)
  OR EXISTS (SELECT 1 FROM public.shopping_list WHERE user_id = u.id AND household_id IS NULL)
ORDER BY households_count DESC, u.email;
