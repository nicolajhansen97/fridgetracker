-- Create fridge_items table
CREATE TABLE IF NOT EXISTS public.fridge_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    drawer TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    expiry_date DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create an index on user_id for faster queries
CREATE INDEX IF NOT EXISTS fridge_items_user_id_idx ON public.fridge_items(user_id);

-- Create an index on expiry_date for sorting
CREATE INDEX IF NOT EXISTS fridge_items_expiry_date_idx ON public.fridge_items(expiry_date);

-- Enable Row Level Security
ALTER TABLE public.fridge_items ENABLE ROW LEVEL SECURITY;

-- Create policy: Users can only see their own items
CREATE POLICY "Users can view own fridge items" ON public.fridge_items
    FOR SELECT
    USING (auth.uid() = user_id);

-- Create policy: Users can insert their own items
CREATE POLICY "Users can insert own fridge items" ON public.fridge_items
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Create policy: Users can update their own items
CREATE POLICY "Users can update own fridge items" ON public.fridge_items
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Create policy: Users can delete their own items
CREATE POLICY "Users can delete own fridge items" ON public.fridge_items
    FOR DELETE
    USING (auth.uid() = user_id);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.fridge_items
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
