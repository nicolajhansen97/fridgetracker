# Over-The-Air (OTA) Updates Guide

Complete guide to using EAS Updates to push updates to your app without App Store review.

---

## 🚀 What Are OTA Updates?

**Over-The-Air (OTA) Updates** allow you to instantly push JavaScript code changes, bug fixes, and content updates to your users **without going through App Store review**.

### ✅ What You CAN Update with OTA:
- JavaScript code changes
- Bug fixes
- UI/UX improvements
- New features (JavaScript only)
- Assets (images, fonts)
- App logic and functionality
- Database queries
- API calls

### ❌ What You CANNOT Update with OTA:
- Native code changes (Swift, Objective-C, Java, Kotlin)
- New native modules/packages
- App icons or splash screens
- Bundle identifier
- Permissions (Info.plist changes)
- SDK version changes

---

## 📋 Setup Complete! ✅

OTA updates are now configured in your app:

### What Was Added:

**app.json:**
```json
"updates": {
  "url": "https://u.expo.dev/11a9bd44-499c-4a15-b141-bfdfe8837f9d"
},
"runtimeVersion": {
  "policy": "appVersion"
}
```

**eas.json:**
```json
"build": {
  "development": { "channel": "development" },
  "preview": { "channel": "preview" },
  "production": { "channel": "production" }
}
```

**package.json:**
- `expo-updates` package installed ✅

---

## 🎯 How to Use OTA Updates

### Step 1: Make Your Changes

Edit your JavaScript code, fix bugs, or update UI:

```bash
# Example: Fix a typo in HomeScreen
# Edit src/screens/HomeScreen.js
# Change "Fridge" to "Freezer"
```

### Step 2: Publish the Update

```bash
# For production users (App Store build)
eas update --branch production --message "Fixed typo on home screen"

# For preview/testing
eas update --branch preview --message "Testing new feature"

# For development
eas update --branch development --message "Dev updates"
```

### Step 3: Users Get the Update

- **Automatic:** Next time users open the app (if connected to internet)
- **Timing:** Usually within seconds to minutes
- **Silent:** No App Store download, happens in background

---

## 📱 Update Workflow Examples

### Example 1: Quick Bug Fix

**Scenario:** You found a typo in the app after App Store release

```bash
# 1. Fix the typo in your code
vim src/screens/HomeScreen.js

# 2. Test locally
npm start

# 3. Publish update to production
eas update --branch production --message "Fix typo: Fridge → Freezer"

# 4. Users get it automatically next time they open the app!
```

**Timeline:**
- Fix made: 2 minutes
- Published: 30 seconds
- Users receive: Next app open (0-5 minutes)
- Total: ~5 minutes vs 1-3 days for App Store review

---

### Example 2: New Feature Rollout

**Scenario:** Add new "Quick Add" button feature

```bash
# 1. Develop feature locally
# Add QuickAddButton component
# Test thoroughly

# 2. Publish to preview channel first (internal testing)
eas update --branch preview --message "New Quick Add button"

# 3. Test with TestFlight preview build

# 4. If good, publish to production
eas update --branch production --message "Release: Quick Add button"
```

---

### Example 3: Gradual Rollout

**Scenario:** Test new feature with subset of users

```bash
# Create separate branch for beta users
eas update --branch production-beta --message "Beta: New sorting feature"

# If successful, roll out to everyone
eas update --branch production --message "Release: New sorting feature"
```

---

## 🔄 Update Commands Reference

### Basic Commands

```bash
# Publish update to production
eas update --branch production --message "Your message here"

# Publish to preview/testing
eas update --branch preview --message "Testing update"

# View all published updates
eas update:list

# View specific branch updates
eas update:list --branch production

# Delete an update (if needed)
eas update:delete <update-id>
```

---

### Advanced Commands

```bash
# Publish with specific message and description
eas update \
  --branch production \
  --message "Version 1.0.1" \
  --description "Bug fixes and performance improvements"

# Publish to multiple branches
eas update --branch production,preview --message "Multi-branch update"

# View update details
eas update:view <update-id>

# Configure update settings
eas update:configure
```

---

## 📊 Update Channels Explained

Your app has 3 update channels:

### 1. **Production** (Live App Store Users)
```bash
eas update --branch production --message "Your message"
```
- Users: Everyone who downloaded from App Store
- Use for: Bug fixes, small features, content updates
- Risk: High (affects all users)

### 2. **Preview** (Internal Testing)
```bash
eas update --branch preview --message "Testing new feature"
```
- Users: TestFlight preview builds
- Use for: Testing before production
- Risk: Low (only testers)

### 3. **Development** (Developers)
```bash
eas update --branch development --message "Dev update"
```
- Users: Local development builds
- Use for: Active development testing
- Risk: None (only you)

---

## 🎯 Best Practices

### DO:
- ✅ Test updates on preview channel first
- ✅ Use descriptive update messages
- ✅ Keep updates small and focused
- ✅ Monitor for crashes after updates
- ✅ Roll out gradually for major changes
- ✅ Keep update messages clear for debugging

