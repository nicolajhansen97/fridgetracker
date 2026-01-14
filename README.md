# My React Native App

A beautiful React Native mobile application with Supabase authentication and fridge inventory management.

## Features

- **Authentication with Supabase**
  - User registration with email verification
  - Secure login
  - Password reset functionality
  - Persistent sessions
- **Fridge Inventory Management**
  - Track what's in your fridge
  - **Customizable drawers/compartments** - Define your own with custom icons
  - **European date format (DD-MM-YYYY)** with visual date picker
  - Set expiry dates for items
  - Add quantity and notes
  - Pull-to-refresh to update inventory
  - Delete items when consumed
  - Organize items by your custom drawers
- **Beautiful UI Design**
  - Gradient login screen
  - Modern registration page
  - Forgot password screen
  - Homepage with quick access cards
  - Fridge inventory with organized sections
  - Easy-to-use add item form
- **Responsive design** with smooth animations

## Prerequisites

Before running this app, make sure you have the following installed:

- **Node.js** (v16 or higher) - [Download here](https://nodejs.org/)
- **npm** or **yarn**
- **Expo CLI** (optional, will be installed with dependencies)
- **Supabase Account** (free) - [Sign up here](https://supabase.com)

## Installation

### 1. Install Node.js

If you don't have Node.js installed:
1. Download from [https://nodejs.org/](https://nodejs.org/)
2. Install the LTS version
3. Verify installation by running:
```bash
node --version
npm --version
```

### 2. Navigate to Project Directory

```bash
cd my-react-native-app
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Set Up Supabase

Follow the detailed guides:
- [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) - Authentication setup
- [FRIDGE_DATABASE_SETUP.md](./FRIDGE_DATABASE_SETUP.md) - Database setup for fridge feature
- [DRAWER_FEATURE_SETUP.md](./DRAWER_FEATURE_SETUP.md) - Custom drawers & date picker setup
- [CREATE_DRAWERS_TABLE.sql](./CREATE_DRAWERS_TABLE.sql) - SQL script for drawers table

**Quick Setup:**
1. Create a free account at [https://supabase.com](https://supabase.com)
2. Create a new project
3. Get your **Project URL** and **anon public key** from Settings > API
4. Update [src/config/supabase.js](src/config/supabase.js):
   ```javascript
   const supabaseUrl = 'YOUR_PROJECT_URL';
   const supabaseAnonKey = 'YOUR_ANON_KEY';
   ```
5. Run the SQL script in [FRIDGE_DATABASE_SETUP.md](./FRIDGE_DATABASE_SETUP.md) to create the fridge_items table

## Running the App

### Start the Development Server

```bash
npm start
```

### Run on Specific Platform

```bash
npm run android  # For Android
npm run ios      # For iOS (Mac only)
npm run web      # For web browser
```

### Run on Your Phone

1. Install **Expo Go** app on your phone:
   - [iOS - App Store](https://apps.apple.com/app/expo-go/id982107779)
   - [Android - Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent)
2. Scan the QR code shown in your terminal
3. The app will load on your phone

## Project Structure

```
my-react-native-app/
├── App.js                          # Main app component
├── app.json                        # Expo configuration
├── package.json                    # Dependencies
├── babel.config.js                 # Babel configuration
├── SUPABASE_SETUP.md              # Detailed Supabase setup guide
├── FRIDGE_DATABASE_SETUP.md       # Database setup for fridge feature
├── DRAWER_FEATURE_SETUP.md        # Custom drawers & date picker guide
├── CREATE_DRAWERS_TABLE.sql       # SQL script for drawers table
├── src/
│   ├── screens/
│   │   ├── LoginScreen.js         # Login page with Supabase
│   │   ├── RegisterScreen.js      # Registration page
│   │   ├── ForgotPasswordScreen.js # Password reset page
│   │   ├── HomeScreen.js          # Homepage
│   │   ├── FridgeInventoryScreen.js # View all fridge items
│   │   ├── AddItemScreen.js       # Add new fridge item (with date picker)
│   │   └── ManageDrawersScreen.js # Manage custom drawers
│   ├── navigation/
│   │   └── AppNavigator.js        # Navigation setup
│   ├── context/
│   │   ├── AuthContext.js         # Supabase auth context
│   │   ├── FridgeContext.js       # Fridge inventory management
│   │   └── DrawerContext.js       # Custom drawers management
│   └── config/
│       └── supabase.js            # Supabase configuration
```

## How to Use

### Register a New Account
1. Open the app
2. Click "Sign Up" on the login screen
3. Enter your email and password
4. Click "Sign Up"
5. Check your email for verification (if enabled in Supabase)

### Login
1. Enter your registered email and password
2. Click "Login"
3. You'll be redirected to the homepage

### Forgot Password
1. Click "Forgot Password?" on the login screen
2. Enter your email address
3. Click "Send Reset Link"
4. Check your email for the password reset link
5. Follow the link to reset your password

### Logout
1. On the homepage, click the "Logout" button in the top right
2. You'll be redirected back to the login screen

### Managing Custom Drawers
1. On the homepage, click the "Manage Drawers" card
2. Select an icon from the icon picker (📦, ❄️, 🧊, 🥬, etc.)
3. Enter a drawer name (e.g., "Fryser", "Kjøleskap")
4. Click "Add Drawer"
5. Edit or delete existing drawers as needed
6. Click "← Back" to return

### Using the Fridge Inventory
1. On the homepage, click the "My Fridge" card
2. Click "+ Add" to add a new item
3. Fill in the item details:
   - Item name (required)
   - Select a drawer/compartment from your custom drawers (required)
   - Set quantity (optional)
   - **Select expiry date using the date picker** - displays as DD-MM-YYYY (optional)
   - Add notes (optional)
4. Click "Add to Fridge"
5. View all your items organized by your custom drawers
6. Swipe down to refresh the list
7. Click the trash icon to delete an item

## Technologies Used

- **React Native** - Mobile framework
- **Expo** - Development platform
- **Supabase** - Backend and authentication
- **React Navigation** - Navigation system
- **Expo Linear Gradient** - Beautiful gradients
- **AsyncStorage** - Persistent storage
- **Context API** - State management
- **react-native-modal-datetime-picker** - Date picker with European format
- **@react-native-community/datetimepicker** - Native date/time picker

## Customization

### Changing Colors

The app uses gradient colors. To customize them:

**Login Screen** - [src/screens/LoginScreen.js](src/screens/LoginScreen.js)
```javascript
colors={['#667eea', '#764ba2']} // Change these hex values
```

**Register Screen** - [src/screens/RegisterScreen.js](src/screens/RegisterScreen.js)
```javascript
colors={['#f093fb', '#f5576c']} // Pink gradient
```

**Forgot Password** - [src/screens/ForgotPasswordScreen.js](src/screens/ForgotPasswordScreen.js)
```javascript
colors={['#4facfe', '#00f2fe']} // Blue gradient
```

### Adding More Screens

1. Create a new screen component in `src/screens/`
2. Import it in `src/navigation/AppNavigator.js`
3. Add it to the Stack Navigator
4. Navigate to it using `navigation.navigate('ScreenName')`

### Customizing Email Templates

In your Supabase dashboard:
1. Go to **Authentication** > **Email Templates**
2. Customize the confirmation and reset password emails
3. Add your branding and custom messages

## Troubleshooting

### npm command not found
- Install Node.js from [https://nodejs.org/](https://nodejs.org/)
- Restart your terminal after installation

### Supabase errors
- Make sure you've updated the URL and anon key in `src/config/supabase.js`
- Check that email auth is enabled in Supabase dashboard
- See [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) for detailed troubleshooting

### Email not received
- Check your spam folder
- Verify your Supabase email settings
- For testing, disable email confirmations in Supabase Auth settings

### App won't load
- Make sure all dependencies are installed: `npm install`
- Clear the cache: `expo start -c`
- Check that you have a stable internet connection

## Security Best Practices

1. **Never commit your Supabase keys** to public repositories
2. **Enable email confirmations** in production
3. **Use environment variables** for sensitive data in production
4. **Enable Row Level Security (RLS)** in Supabase for database tables
5. **Set up rate limiting** to prevent abuse

## Next Steps

- Add user profile page
- Implement social authentication (Google, Apple, etc.)
- Add real-time features with Supabase
- Create custom user profile tables
- Add file uploads to Supabase Storage
- Implement push notifications

## Support

For issues or questions:
- [React Native Docs](https://reactnative.dev/)
- [Expo Docs](https://docs.expo.dev/)
- [React Navigation Docs](https://reactnavigation.org/)
- [Supabase Docs](https://supabase.com/docs)
- [Supabase Discord](https://discord.supabase.com/)

## License

This project is open source and available for personal and commercial use.
