# Custom Drawers & European Date Format Setup Guide

This guide explains how to set up and use the new customizable drawer system and European date picker in your React Native Fridge App.

## 🎯 Features Implemented

### 1. **User-Defined Drawers ("Skuffer")**
- Users can now create their own custom drawers/compartments
- Each drawer can have a custom name and icon
- Drawers are specific to each user (isolated by user_id)
- Full CRUD operations: Create, Read, Update, Delete
- Sortable drawers with custom ordering

### 2. **European Date Format (DD-MM-YYYY)**
- Visual date picker instead of manual text entry
- Displays dates in European format: DD-MM-YYYY
- Stored in database as YYYY-MM-DD (standard format)
- Prevents future date confusion

---

## 📋 Database Setup

### Step 1: Create the Drawers Table

Run the SQL script in your Supabase dashboard:

```bash
# File: CREATE_DRAWERS_TABLE.sql
```

**What this does:**
- Creates a `drawers` table for storing user-defined drawers
- Sets up Row Level Security (RLS) policies
- Adds indexes for performance
- Optionally inserts default drawers for existing users (Fryser, Kjøleskap, Grønnsak skuff)

**To execute:**
1. Go to Supabase Dashboard → SQL Editor
2. Open or paste the contents of `CREATE_DRAWERS_TABLE.sql`
3. Click "Run"
4. Verify the table was created under "Table Editor"

---

## 📦 Dependencies Installed

The following packages were automatically installed:

```bash
npm install react-native-modal-datetime-picker @react-native-community/datetimepicker
```

**What these do:**
- `react-native-modal-datetime-picker`: Native date picker modal with European format support
- `@react-native-community/datetimepicker`: Native date/time picker components for iOS/Android

---

## 🗂️ New Files Created

### 1. **DrawerContext.js**
`src/context/DrawerContext.js`

**Purpose:** Manages drawer state and database operations
**Functions:**
- `loadDrawers()` - Fetches user's drawers from database
- `addDrawer(data)` - Creates a new drawer
- `updateDrawer(id, updates)` - Edits drawer name/icon
- `deleteDrawer(id)` - Removes a drawer
- `reorderDrawers(array)` - Changes drawer sort order

### 2. **ManageDrawersScreen.js**
`src/screens/ManageDrawersScreen.js`

**Purpose:** UI for managing drawers
**Features:**
- Add new drawers with custom icons
- Edit existing drawer names/icons
- Delete drawers (with confirmation)
- Icon picker with 12 emoji options (📦, ❄️, 🧊, 🥬, 🥩, 🧈, 🥛, 🍞, 🧃, 🥫, 🍎, 🧀)

### 3. **Database Schema**
`CREATE_DRAWERS_TABLE.sql`

**Purpose:** Database setup script

---

## 🔧 Modified Files

### 1. **AddItemScreen.js**
**Changes:**
- ✅ Removed hardcoded `DRAWER_OPTIONS` array
- ✅ Now loads drawers from `DrawerContext`
- ✅ Shows drawer icons alongside names
- ✅ Added "Manage Drawers" link
- ✅ Replaced text input date field with visual date picker
- ✅ Date picker shows European format (DD-MM-YYYY)
- ✅ Added "Clear date" button

### 2. **FridgeInventoryScreen.js**
**Changes:**
- ✅ Added `formatDateEuropean()` helper function
- ✅ Displays expiry dates as DD-MM-YYYY instead of locale default

### 3. **App.js**
**Changes:**
- ✅ Added `DrawerProvider` wrapper around `FridgeProvider`
- ✅ Ensures drawer context is available throughout the app

### 4. **AppNavigator.js**
**Changes:**
- ✅ Added `ManageDrawersScreen` to navigation stack
- ✅ Screen name: `'ManageDrawers'`

### 5. **HomeScreen.js**
**Changes:**
- ✅ Changed card 3 from "Settings" to "Manage Drawers"
- ✅ Icon changed to 📦
- ✅ Navigates to `ManageDrawers` screen on tap

---

## 🚀 How to Use

### For Users: Managing Drawers

1. **Access Drawer Management:**
   - From HomeScreen → Tap "Manage Drawers" card
   - OR from AddItemScreen → Tap "Manage Drawers" link

2. **Add a New Drawer:**
   - Scroll through the icon options and select one
   - Enter a drawer name (e.g., "Fryser", "Kjøleskap")
   - Tap "Add Drawer"

3. **Edit a Drawer:**
   - Find the drawer in the list
   - Tap "Edit" button
   - Select a new icon and/or change the name
   - Tap "Save"

4. **Delete a Drawer:**
   - Find the drawer in the list
   - Tap "Delete" button
   - Confirm deletion
   - **Note:** Items in that drawer are NOT deleted, only the drawer category

### For Users: Adding Items with Date Picker

1. **Navigate to Add Item Screen:**
   - From FridgeInventoryScreen → Tap the "+" button

2. **Select a Drawer:**
   - Scroll through your custom drawers
   - Tap on the drawer you want (shows icon + name)

3. **Select Expiry Date:**
   - Tap the date picker field (shows "Select date (DD-MM-YYYY)")
   - A native date picker modal appears
   - Select the expiry date
   - Date appears in European format: DD-MM-YYYY
   - Tap "Clear date" to remove if needed

