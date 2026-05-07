-- Add list_name column to support multiple shopping lists
ALTER TABLE shopping_list ADD COLUMN list_name TEXT DEFAULT 'default' NOT NULL;

-- Index for fast lookups by list
CREATE INDEX IF NOT EXISTS shopping_list_name_idx ON shopping_list(household_id, list_name);
