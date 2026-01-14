# Biometric Authentication Setup Guide

FridgeTracker now supports biometric authentication (Face ID/Touch ID) for quick and secure login!

## Features

- **Face ID** support on devices with TrueDepth camera
- **Touch ID** support on devices with fingerprint sensor
- **Iris Scanner** support on compatible Android devices
- **Secure storage** using Expo SecureStore
- **Automatic login** on app launch when enabled
- **Easy toggle** on login screen and in settings
- **Session management** integrated with Supabase auth

---

## Prerequisites

### iOS Requirements
- iOS 11.0 or later
- Face ID or Touch ID enabled in device settings
- At least one biometric registered

### Android Requirements
- Android 6.0 (API 23) or later
- Fingerprint or face unlock enabled
- At least one biometric registered

---

## User Guide

### First Time Setup

1. **Login with Password**
   - Enter your email and password
   - Toggle "Enable Face ID/Touch ID login" ON
   - Tap "Login"
   - Confirmation shown

2. **Next Time**
   - Open app
   - Biometric prompt appears automatically
   - Authenticate with Face ID/Touch ID
   - Instant access to your fridge!

### Manual Enable/Disable

**On Login Screen:**
- Toggle switch before logging in
- Will activate after successful password login

**In Settings:**
1. Navigate to Home
2. Tap "Settings" card
3. Under "Security" section
4. Toggle "Face ID/Touch ID Login"

### Troubleshooting

**Biometric Not Available**
- Ensure Face ID/Touch ID is enabled in device settings
- Register at least one face/fingerprint
- Grant biometric permissions to FridgeTracker

**Session Expired Message**
- Biometric only works with valid Supabase session
- Sessions expire after inactivity
- Simply login with password again

**Toggle Does Not Work**
- Check device settings for biometric enrollment
- Restart app
- Re-enable in Settings

---

## Technical Implementation

### Files Created

1. **src/utils/BiometricAuth.js**
   - Utility functions for biometric operations
   - Hardware detection
   - Authentication prompts
   - Secure storage management

2. **src/screens/SettingsScreen.js**
   - Biometric toggle UI
   - Account information
   - App version info

### Files Modified

1. **src/context/AuthContext.js**
   - Added biometric state management
   - loginWithBiometric() function
   - enableBiometric() / disableBiometric() functions
   - checkBiometricEnabled() function

2. **src/screens/LoginScreen.js**
   - Biometric toggle on login
   - Auto-login on app launch
   - "Login with Face ID/Touch ID" button
   - Biometric availability detection

3. **src/screens/HomeScreen.js**
   - Settings card links to Settings screen

4. **src/navigation/AppNavigator.js**
   - Added Settings screen route

### Dependencies Added

```json
{
  "expo-local-authentication": "^14.1.3",
  "expo-secure-store": "^14.0.0"
}
```

---

## Security Considerations

### What is Stored
- **Email address** - Encrypted in SecureStore
- **Biometric enabled flag** - Boolean in SecureStore

### What is NOT Stored
- Password (never stored)
- Authentication tokens
- Session data

### Security Model

1. **Biometric Does Not Replace Password**
   - Biometric only enables quick access
   - Real authentication still via Supabase
   - Session required for app functionality

2. **Secure Storage**
   - Expo SecureStore uses platform encryption
   - iOS: Keychain Services
   - Android: EncryptedSharedPreferences
   - Data encrypted at rest

3. **Session Management**
   - Biometric checks valid Supabase session
   - If expired, prompts for password
   - No security bypass

---

## Testing Checklist

### iOS Testing

- Face ID prompt appears
- Successful authentication logs in
- Failed authentication shows error
- Toggle on login screen works
- Toggle in settings works
- Auto-login on app launch
- Session expiry handled
- Disabled when Face ID not enrolled

### Android Testing

- Fingerprint/Face prompt appears
- Successful authentication logs in
- Failed authentication shows error
- Toggle on login screen works
- Toggle in settings works
- Auto-login on app launch
- Session expiry handled
- Disabled when biometric not enrolled

---

## Common Questions

**Q: Is my password stored?**
A: No, only your email is stored (encrypted). Password is never stored.

**Q: Can I use biometric on multiple devices?**
A: You must enable biometric separately on each device.

**Q: What if my session expires?**
A: You will need to login with password again. Biometric requires valid session.

**Q: Is it secure?**
A: Yes, uses platform encryption (iOS Keychain / Android EncryptedSharedPreferences).

---

## Additional Resources

- [Expo Local Authentication Docs](https://docs.expo.dev/versions/latest/sdk/local-authentication/)
- [Expo SecureStore Docs](https://docs.expo.dev/versions/latest/sdk/securestore/)
- [iOS Face ID Guidelines](https://developer.apple.com/design/human-interface-guidelines/face-id-and-touch-id)
- [Android BiometricPrompt](https://developer.android.com/training/sign-in/biometric-auth)

---

**FridgeTracker - Quick, Secure, Convenient!**
