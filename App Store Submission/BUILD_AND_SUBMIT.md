# FreezerTracker - Build & Submit to App Store

Step-by-step guide to building and submitting your app.

---

## 🔑 Prerequisites

### 1. Apple Developer Account
- **Cost:** $99/year
- **Sign up:** https://developer.apple.com/programs/enroll/
- **Processing time:** 1-2 days after payment

### 2. Required Software
- **macOS** (for final testing, optional)
- **Expo CLI** (already installed)
- **EAS CLI** (Expo Application Services)

### 3. Install EAS CLI

```bash
# Install EAS CLI globally
npm install -g eas-cli

# Login to your Expo account
eas login

# Verify login
eas whoami
```

---

## 📝 Step 1: Prepare Your App Configuration

### Update app.json

Make sure these fields are set correctly:

```json
{
  "expo": {
    "name": "FreezerTracker",
    "slug": "fridgetracker",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#667eea"
    },
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.fridgetracker.app",
      "buildNumber": "1",
      "infoPlist": {
        "ITSAppUsesNonExemptEncryption": false
      }
    },
    "extra": {
      "eas": {
        "projectId": "11a9bd44-499c-4a15-b141-bfdfe8837f9d"
      }
    }
  }
}
```

**Key fields explained:**
- `version`: User-facing version (1.0.0, 1.1.0, etc.)
- `buildNumber`: Internal build number (increment for each build)
- `bundleIdentifier`: Unique identifier for your app (cannot change after submission)
- `ITSAppUsesNonExemptEncryption`: Set to false if you don't use custom encryption

---

## 🔨 Step 2: Configure EAS Build

### Initialize EAS Build

```bash
# In your project root
cd /path/to/fridgetracker

# Configure EAS (creates eas.json)
eas build:configure
```

### Verify eas.json

This file should be created automatically:

```json
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {
      "ios": {
        "autoIncrement": "buildNumber"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your-apple-id@example.com",
        "ascAppId": "1234567890",
        "appleTeamId": "ABCDEFGHIJ"
      }
    }
  }
}
```

---

## 🏗️ Step 3: Build Your App

### Build for iOS (Production)

```bash
# Build for iOS App Store
eas build --platform ios --profile production

# Follow the prompts:
# 1. Generate new credentials? Yes (first time only)
# 2. Apple ID: Enter your Apple Developer account email
# 3. App-specific password: Generate from appleid.apple.com
```

**What happens:**
1. EAS uploads your code to Expo servers
2. Builds your app in the cloud (10-20 minutes)
3. Generates an IPA file
4. Can automatically upload to App Store Connect (optional)

**Build output:**
```
✔ Build successful!
IPA: https://expo.dev/artifacts/eas/abc123...
```

---

## 📲 Step 4: Test on TestFlight (Recommended)

### Set Up TestFlight

```bash
# Submit to TestFlight for internal testing
eas submit --platform ios --profile production

# Or manually upload IPA:
# 1. Download IPA from build link
# 2. Upload via Transporter app (Mac) or App Store Connect
```

### Internal Testing
1. Go to App Store Connect → TestFlight
2. Add internal testers (your email)
3. Install from TestFlight app on iPhone
4. Test all features thoroughly

**What to test:**
- [ ] Login and registration
- [ ] Add/edit/delete items
- [ ] Compartment management
- [ ] Family sharing and invitations
- [ ] Activity history
- [ ] Expiring items alerts
- [ ] App doesn't crash
- [ ] Network errors handled gracefully

---

## 🍎 Step 5: Create App in App Store Connect

### 5.1 Go to App Store Connect
- **URL:** https://appstoreconnect.apple.com
- Log in with your Apple Developer account

### 5.2 Create New App
1. Click **"My Apps"**
2. Click **"+"** → **"New App"**
3. Fill in:

```
Platform: iOS
Name: FreezerTracker
Primary Language: English (U.S.)
Bundle ID: com.fridgetracker.app (select from dropdown)
SKU: freezertracker-ios-001
User Access: Full Access
```

4. Click **"Create"**

---

## 📋 Step 6: Fill in App Information

