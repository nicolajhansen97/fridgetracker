-- Create drawers table for user-defined drawer/compartment management
CREATE TABLE IF NOT EXISTS public.drawers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    icon TEXT DEFAULT '📦',
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, name)
);

-- Enable Row Level Security
ALTER TABLE public.drawers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own drawers" ON public.drawers;
DROP POLICY IF EXISTS "Users can insert their own drawers" ON public.drawers;
DROP POLICY IF EXISTS "Users can update their own drawers" ON public.drawers;
DROP POLICY IF EXISTS "Users can delete their own drawers" ON public.drawers;

-- Create RLS policies for drawers table
CREATE POLICY "Users can view their own drawers"
    ON public.drawers FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own drawers"
    ON public.drawers FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own drawers"
    ON public.drawers FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own drawers"
    ON public.drawers FOR DELETE
    USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_drawers_user_id ON public.drawers(user_id);
CREATE INDEX IF NOT EXISTS idx_drawers_sort_order ON public.drawers(user_id, sort_order);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_drawers_updated_at ON public.drawers;
CREATE TRIGGER update_drawers_updated_at
    BEFORE UPDATE ON public.drawers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default drawers for existing users (optional - you can customize these)
-- This will give users some starter drawers
INSERT INTO public.drawers (user_id, name, icon, sort_order)
SELECT
    id as user_id,
    unnest(ARRAY['Fryser', 'Kjøleskap', 'Grønnsak skuff']) as name,
    unnest(ARRAY['❄️', '🧊', '🥬']) as icon,
    unnest(ARRAY[1, 2, 3]) as sort_order
FROM auth.users
ON CONFLICT (user_id, name) DO NOTHING;
