-- Create activity_log table for tracking all fridge item actions
-- This table stores a complete history of who did what and when

CREATE TABLE IF NOT EXISTS public.activity_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    household_id UUID REFERENCES public.households(id) ON DELETE CASCADE,
    item_id UUID, -- Not a foreign key (item may be deleted but we keep the log)
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'deleted')),
    item_name TEXT NOT NULL,
    item_drawer TEXT,
    changes JSONB, -- Store what changed: {"field": {"old": "value", "new": "value"}}
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_activity_log_household_id ON public.activity_log(household_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON public.activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON public.activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_item_id ON public.activity_log(item_id);

-- Enable Row Level Security
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view activity for their households or personal items
CREATE POLICY "Users can view activity in their household"
    ON public.activity_log FOR SELECT
    USING (
        (household_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.household_members
            WHERE household_id = activity_log.household_id
            AND user_id = auth.uid()
        ))
        OR (household_id IS NULL AND user_id = auth.uid())
    );

-- Note: No INSERT, UPDATE, or DELETE policies for users
-- Only triggers will insert into this table