### 6.1 App Information Tab

Navigate to **App Information** and fill in:

**Category:**
- Primary: Food & Drink
- Secondary: Lifestyle

**Privacy Policy URL:**
```
https://yourusername.github.io/freezertracker-privacy/
```

**Support URL:**
```
https://github.com/yourusername/freezertracker
```

**Marketing URL (optional):**
```
https://yourusername.github.io/freezertracker/
```

---

### 6.2 Pricing and Availability

Navigate to **Pricing and Availability**:

```
Price: Free
Available in: All countries
Pre-Order: No
```

---

### 6.3 App Privacy

Navigate to **App Privacy**:

1. Click **"Get Started"**
2. **Data Collection:**

```
Data Type: Email Address
- Why: Account Creation, App Functionality
- Linked to User: Yes
- Used for Tracking: No

Data Type: Name (optional)
- Why: App Functionality
- Linked to User: Yes
- Used for Tracking: No

Data Type: User Content
- Why: App Functionality (freezer items, compartments)
- Linked to User: Yes
- Used for Tracking: No
```

3. Save and publish

---

## 📱 Step 7: Prepare Version 1.0.0

### 7.1 Version Information

Click on **"1.0.0"** under **iOS App**:

**What's New in This Version:**
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

---

### 7.2 App Description

Copy from [APP_DESCRIPTION.md](./APP_DESCRIPTION.md):

```
Never forget what's in your freezer again! FreezerTracker helps you organize, track, and manage all your frozen items in one simple app.

[Copy full description from APP_DESCRIPTION.md]
```

---

### 7.3 Promotional Text (Optional - 170 chars)

```
🎉 NEW: Track who adds what with Activity History! Perfect for families sharing a freezer. Never waste food again!
```

---

### 7.4 Keywords

```
freezer,food,tracker,inventory,organizer,expiry,waste,family,sharing,meal,storage,household
```

---

### 7.5 Support URL and Marketing URL

```
Support URL: https://github.com/yourusername/freezertracker
Marketing URL: https://yourusername.github.io/freezertracker/ (optional)
```

---

## 📸 Step 8: Upload Screenshots

### Required Sizes
Upload screenshots for **iPhone 6.7" Display** (minimum 3, recommended 10):

**Screenshot order:**
1. Home screen - "Track Everything in Your Freezer"
2. Inventory list - "Never Forget What You Have"
3. Add item - "Quick & Easy Item Entry"
4. Compartments - "Organize by Compartments"
5. Family sharing - "Share with Your Family"
6. Activity history - "Track Who Added What"
7. Expiring items - "Get Alerts Before Food Expires"

See [SCREENSHOTS_GUIDE.md](./SCREENSHOTS_GUIDE.md) for how to create these.

---

## 🔐 Step 9: App Review Information

### 9.1 Contact Information

```
First Name: Your First Name
Last Name: Your Last Name
Phone: +1 (123) 456-7890
Email: youremail@example.com
```

### 9.2 Demo Account (If Required)

If reviewers need an account to test:

```
Username: reviewer@freezertracker.com
Password: ReviewTest123!

Notes: This is a test account with sample data.
The app requires authentication to access features.
```

### 9.3 Notes for Reviewer

```
Thank you for reviewing FreezerTracker!

This is the initial release (v1.0.0) of our freezer inventory tracking app.

KEY FEATURES TO TEST:
• User registration and login
• Adding/editing/deleting freezer items
• Creating custom compartments
• Family sharing (inviting household members)
• Activity history tracking
• Expiring items alerts

DEMO ACCOUNT PROVIDED:
Email: reviewer@freezertracker.com
Password: ReviewTest123!

The account has sample data pre-populated for easy testing.

NOTES:
• The app uses Supabase for backend and authentication
• All data is securely stored and encrypted
• No ads, no tracking, completely free to use

Please contact us if you encounter any issues during review.
```

---

## 🚀 Step 10: Select Build

1. Scroll to **"Build"** section
2. Click **"Select a build before you submit your app"**
3. Choose your uploaded build from the list
4. Click **"Done"**

