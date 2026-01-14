# Fridge Inventory Database Setup

This guide will help you set up the database table in Supabase for the fridge inventory feature.

## Step 1: Open SQL Editor

1. Go to your Supabase dashboard (https://supabase.com)
2. Select your project
3. Click on **SQL Editor** in the left sidebar (icon looks like </> or a database)

## Step 2: Create the Fridge Items Table

Copy and paste this SQL code into the SQL Editor and click **Run**:


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
```

## Step 3: Verify the Table was Created

1. Click on **Table Editor** in the left sidebar
2. You should see a new table called `fridge_items`
3. Click on it to view its structure

## Step 4: Test the Setup (Optional)

You can manually insert a test row to verify everything works:

```sql
-- Insert a test item (replace 'your-user-id' with an actual user ID from auth.users)
INSERT INTO public.fridge_items (user_id, name, drawer, quantity, notes)
VALUES (
    (SELECT id FROM auth.users LIMIT 1),
    'Test Milk',
    'Top Drawer',
    1,
    'This is a test item'
);

-- View all items
SELECT * FROM public.fridge_items;

-- Delete test item
DELETE FROM public.fridge_items WHERE name = 'Test Milk';
```

## Database Schema Explanation
```sql
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
### Table: `fridge_items`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Unique identifier for each item (auto-generated) |
| `user_id` | UUID | Reference to the user who owns this item |
| `name` | TEXT | Name of the food item (e.g., "Milk", "Eggs") |
| `drawer` | TEXT | Which drawer/compartment (e.g., "Top Drawer", "Freezer") |
| `quantity` | INTEGER | How many of this item (default: 1) |
| `expiry_date` | DATE | When the item expires (optional) |
| `notes` | TEXT | Additional notes about the item (optional) |
| `created_at` | TIMESTAMP | When the item was added |
| `updated_at` | TIMESTAMP | When the item was last updated |

### Security (Row Level Security)

The table has Row Level Security (RLS) enabled, which means:
- Users can only see their own items
- Users can only add, update, or delete their own items
- Data is completely isolated between users

### Available Drawer Options in the App

The app provides these preset options:
- Top Drawer
- Middle Drawer
- Bottom Drawer
- Door Shelf
- Freezer
- Vegetable Drawer
- Other

Users can select any of these when adding items.

## Troubleshooting

### Error: "relation already exists"
- The table already exists. You can skip this step or drop the table first:
  ```sql
  DROP TABLE IF EXISTS public.fridge_items CASCADE;
  ```
  Then run the create table script again.

### Error: "permission denied"
- Make sure you're logged into the correct Supabase project
- Check that you have admin access to the project

### Items not showing in the app
- Make sure you've added your Supabase credentials in `src/config/supabase.js`
- Check that the user is logged in
- Try refreshing the fridge inventory screen (pull down to refresh)
- Check the browser console for errors

### Can't delete items
- Verify that Row Level Security policies are set up correctly
- Make sure the `user_id` matches the logged-in user

## Testing in Supabase Dashboard

1. Go to **Table Editor** > **fridge_items**
2. Click **Insert row** to manually add test data
3. Fill in the fields:
   - Select a user from `user_id` dropdown
   - Enter a name (e.g., "Apple")
   - Enter a drawer (e.g., "Vegetable Drawer")
   - Set quantity (e.g., 5)
4. Click **Save**
5. Open your app and check if the item appears

## Next Steps

After setting up the database:
1. Make sure your Supabase credentials are configured in `src/config/supabase.js`
2. Log into your app
3. Click on the "My Fridge" card on the home screen
4. Click "+ Add" to add your first item
5. Test adding, viewing, and deleting items

## Advanced: Add Notifications for Expiring Items

If you want to add notifications for items expiring soon, you can create a function:

```sql
-- Function to get items expiring in the next 3 days
CREATE OR REPLACE FUNCTION public.get_expiring_items(days_ahead INTEGER DEFAULT 3)
RETURNS TABLE (
    id UUID,
    name TEXT,
    drawer TEXT,
    expiry_date DATE,
    days_until_expiry INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        fi.id,
        fi.name,
        fi.drawer,
        fi.expiry_date,
        (fi.expiry_date - CURRENT_DATE) AS days_until_expiry
    FROM public.fridge_items fi
    WHERE fi.user_id = auth.uid()
        AND fi.expiry_date IS NOT NULL
        AND fi.expiry_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + days_ahead)
    ORDER BY fi.expiry_date ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Test it
SELECT * FROM public.get_expiring_items(3);
```

## Resources

- [Supabase SQL Editor Documentation](https://supabase.com/docs/guides/database/sql-editor)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/introduction)
