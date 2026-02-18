# FreezerTracker - App Store Submission Checklist

Complete guide to preparing and submitting your app to the Apple App Store.

---

## 📋 Pre-Submission Checklist

### ✅ Technical Requirements

- [x] **App Icons** - icon.png, adaptive-icon.png, splash.png (DONE)
- [x] **Bundle Identifier** - com.fridgetracker.app (configured in app.json)
- [x] **EAS Project ID** - 11a9bd44-499c-4a15-b141-bfdfe8837f9d (configured)
- [ ] **Build iOS app with EAS** - `eas build --platform ios`
- [ ] **Test on TestFlight** - Internal testing before submission
- [ ] **App Version** - Currently 1.0.0 (update in app.json if needed)

### 📱 App Store Connect Setup

- [ ] **Create Apple Developer Account** ($99/year)
  - Go to: https://developer.apple.com/programs/enroll/

- [ ] **Create App in App Store Connect**
  - Go to: https://appstoreconnect.apple.com
  - Click "+" → "New App"
  - Platform: iOS
  - Name: FreezerTracker
  - Primary Language: English
  - Bundle ID: com.fridgetracker.app
  - SKU: freezertracker-ios

### 📄 Required Legal Documents

- [ ] **Privacy Policy** (template provided below)
- [ ] **Terms of Service** (optional but recommended)
- [ ] **Support URL** (website or GitHub)
- [ ] **Marketing URL** (optional)

### 🖼️ App Store Assets

- [ ] **App Icon** (1024×1024) - Already created ✅
- [ ] **Screenshots** (see requirements below)
- [ ] **App Preview Video** (optional, 15-30 seconds)

### 📝 App Store Listing Content

- [ ] **App Name** - FreezerTracker
- [ ] **Subtitle** - Track What's In Your Freezer
- [ ] **Description** (template provided below)
- [ ] **Keywords** - freezer, food, tracker, inventory, organizer
- [ ] **Category** - Food & Drink (Primary), Lifestyle (Secondary)
- [ ] **Age Rating** - 4+ (no objectionable content)

---

## 🏗️ Step-by-Step Submission Process

### Step 1: Build Your App with EAS

```bash
# Login to Expo
npx eas-cli login

# Configure EAS Build (if not already done)
npx eas build:configure

# Build for iOS
npx eas build --platform ios

# This will:
# 1. Upload your code to Expo servers
# 2. Build your app in the cloud
# 3. Generate an IPA file
# 4. Automatically upload to App Store Connect (if configured)
```

### Step 2: Create App in App Store Connect

1. Go to https://appstoreconnect.apple.com
2. Click "Apps" → "+" → "New App"
3. Fill in:
   - **Platform:** iOS
   - **Name:** FreezerTracker
   - **Primary Language:** English (U.S.)
   - **Bundle ID:** com.fridgetracker.app
   - **SKU:** freezertracker-ios (or any unique identifier)
   - **User Access:** Full Access

### Step 3: Configure App Information

#### App Information Tab
- **Name:** FreezerTracker
- **Subtitle:** Track What's In Your Freezer
- **Category:** Food & Drink (Primary)
- **Content Rights:** Check if you own all rights

#### Pricing and Availability
- **Price:** Free
- **Availability:** All countries (or select specific ones)

#### App Privacy
- **Privacy Policy URL:** (upload privacy policy and host it, see below)
- **Privacy Details:**
  - Collect: Email Address (for authentication)
  - Collect: User Content (freezer items, compartments)
  - Data Usage: App functionality only
  - Data Linked to User: Yes
  - Tracking: No

### Step 4: Prepare Version 1.0.0

#### What's New in This Version
```
Welcome to FreezerTracker!

• Track all items in your freezer
• Organize by compartments
• Set expiry dates and get notifications
• Share with family members
• View activity history
• Optional position numbers for precise tracking

Perfect for reducing food waste and staying organized!
```

#### App Description (see full version below)

#### Keywords
```
freezer, food tracker, inventory, organizer, expiry date, food waste, family sharing, meal planning, storage, household
```

### Step 5: Upload Screenshots

**Required Sizes:**
- iPhone 6.7" Display (1290 × 2796 px) - iPhone 15 Pro Max
- iPhone 6.5" Display (1242 × 2688 px) - iPhone 11 Pro Max
- iPhone 5.5" Display (1242 × 2208 px) - iPhone 8 Plus

