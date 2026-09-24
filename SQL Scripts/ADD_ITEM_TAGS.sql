-- Free-form tags on items, so a meal can be gathered without renaming things.
--
-- The problem: to find everything for a barbecue you had to bake it into the
-- name — "barbecue chicken", "barbecue beef" — which is tedious to type and
-- pollutes the name with something that isn't the food. Tags put that on a
-- separate axis: the item stays "Chicken", and "barbecue" is a label you can
-- also hang on the beef, the corn and the buns.
--
-- Deliberately NOT the same thing as categories. Categories are keyed by item
-- NAME (every "Chicken" shares one), single-valued, and drive shopping-list
-- grouping and the stats breakdown. Tags are per ROW and many-per-item,
-- because the chicken you froze for Saturday's barbecue and the chicken you
-- froze for a curry are the same food with different plans.
--
-- Stored as a text[] on the row rather than a tags table plus a join:
--
--   * FridgeContext already loads every item into memory, so the list of tags
--     in use can be derived client-side for free. A tags table would need a
--     second query to tell you the same thing.
--   * Filtering is a single GIN-indexed containment check, no join.
--   * Tags inherit fridge_items' existing RLS, so household sharing and
--     personal inventories keep working with no new policies to get wrong.
--
-- The trade is that renaming a tag means touching every row that carries it.
-- For a handful of labels like "barbecue" or "baking", changed rarely, that is
-- the cheaper side of the deal.
--
-- Re-runnable.

ALTER TABLE public.fridge_items
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';

-- Containment queries (`tags @> '{barbecue}'`, or .contains() from the client)
-- go through this rather than scanning the table.
CREATE INDEX IF NOT EXISTS fridge_items_tags_idx
  ON public.fridge_items USING GIN (tags);

-- ============================================================================
-- Every tag in use, with how many items carry it. Handy for a manage screen
-- later, and for checking what people actually name things.
--
--   select unnest(tags) as tag, count(*)
--   from public.fridge_items
--   where household_id = '<id>'
--   group by 1 order by 2 desc;
-- ============================================================================
