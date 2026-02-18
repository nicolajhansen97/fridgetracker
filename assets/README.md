# App Icons & Assets

## Required Icon Files

To complete your FreezerTracker app branding, add these image files to this folder:

### 1. **icon.png** (App Icon)
- **Size:** 1024x1024 pixels
- **Format:** PNG with transparent background
- **Usage:** Main app icon for iOS and Android
- **Suggestion:** A freezer or snowflake icon ❄️

### 2. **adaptive-icon.png** (Android Adaptive Icon)
- **Size:** 1024x1024 pixels
- **Format:** PNG with transparent background
- **Usage:** Android adaptive icon (foreground layer)
- **Note:** Design should fit within safe area (central 66%)

### 3. **splash.png** (Splash Screen)
- **Size:** 1284x2778 pixels (or any 9:16 ratio)
- **Format:** PNG
- **Usage:** Shown while app loads
- **Background:** Matches `backgroundColor` in app.json (#667eea)

## Quick Icon Creation Options

### Option 1: Use Canva (Free)
1. Go to [canva.com](https://canva.com)
2. Create custom size: 1024x1024
3. Search for "freezer" or "snowflake" icons
4. Export as PNG with transparent background

### Option 2: Use IconKitchen (Free)
1. Go to [icon.kitchen](https://icon.kitchen)
2. Choose "Image" tab
3. Upload or select a freezer/snowflake icon
4. Customize colors (use #667eea purple theme)
5. Download all sizes

### Option 3: Use Text-based Icon (Quick)
Create a simple icon with:
- Background: Purple gradient (#667eea to #764ba2)
- Text: "❄️" (snowflake emoji) centered
- Size: 1024x1024

### Option 4: AI Generation
Use AI tools like:
- DALL-E: "minimalist freezer app icon, purple gradient"
- Midjourney: "/imagine freezer app icon, modern, purple, minimalist"

## Color Scheme
Match your app's theme:
- Primary: `#667eea` (purple)
- Secondary: `#764ba2` (darker purple)
- Accent: `#43e97b` (green)
- Background: `#f5f7fa` (light gray)

## After Adding Icons
1. Place icon files in this folder
2. Run: `npx expo start --clear`
3. The new icons will appear on your app!

## Notes
- Icons must be exactly the specified sizes
- PNG format with transparency is recommended
- Keep designs simple and recognizable at small sizes
- Test on both iOS and Android for best results
