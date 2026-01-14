# Supabase Setup Guide

This guide will help you set up Supabase authentication for your React Native app.

## Step 1: Create a Supabase Account

1. Go to [https://supabase.com](https://supabase.com)
2. Click "Start your project" and sign up for a free account
3. Verify your email address

## Step 2: Create a New Project

1. After logging in, click "New Project"
2. Fill in the following details:
   - **Name**: Choose a name for your project (e.g., "my-react-native-app")
   - **Database Password**: Create a strong password (save this securely!)
   - **Region**: Choose the region closest to your users
3. Click "Create new project"
4. Wait for the project to be set up (this takes about 2 minutes)

## Step 3: Get Your API Credentials

1. Once your project is ready, go to **Settings** (gear icon in the sidebar)
2. Click on **API** in the settings menu
3. You'll see two important values:
   - **Project URL** (looks like: `https://xxxxxxxxxxxxx.supabase.co`)
   - **anon public** key (a long string starting with `eyJ...`)
4. Keep this page open, you'll need these values in the next step

## Step 4: Configure Your App

1. Open the file `src/config/supabase.js` in your app
2. Replace the placeholder values with your actual credentials:

```javascript
const supabaseUrl = 'https://xxxxxxxxxxxxx.supabase.co'; // Your Project URL
const supabaseAnonKey = 'eyJxxxxx...'; // Your anon public key
```

## Step 5: Enable Email Authentication

1. In your Supabase dashboard, go to **Authentication** in the sidebar
2. Click on **Providers**
3. Make sure **Email** is enabled (it should be enabled by default)
4. Scroll down to **Email Auth** settings:
   - **Enable email confirmations**: Turn this ON for production (users must verify their email)
   - **Enable email confirmations**: Turn this OFF for testing (users can login immediately)
5. Click "Save"

## Step 6: Configure Email Templates (Optional)

1. In **Authentication** > **Email Templates**
2. You can customize the emails sent for:
   - Email confirmation
   - Password reset
   - Magic link
3. Customize the templates with your app name and branding

## Step 7: Install Dependencies and Run

1. Open your terminal and navigate to your project folder:
```bash
cd my-react-native-app
```

2. Install Node.js dependencies:
```bash
npm install
```

3. Start the app:
```bash
npm start
```

4. Scan the QR code with Expo Go app to test on your device

## Testing Your App

### Register a New User
1. Open your app
2. Click "Sign Up" on the login screen
3. Enter an email and password (minimum 6 characters)
4. Click "Sign Up"
5. Check your email for a confirmation link (if email confirmations are enabled)

### Login
1. Enter your email and password
2. Click "Login"
3. You should be redirected to the homepage

### Forgot Password
1. Click "Forgot Password?" on the login screen
2. Enter your email address
3. Click "Send Reset Link"
4. Check your email for the password reset link

## Important Security Notes

### For Development
- You can disable email confirmations for easier testing
- Use test email addresses

### For Production
1. **Enable Email Confirmations**: This prevents fake signups
2. **Add Rate Limiting**: Prevent abuse by enabling rate limiting in Supabase
3. **Set up Custom SMTP**: Use your own email service (SendGrid, Mailgun, etc.)
   - Go to **Settings** > **Auth** > **SMTP Settings**
   - Enter your SMTP credentials
4. **Secure your API keys**: Never commit your Supabase keys to public repositories

## Common Issues & Solutions

### Issue: "Invalid API key"
- Make sure you copied the **anon public** key, not the service role key
- Check for extra spaces when pasting

### Issue: "Email not confirmed"
- Either confirm your email via the link sent
- Or disable email confirmations in Supabase Auth settings

### Issue: "User already registered"
- Check your Supabase dashboard under **Authentication** > **Users**
- Delete the user if needed, or use a different email

### Issue: Password reset email not received
- Check your spam folder
- Verify your email address is correct
- Check Supabase logs under **Logs** in the dashboard

## Supabase Dashboard Overview

### Authentication > Users
- View all registered users
- Manually create or delete users
- Reset user passwords

### Authentication > Logs
- View authentication events
- Debug login/signup issues
- Monitor failed attempts

### Database > Tables
- View the `auth.users` table (your user data)
- Add custom user profile tables if needed

## Next Steps

1. **Add User Profiles**: Create a `profiles` table to store additional user data
2. **Add Row Level Security (RLS)**: Protect your data with Supabase policies
3. **Enable Social Auth**: Add Google, GitHub, or other OAuth providers
4. **Add Metadata**: Store custom user data in the `user_metadata` field

## Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Auth Guide](https://supabase.com/docs/guides/auth)
- [React Native Quickstart](https://supabase.com/docs/guides/getting-started/quickstarts/reactnative)
