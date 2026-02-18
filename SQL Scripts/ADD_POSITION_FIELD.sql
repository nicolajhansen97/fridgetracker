-- Add position field to fridge_items table
-- Position numbers are optional and must be unique within household/user scope

-- Add position column
ALTER TABLE public.fridge_items
ADD COLUMN IF NOT EXISTS position INTEGER;

-- Create unique constraint for household items: position must be unique per household
-- Only applies when household_id IS NOT NULL and position IS NOT NULL
CREATE UNIQUE INDEX IF NOT EXISTS idx_fridge_items_household_position
ON public.fridge_items(household_id, position)
WHERE household_id IS NOT NULL AND position IS NOT NULL;

-- Create unique constraint for personal items: position must be unique per user
-- Only applies when household_id IS NULL and position IS NOT NULL
CREATE UNIQUE INDEX IF NOT EXISTS idx_fridge_items_user_position
ON public.fridge_items(user_id, position)
WHERE household_id IS NULL AND position IS NOT NULL;

-- Create index for querying by position (performance)
CREATE INDEX IF NOT EXISTS idx_fridge_items_position
ON public.fridge_items(position)
WHERE position IS NOT NULL;

-- Note: NULL positions are allowed (field is optional)
-- Multiple items can have NULL position (not considered duplicate)
