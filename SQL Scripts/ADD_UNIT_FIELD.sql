-- Add unit field to fridge_items for quantity units (kg, g, lbs, oz, pcs, portions)
-- Run this in your Supabase SQL Editor

ALTER TABLE fridge_items ADD COLUMN IF NOT EXISTS unit text;
