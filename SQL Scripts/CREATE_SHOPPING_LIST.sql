-- Shopping List table
CREATE TABLE IF NOT EXISTS shopping_list (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  quantity TEXT,
  checked BOOLEAN DEFAULT FALSE NOT NULL,
  added_by_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS
ALTER TABLE shopping_list ENABLE ROW LEVEL SECURITY;

-- Policy: users can see items belonging to their household, or their own personal items
CREATE POLICY "shopping_list_select" ON shopping_list
  FOR SELECT USING (
    user_id = auth.uid()
    OR household_id IN (
      SELECT household_id FROM household_members WHERE user_id = auth.uid()
    )
  );

-- Policy: users can insert items for themselves or their household
CREATE POLICY "shopping_list_insert" ON shopping_list
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND (
      household_id IS NULL
      OR household_id IN (
        SELECT household_id FROM household_members WHERE user_id = auth.uid()
      )
    )
  );

-- Policy: any household member can update items (check/uncheck)
CREATE POLICY "shopping_list_update" ON shopping_list
  FOR UPDATE USING (
    user_id = auth.uid()
    OR household_id IN (
      SELECT household_id FROM household_members WHERE user_id = auth.uid()
    )
  );

-- Policy: any household member can delete items
CREATE POLICY "shopping_list_delete" ON shopping_list
  FOR DELETE USING (
    user_id = auth.uid()
    OR household_id IN (
      SELECT household_id FROM household_members WHERE user_id = auth.uid()
    )
  );

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS shopping_list_household_idx ON shopping_list(household_id);
CREATE INDEX IF NOT EXISTS shopping_list_user_idx ON shopping_list(user_id);