### DON'T:
- ❌ Push untested updates to production
- ❌ Update native code (requires new build)
- ❌ Make breaking database changes without migration
- ❌ Update too frequently (confuses users)
- ❌ Forget to test on both iOS and Android

---

## 🔒 Update Safety

### Rollback Updates

If something goes wrong, you can rollback:

```bash
# View update history
eas update:list --branch production

# Republish a previous good update
eas update:republish <good-update-id>
```

### Version Compatibility

The `runtimeVersion` policy ensures updates only go to compatible app versions:

```json
"runtimeVersion": {
  "policy": "appVersion"
}
```

This means:
- Updates for version 1.0.0 only go to 1.0.0 users
- Updates for version 1.1.0 only go to 1.1.0 users
- Prevents incompatible updates

---

## 📱 User Experience

### How Users Receive Updates

**First Launch After Update:**
1. User opens app
2. App checks for updates (automatic)
3. If update available, downloads in background
4. App reloads with new code
5. User sees updated version

**Timing:**
- Check happens: Every app launch
- Download time: 1-10 seconds (usually)
- User sees: Seamless reload or new content

### Update Strategies

**Strategy 1: Automatic (Default)**
```javascript
// Updates install automatically on next launch
// No code needed - configured in app.json
```

**Strategy 2: Manual Check (Advanced)**
```javascript
import * as Updates from 'expo-updates';

// Check and install updates manually
async function checkForUpdates() {
  const update = await Updates.checkForUpdateAsync();
  if (update.isAvailable) {
    await Updates.fetchUpdateAsync();
    await Updates.reloadAsync();
  }
}
```

---

## 🛠️ Troubleshooting

### Update Not Appearing?

**Check:**
1. Is update published? `eas update:list --branch production`
2. Correct branch? App build must match update channel
3. Internet connection? Updates require network
4. Runtime version? Must match app version
5. Time? Can take 1-5 minutes to propagate

**Debug:**
```bash
# View update details
eas update:view <update-id>

# Check app configuration
eas update:configure

# View all branches
eas branch:list
```

---

### Build Doesn't Receive Updates?

**Verify:**
1. Build was created with update channel:
   ```bash
   # Check build channel
   eas build:list
   ```

2. Update published to matching channel:
   ```bash
   # Production build needs production updates
   eas update --branch production
   ```

3. Runtime versions match:
   - Build version: Check app.json "version"
   - Update version: Must match

---

## 📈 Monitoring Updates

### View Update Analytics

```bash
# List all updates
eas update:list

# View specific update
eas update:view <update-id>

# See which users have which updates
eas update:list --branch production --json
```

### Track Update Adoption

In Expo dashboard:
1. Go to https://expo.dev/accounts/[your-account]/projects/fridgetracker
2. Click "Updates"
3. View:
   - Number of users on each update
   - Update download success rate
   - Roll-out progress

---

## 🚀 Common Update Workflows

### Workflow 1: Emergency Bug Fix

```bash
# 1. Fix bug locally
vim src/context/FridgeContext.js

# 2. Test
npm start

# 3. Publish immediately
eas update --branch production --message "HOTFIX: Critical crash on startup"

# Timeline: 5 minutes total
```

---

### Workflow 2: Feature Release

```bash
# 1. Develop feature
# ... code changes ...

# 2. Test on preview
eas update --branch preview --message "New feature: Barcode scanner"

# 3. Internal testing (1-2 days)

# 4. Release to production
eas update --branch production --message "New feature: Barcode scanner"
```

---

### Workflow 3: A/B Testing

```bash
# Create two branches
eas update --branch production-v1 --message "Version A: Blue button"
eas update --branch production-v2 --message "Version B: Green button"

# Direct 50% users to each branch (requires custom logic)
# Monitor metrics
# Roll out winner to all users
```

---

## 💰 Pricing

**EAS Updates:**
- Free tier: Unlimited updates for personal projects
- Paid plans: For teams and businesses
- See: https://expo.dev/pricing

---

## 📚 Learn More

- **EAS Update Docs:** https://docs.expo.dev/eas-update/introduction/
- **Update Commands:** https://docs.expo.dev/eas-update/eas-update-command/
- **Best Practices:** https://docs.expo.dev/eas-update/best-practices/
- **Expo Dashboard:** https://expo.dev

---

## ✅ Quick Reference

### Publish Update to Production
```bash
eas update --branch production --message "Bug fixes and improvements"
```

### View All Updates
```bash
eas update:list --branch production
```

### Rollback (Republish Old Update)
```bash
eas update:republish <previous-good-update-id>
```

### Check Configuration
```bash
eas update:configure
```

---

## 🎉 You're All Set!

Over-the-air updates are now configured and ready to use!

**Next steps:**
1. Build your app: `eas build --platform ios`
2. Submit to App Store
3. After approval, push updates anytime with: `eas update --branch production`

**Remember:** OTA updates are for JavaScript changes only. Native changes require new App Store builds!

Happy updating! 🚀
