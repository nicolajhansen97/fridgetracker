# Bundle ID Selection Guide

Complete guide to choosing and registering your iOS app bundle identifier.

---

## ⚠️ CRITICAL: Bundle ID Cannot Be Changed!

Once you submit your app to the App Store, the bundle ID is **permanent**. You cannot change it without creating a completely new app listing. Choose carefully!

---

## 🎯 What is a Bundle ID?

A **Bundle ID** (Bundle Identifier) is a unique identifier for your app on iOS, similar to a domain name.

**Format:** Reverse domain notation
```
com.yourcompany.appname
```

**Example:**
- Instagram: `com.burbn.instagram`
- WhatsApp: `com.whatsapp.WhatsApp`
- Twitter: `com.atebits.Tweetie2`

---

## 📋 Bundle ID Requirements

### ✅ Must:
- Be unique across all iOS apps
- Use reverse domain notation
- Start with a domain you control (or generic like `com`)
- Use only alphanumeric characters (A-Z, a-z, 0-9)
- Use dots (.) to separate components
- Use hyphens (-) within components (optional)

### ❌ Cannot:
- Contain spaces
- Contain special characters (except dots and hyphens)
- Start with a number
- Be changed after first submission
- Match another app's bundle ID

---

## 🎨 Recommended Bundle IDs (Based on App Name Choice)

### If you choose **"Freezely"** (Recommended ⭐)
```
com.freezely.app
```
**Why:** Clean, matches brand, professional

**Alternatives:**
```
com.freezely.ios
app.freezely.ios
io.freezely.app
```

---

### If you choose **"FrostBox"**
```
com.frostbox.app
```

**Alternatives:**
```
com.frost-box.app
app.frostbox.tracker
```

---

### If you choose **"FrostKeep"**
```
com.frostkeep.app
```

**Alternatives:**
```
com.frost-keep.app
```

---

### If you keep **"FreezerTracker"**
```
com.freezertracker.app
```
**Current in your app.json:** `com.fridgetracker.app` ⚠️

**Note:** Your current bundle ID says "fridgetracker" but your app is now "FreezerTracker". Consider updating to match!

**Better options:**
```
com.freezertracker.app
com.freezer-tracker.app
```

---

## 🏢 Domain Component Options

### Option 1: Generic "com"
```
com.freezely.app
```
**Pros:**
- ✅ Simple, standard
- ✅ No domain required
- ✅ Professional looking

**Cons:**
- ⚠️ Not unique to you personally

---

### Option 2: Your Name/Company
```
com.yourname.freezely
com.yourlastname.freezely
```

**Example:** If your name is John Smith:
```
com.johnsmith.freezely
com.jsmith.freezely
com.smith.freezely
```

**Pros:**
- ✅ Unique to you
- ✅ Professional
- ✅ Can use for multiple apps

**Cons:**
- May be too personal if you plan to sell/transfer app

---

### Option 3: Your Domain (If You Own One)
```
com.yourdomain.freezely
```

**Example:** If you own `mystartup.com`:
```
com.mystartup.freezely
```

**Pros:**
- ✅ Most professional
- ✅ Matches your brand
- ✅ Shows ownership

**Cons:**
- Requires owning a domain

---

### Option 4: Reverse Generic TLD
```
app.freezely.ios
io.freezely.app
```

**Pros:**
- ✅ Modern style
- ✅ Different from traditional com

**Cons:**
- Less common, slightly unconventional

---

## 🎯 My Top 3 Recommendations

### 🥇 **com.freezely.app**
- Simple, clean, professional
- Matches your app name (if you choose Freezely)
- Easy to remember
- Standard format

---

### 🥈 **com.yourname.freezely**
Replace "yourname" with your actual name:
```
com.johnson.freezely
com.smith.freezely
com.alex.freezely
```
- Personal ownership
- Can use `com.yourname.*` for future apps
- Professional

---

### 🥉 **app.freezely.tracker**
- Descriptive
- Modern format
- Shows purpose clearly

---

## 🔍 Check Bundle ID Availability

### Method 1: Try in App Store Connect
1. Go to https://appstoreconnect.apple.com
2. Create New App
3. Try to select your bundle ID from dropdown
4. If it appears and you can select it → Available! ✅
5. If it's grayed out → Already taken ❌

### Method 2: Apple Developer Portal
1. Go to https://developer.apple.com/account/
2. Navigate to Certificates, Identifiers & Profiles
3. Click Identifiers
4. Click "+" to add new App ID
5. Try your bundle ID
6. If accepted → Available! ✅

---

## 📝 How to Register Your Bundle ID

### Step 1: In Apple Developer Portal

1. **Go to:** https://developer.apple.com/account/
2. **Navigate to:** Certificates, Identifiers & Profiles
3. **Click:** Identifiers
4. **Click:** "+" (Add button)
5. **Select:** App IDs
6. **Click:** Continue