If no build appears:
- Wait 10-15 minutes after EAS submit
- Check TestFlight tab to see if build is processing
- Verify build uploaded successfully via EAS

---

## ✅ Step 11: Submit for Review

### Final Checklist

- [ ] All required fields filled in
- [ ] Screenshots uploaded (at least 3)
- [ ] Build selected
- [ ] App Privacy configured
- [ ] Privacy Policy URL accessible
- [ ] Demo account credentials provided (if applicable)
- [ ] Tested on TestFlight
- [ ] No placeholder content

### Submit!

1. Click **"Add for Review"** (top right)
2. Review all information one last time
3. Check **"Export Compliance"**:
   - Does your app use encryption? **No** (if you selected ITSAppUsesNonExemptEncryption: false)
4. Check **"Advertising Identifier"**:
   - Does your app use the Advertising Identifier (IDFA)? **No**
5. Click **"Submit for Review"**

---

## ⏳ Step 12: Wait for Review

### Review Timeline
- **In Review:** 24-72 hours typically
- **Status:** Check App Store Connect for updates
- **Email:** You'll receive email updates on status

### Possible Statuses
1. **Waiting for Review** - In queue
2. **In Review** - Currently being reviewed
3. **Pending Developer Release** - Approved! (you can release manually)
4. **Ready for Sale** - Live on App Store!
5. **Rejected** - Needs fixes (see rejection reason)

---

## 🔴 If Rejected: Common Issues & Fixes

### Issue 1: Privacy Policy Inaccessible
**Fix:** Ensure privacy policy URL is publicly accessible (not behind login)

### Issue 2: App Crashes
**Fix:** Test more thoroughly, fix crashes, submit new build

### Issue 3: Incomplete Functionality
**Fix:** Ensure all features work, provide better demo account

### Issue 4: Privacy Details Incorrect
**Fix:** Update App Privacy to accurately reflect data collection

### Issue 5: Misleading Screenshots
**Fix:** Ensure screenshots match actual app functionality

---

## 🎉 Step 13: After Approval

### Release Your App

**Option 1: Automatic Release**
- App goes live immediately after approval

**Option 2: Manual Release**
1. Go to App Store Connect
2. Click your app version
3. Click **"Release This Version"**
4. Confirm

### Monitor Your App

1. **Reviews:** Respond to user reviews
2. **Crashes:** Monitor crash reports in App Store Connect
3. **Analytics:** Track downloads and usage
4. **Updates:** Plan and release updates regularly

---

## 🔄 Future Updates

### Update Process

```bash
# 1. Update version in app.json
# "version": "1.0.1" or "1.1.0"
# iOS "buildNumber" will auto-increment

# 2. Make your changes to the code

# 3. Build new version
eas build --platform ios --profile production

# 4. Submit to App Store
eas submit --platform ios --profile production

# 5. In App Store Connect:
#    - Create new version (1.0.1)
#    - Add "What's New" notes
#    - Select new build
#    - Submit for review
```

---

## 🆘 Troubleshooting

### Build Fails
```bash
# Clear cache and retry
eas build --platform ios --profile production --clear-cache
```

### Submit Fails
```bash
# Check credentials
eas credentials

# Manually submit
eas submit --platform ios
```

### Can't Find Build in App Store Connect
- Wait 10-15 minutes after submission
- Check build processing status in TestFlight
- Ensure bundle ID matches exactly

---

## 📞 Support Resources

- **EAS Build Docs:** https://docs.expo.dev/build/introduction/
- **App Store Connect Help:** https://developer.apple.com/help/app-store-connect/
- **Review Guidelines:** https://developer.apple.com/app-store/review/guidelines/
- **Expo Forums:** https://forums.expo.dev/

---

## 🎯 Quick Reference Commands

```bash
# Login to EAS
eas login

# Build for production
eas build --platform ios --profile production

# Submit to App Store
eas submit --platform ios

# Check build status
eas build:list

# View credentials
eas credentials

# Update EAS CLI
npm install -g eas-cli@latest
```

---

**Ready to submit?** Follow steps 1-13 and your app will be live soon! 🚀