4. **Save the Item:**
   - Fill in other fields (name, quantity, notes)
   - Tap "Add to Fridge"

---

## 🔍 Technical Details

### Date Format Handling

**Display Format (User-Facing):**
- DD-MM-YYYY (e.g., "14-01-2026")

**Storage Format (Database):**
- YYYY-MM-DD (e.g., "2026-01-14")
- Stored as PostgreSQL `DATE` type

**Conversion Functions:**
```javascript
// In AddItemScreen.js
formatDateForDisplay(dateString) {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

// In FridgeInventoryScreen.js
formatDateEuropean(dateString) {
  // Same logic as above
}
```

### Drawer Data Flow

```
User Action → DrawerContext → Supabase Database → RLS Check → Success/Error
                    ↓
            Update React State
                    ↓
          Re-render Components
```

### Security (Row Level Security)

All drawer operations are protected by RLS policies:
- Users can only see their own drawers
- Users can only create/edit/delete their own drawers
- `user_id` is automatically enforced by RLS policies

---

## 🧪 Testing Checklist

### Drawer Management
- [ ] Create a new drawer with custom name and icon
- [ ] Edit an existing drawer's name
- [ ] Edit an existing drawer's icon
- [ ] Delete a drawer (verify confirmation dialog)
- [ ] Verify deleted drawer doesn't appear in AddItemScreen
- [ ] Verify drawers are sorted by `sort_order`

### Date Picker
- [ ] Open date picker modal by tapping the field
- [ ] Select a date from the picker
- [ ] Verify date displays in DD-MM-YYYY format
- [ ] Clear the date using "Clear date" button
- [ ] Save item and verify date is stored correctly
- [ ] View item in inventory - verify date shows as DD-MM-YYYY

### Integration
- [ ] Add item with custom drawer and date
- [ ] View item in inventory grouped by drawer
- [ ] Delete item successfully
- [ ] Refresh inventory screen to reload data
- [ ] Test with multiple users (verify drawer isolation)

---

## 🐛 Troubleshooting

### Issue: "No drawers yet" message appears

**Cause:** User has no drawers created in the database

**Solution:**
1. Navigate to "Manage Drawers" screen
2. Add at least one drawer
3. Return to AddItem screen - drawer should appear

### Issue: Date picker not appearing on Android

**Cause:** Missing native dependency

**Solution:**
```bash
cd android && ./gradlew clean
cd .. && npx react-native run-android
```

### Issue: RLS policy errors in Supabase logs

**Cause:** RLS policies not properly set up

**Solution:**
1. Re-run the `CREATE_DRAWERS_TABLE.sql` script
2. Verify policies exist in Supabase Dashboard → Authentication → Policies

### Issue: Drawer icons not displaying

**Cause:** Font/emoji support issue on device

**Solution:**
- Emojis should work on all modern devices
- If not, consider replacing with icon library (react-native-vector-icons)

---

## 📱 Screenshots Locations

### Manage Drawers Screen
- Add drawer section with icon picker
- List of existing drawers with edit/delete buttons
- Inline editing mode

### Add Item Screen
- Custom drawer buttons with icons
- Date picker button with calendar icon
- European date format display

---

## 🔄 Migration Notes

### For Existing Users

**Existing Items:**
- Items with old hardcoded drawer names (e.g., "Top Drawer", "Freezer") will still work
- These items will display under their original drawer names
- No data migration needed

**Recommendation:**
1. Create new custom drawers matching your old names
2. Optionally update old items to use new drawer names (requires update functionality - not yet implemented)

**Drawer Name Mapping:**
```
Old Hardcoded Names → Suggested New Names (Norwegian)
"Top Drawer"        → "Øverste skuff"
"Middle Drawer"     → "Midtre skuff"
"Bottom Drawer"     → "Nederste skuff"
"Door Shelf"        → "Dørhylle"
"Freezer"           → "Fryser"
"Vegetable Drawer"  → "Grønnsak skuff"
"Other"             → "Annet"
```

---

## 💡 Future Enhancements

Potential improvements for this feature:

1. **Drag-and-Drop Reordering**
   - Allow users to reorder drawers visually
   - Update `sort_order` field

2. **Drawer Categories**
   - Group drawers by type (Fridge, Freezer, Pantry)
   - Color coding

3. **Batch Update Items**
   - Move multiple items between drawers at once
   - Update drawer names for existing items

4. **Custom Icons Upload**
   - Allow users to upload their own images
   - Expand beyond emoji icons

5. **Drawer Statistics**
   - Show item count per drawer
   - Show expiring items count

6. **Export/Import Drawers**
   - Share drawer configurations between users
   - Template library

---

## 📞 Support

If you encounter any issues:

1. Check the console logs for error messages
2. Verify database connection to Supabase
3. Ensure RLS policies are enabled
4. Check that all files are saved and app is reloaded

---

## ✅ Summary

You now have:
- ✅ Fully customizable drawer system
- ✅ User-specific drawer management
- ✅ European date format (DD-MM-YYYY)
- ✅ Visual date picker
- ✅ Proper database isolation with RLS
- ✅ Clean UI for managing drawers

**Next Steps:**
1. Run the database setup script
2. Restart your app
3. Test creating drawers
4. Test adding items with dates
5. Enjoy your customizable fridge app!
