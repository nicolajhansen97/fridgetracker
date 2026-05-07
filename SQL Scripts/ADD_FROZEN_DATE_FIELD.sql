-- Add frozen_date column to fridge_items
-- Run this in your Supabase SQL Editor

ALTER TABLE fridge_items ADD COLUMN IF NOT EXISTS frozen_date date;
