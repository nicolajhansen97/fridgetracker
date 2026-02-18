-- Migration: Add household support to drawers table
-- This allows drawers to be shared within households

-- ============================================
-- STEP 1: Add household_id column
-- ============================================

ALTER TABLE public.drawers
ADD COLUMN IF NOT EXISTS household_id UUID REFERENCES public.households(id) ON DELETE CASCADE;

-- ============================================
-- STEP 2: Update unique constraint
-- ============================================

-- Drop old constraint
ALTER TABLE public.drawers
DROP CONSTRAINT IF EXISTS drawers_user_id_name_key;

-- Add new constraint that accounts for household sharing
-- Personal drawers: unique per user when household_id IS NULL
-- Household drawers: unique per household
CREATE UNIQUE INDEX IF NOT EXISTS drawers_personal_unique
ON public.drawers(user_id, name)
WHERE household_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS drawers_household_unique
ON public.drawers(household_id, name)
WHERE household_id IS NOT NULL;

-- ============================================
-- STEP 3: Update RLS policies for household sharing
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own drawers" ON public.drawers;
DROP POLICY IF EXISTS "Users can insert their own drawers" ON public.drawers;
DROP POLICY IF EXISTS "Users can update their own drawers" ON public.drawers;
DROP POLICY IF EXISTS "Users can delete their own drawers" ON public.drawers;

-- CREATE POLICY: Users can view their own personal drawers OR household drawers they're members of
CREATE POLICY "Users can view their drawers"
ON public.drawers FOR SELECT
USING (
    auth.uid() = user_id
    OR
    household_id IN (
        SELECT household_id
        FROM public.household_members
        WHERE user_id = auth.uid()
    )
);

-- CREATE POLICY: Users can insert personal drawers OR drawers for households they're members of
CREATE POLICY "Users can insert drawers"
ON public.drawers FOR INSERT
WITH CHECK (
    auth.uid() = user_id
    AND
    (
        household_id IS NULL
        OR
        household_id IN (
            SELECT household_id
            FROM public.household_members
            WHERE user_id = auth.uid()
        )
    )
);

-- CREATE POLICY: Users can update their own personal drawers OR household drawers they created
CREATE POLICY "Users can update drawers"
ON public.drawers FOR UPDATE
USING (
    auth.uid() = user_id
    AND
    (
        household_id IS NULL
        OR
        household_id IN (
            SELECT household_id
            FROM public.household_members
            WHERE user_id = auth.uid()
        )
    )
);

-- CREATE POLICY: Users can delete their own personal drawers OR household drawers they created
CREATE POLICY "Users can delete drawers"
ON public.drawers FOR DELETE
USING (
    auth.uid() = user_id
    AND
    (
        household_id IS NULL
        OR
        household_id IN (
            SELECT household_id
            FROM public.household_members
            WHERE user_id = auth.uid()
        )
    )
);

-- ============================================
-- STEP 4: Create index for household_id
-- ============================================

CREATE INDEX IF NOT EXISTS idx_drawers_household_id
ON public.drawers(household_id);

-- ============================================
-- STEP 5: Verify the changes
-- ============================================

-- Check that the column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'drawers'
AND column_name = 'household_id';

-- Check that policies are in place
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'drawers';