7. **Fill in:**
   - **Description:** Freezely - Freezer Inventory Tracker
   - **Bundle ID:** Explicit
   - **Bundle Identifier:** `com.freezely.app` (your choice)
   - **Capabilities:** Select any you need (likely none for now)

8. **Click:** Continue → Register

---

### Step 2: In Your app.json

Update your project configuration:

```json
{
  "expo": {
    "name": "Freezely",
    "slug": "freezely",
    "ios": {
      "bundleIdentifier": "com.freezely.app"
    }
  }
}
```

**Important:** Make sure to update:
- `name` - Display name
- `slug` - URL-friendly name
- `bundleIdentifier` - Your chosen bundle ID

---

### Step 3: In EAS Configuration

Your `eas.json` should automatically use the bundle ID from `app.json`, but verify:

```json
{
  "build": {
    "production": {
      "ios": {
        "bundleIdentifier": "com.freezely.app"
      }
    }
  }
}
```

---

## 🔄 Updating From Current Bundle ID

Your current `app.json` has:
```json
"bundleIdentifier": "com.fridgetracker.app"
```

### If This Is Your First Build (Not Yet Submitted):
✅ **Safe to change!** Just update app.json and rebuild.

### If Already Submitted to App Store:
❌ **Cannot change!** You're stuck with `com.fridgetracker.app`

**Note:** Since you changed from "Fridge" to "Freezer", consider if the bundle ID should also be updated BEFORE first submission.

---

## 💡 Best Practices

### DO:
- ✅ Keep it simple and lowercase
- ✅ Match your app name
- ✅ Use standard format (com.company.appname)
- ✅ Think long-term (you can't change it!)
- ✅ Check availability before committing

### DON'T:
- ❌ Use temporary names or placeholders
- ❌ Include version numbers (com.app.v1)
- ❌ Use special characters or spaces
- ❌ Make it too long or complex
- ❌ Use someone else's trademark

---

## 🎯 Decision Matrix

Ask yourself:

### 1. What's your app name?
- Freezely → `com.freezely.app`
- FrostBox → `com.frostbox.app`
- FreezerTracker → `com.freezertracker.app`

### 2. Do you own a domain?
- Yes → `com.yourdomain.appname`
- No → `com.appname.app`

### 3. Are you building a brand/company?
- Yes → `com.brandname.appname`
- No → `com.appname.app`

### 4. Planning multiple apps?
- Yes → `com.yourname.*` or `com.yourbrand.*`
- No → `com.appname.app`

---

## 🚀 Quick Recommendations by Scenario

### Scenario 1: Individual Developer, First App
**Recommended:**
```
com.freezely.app
```
Simple, professional, matches app name.

---

### Scenario 2: Building a Business/Startup
**Recommended:**
```
com.yourcompanyname.freezely
```
Example: `com.trackerco.freezely`

---

### Scenario 3: Personal Portfolio Project
**Recommended:**
```
com.yourname.freezely
```
Example: `com.smith.freezely`

---

### Scenario 4: Planning App Suite (Multiple Apps)
**Recommended:**
```
com.yourbrand.freezely
com.yourbrand.otherapp
```
Example: `com.hometrack.freezely` + `com.hometrack.pantry`

---

## 📋 Bundle ID Checklist

Before finalizing:

- [ ] Name is available (checked in App Store Connect)
- [ ] Matches your app name
- [ ] Lowercase and no spaces
- [ ] Follows reverse domain notation
- [ ] You're happy with it long-term (can't change!)
- [ ] Updated in app.json
- [ ] Registered in Apple Developer Portal
- [ ] Matches any documentation/marketing

---

## 🎯 My Specific Recommendation for You

Based on your app:

### Recommended Bundle ID:
```
com.freezely.app
```

**Why:**
1. Assumes you'll choose "Freezely" as the app name (best option)
2. Clean, simple, professional
3. Easy to remember
4. Standard format
5. Matches brand perfectly

### How to Apply:

**Update app.json:**
```json
{
  "expo": {
    "name": "Freezely",
    "slug": "freezely",
    "ios": {
      "bundleIdentifier": "com.freezely.app"
    }
  }
}
```

**Register in Apple Developer Portal:**
1. Go to developer.apple.com/account
2. Create App ID with `com.freezely.app`
3. Done!

---

## ❓ Still Unsure?

Ask yourself:
- **What's my app called?** → Use that in the bundle ID
- **Do I own a domain?** → Use that as the prefix
- **Am I building a brand?** → Use brand name as prefix
- **Just one app for now?** → `com.appname.app` is perfect

**Default safe choice:** `com.[appname].app`

Example: `com.freezely.app`

---

## 🔄 What If I Already Submitted?

If you've already submitted to App Store with `com.fridgetracker.app`:

❌ **You cannot change it**

✅ **But it's okay!** The bundle ID is internal - users never see it. Your app can still be called "Freezely" with bundle ID `com.fridgetracker.app`.

Only issue: Slight inconsistency in backend identifiers.

---

**Need to decide now?**

**I recommend: `com.freezely.app`**

Clean, simple, perfect for your app! 🎯