**Minimum:** 3 screenshots
**Recommended:** 5-10 screenshots

See SCREENSHOTS_GUIDE.md for mockup templates.

### Step 6: Submit for Review

1. Upload build via EAS or Transporter
2. Select build for version 1.0.0
3. Fill in Review Information:
   - **Demo Account:** Provide test credentials if needed
   - **Notes:** "First version of FreezerTracker. All features tested."
4. Add app privacy details
5. Submit for Review

⏱️ **Review Time:** Typically 24-48 hours

---

## 📸 Screenshot Requirements

### Recommended Screenshots (in order):

1. **Home Screen** - Shows main dashboard with stats
2. **Freezer Inventory** - List of items with expiry dates
3. **Add Item** - Form for adding new items
4. **Compartments** - Organize by drawers/sections
5. **Family Sharing** - Household feature
6. **Activity History** - Who added/removed what
7. **Expiring Items** - Warning about soon-to-expire items

### Screenshot Specifications:
- Format: PNG or JPEG
- Color Space: RGB
- No transparency
- No rounded corners (Apple adds them)
- High resolution for each device size

**Tip:** Use Figma or Canva to create mockups with device frames and captions.

---

## 🔒 Privacy Policy Requirements

Apple requires a privacy policy URL. Options:

### Option 1: Host on GitHub Pages (Free)
1. Create a new repository: freezertracker-privacy
2. Enable GitHub Pages
3. Use template provided in PRIVACY_POLICY.html

### Option 2: Use Privacy Policy Generator
- https://www.privacypolicygenerator.info/
- https://app-privacy-policy-generator.firebaseapp.com/

### Option 3: Host on Your Own Domain
- Upload PRIVACY_POLICY.html to your website

**URL Format:** https://yourdomain.com/privacy or https://yourname.github.io/freezertracker-privacy/

---

## 📧 Support and Contact

Apple requires a support email and optionally a support URL.

**Support Email:** youremail@example.com
**Support URL:** https://github.com/yourusername/freezertracker (or dedicated support site)

---

## 🚀 After Approval

1. **Monitor Reviews:** Respond to user feedback
2. **Track Analytics:** Use App Store Connect analytics
3. **Plan Updates:** Fix bugs and add features
4. **Version Updates:** Use EAS to build and submit updates

### Updating Your App

```bash
# 1. Update version in app.json
# Change "version": "1.0.0" to "1.0.1" or "1.1.0"

# 2. Build new version
npx eas build --platform ios

# 3. Submit update in App Store Connect
# - Create new version
# - Upload new build
# - Add "What's New" notes
# - Submit for review
```

---

## 🆘 Common Rejection Reasons

### How to Avoid Rejection:

1. **Privacy Policy Issues**
   - ✅ Provide valid privacy policy URL
   - ✅ Accurately describe data collection
   - ✅ Explain why you need email/data

2. **Crashes or Bugs**
   - ✅ Test thoroughly on TestFlight first
   - ✅ Handle network errors gracefully
   - ✅ Ensure Supabase project is active

3. **Missing Functionality**
   - ✅ All advertised features must work
   - ✅ Provide demo account if authentication required
   - ✅ Screenshots must match actual app

4. **Design Issues**
   - ✅ App must look polished
   - ✅ No broken UI elements
   - ✅ Icons and images render correctly

---

## 📞 Need Help?

- **Expo EAS Docs:** https://docs.expo.dev/build/introduction/
- **App Store Connect Help:** https://developer.apple.com/app-store-connect/
- **Submission Guidelines:** https://developer.apple.com/app-store/review/guidelines/

---

## ✅ Final Checklist Before Submission

- [ ] App builds successfully with EAS
- [ ] Tested on real iOS device via TestFlight
- [ ] All features work (add/edit/delete items, households, etc.)
- [ ] Privacy policy URL is live and accessible
- [ ] Screenshots look professional
- [ ] App description is clear and accurate
- [ ] Keywords are relevant
- [ ] Support email responds
- [ ] No placeholder text in the app
- [ ] Supabase project is on paid plan or has sufficient credits
- [ ] All API keys and secrets are secure

**Ready to submit? Follow Step 1-6 above!**
