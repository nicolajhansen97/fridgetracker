-- Manual food-category overrides.
--
-- The app auto-categorizes items from their name (utils/foodCategories.js), but
-- unknown or foreign-language names fall into "Other". This adds a per-user
-- { "<lowercased product name>": "<category key>" } map so a product can be
-- assigned a category once and have it stick everywhere it appears (shopping
-- list grouping, stats composition).
--
-- Stored alongside the existing freezer-storage overrides on user_freezer_settings
-- (same per-user row, same RLS). Safe to re-run.

ALTER TABLE public.user_freezer_settings
  ADD COLUMN IF NOT EXISTS category_overrides JSONB NOT NULL DEFAULT '{}'::jsonb;

-- User-defined categories: an array of { "key": "custom:<id>", "name": "<label>" }.
-- These appear in the category picker alongside the built-in categories, and a
-- product can be assigned to one via category_overrides just like a built-in.
ALTER TABLE public.user_freezer_settings
  ADD COLUMN IF NOT EXISTS custom_categories JSONB NOT NULL DEFAULT '[]'::jsonb;
