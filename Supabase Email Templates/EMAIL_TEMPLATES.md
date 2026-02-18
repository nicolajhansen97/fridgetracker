# FreezerTracker - Supabase Email Templates

Custom branded email templates for authentication flows.

## How to Apply These Templates

1. Go to your Supabase Dashboard
2. Navigate to **Authentication** → **Email Templates**
3. Select each template type (Confirm signup, Magic Link, etc.)
4. Copy and paste the corresponding HTML template below
5. Click **Save**

---

## 1. Confirm Signup (Email Confirmation)

**Template Name:** Confirm signup
**Subject:** Welcome to FreezerTracker - Confirm Your Email ❄️

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #f5f7fa;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 40px 20px;
      text-align: center;
    }
    .logo {
      font-size: 64px;
      margin-bottom: 10px;
    }
    .app-name {
      font-size: 28px;
      font-weight: bold;
      color: #ffffff;
      margin: 0;
    }
    .content {
      padding: 40px 30px;
      color: #333333;
      line-height: 1.6;
    }
    .content h2 {
      color: #667eea;
      margin-top: 0;
    }
    .button {
      display: inline-block;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #ffffff !important;
      text-decoration: none;
      padding: 16px 40px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 16px;
      margin: 20px 0;
    }
    .footer {
      background-color: #f5f7fa;
      padding: 30px;
      text-align: center;
      color: #888888;
      font-size: 14px;
    }
    .divider {
      height: 1px;
      background-color: #e0e0e0;
      margin: 30px 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">❄️</div>
      <h1 class="app-name">FreezerTracker</h1>
    </div>

    <div class="content">
      <h2>Welcome to FreezerTracker!</h2>
      <p>Hi there,</p>
      <p>Thank you for signing up! We're excited to help you track what's in your freezer and reduce food waste.</p>
      <p>To complete your registration and start organizing your frozen items, please confirm your email address by clicking the button below:</p>

      <div style="text-align: center;">
        <a href="{{ .ConfirmationURL }}" class="button">Confirm Your Email</a>
      </div>

      <p style="color: #888; font-size: 14px; margin-top: 30px;">
        Or copy and paste this link into your browser:<br>
        <a href="{{ .ConfirmationURL }}" style="color: #667eea; word-break: break-all;">{{ .ConfirmationURL }}</a>
      </p>

      <div class="divider"></div>

      <p style="font-size: 14px; color: #888;">
        If you didn't create an account with FreezerTracker, you can safely ignore this email.
      </p>
    </div>

    <div class="footer">
      <p><strong>FreezerTracker</strong></p>
      <p>Track What's In Your Freezer</p>
      <p style="margin-top: 20px; font-size: 12px;">
        This email was sent to {{ .Email }}
      </p>
    </div>
  </div>
</body>
</html>
```

---

## 2. Magic Link (Passwordless Login)

**Template Name:** Magic Link
**Subject:** Your FreezerTracker Login Link ❄️

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #f5f7fa;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 40px 20px;
      text-align: center;
    }
    .logo {
      font-size: 64px;
      margin-bottom: 10px;
    }
    .app-name {
      font-size: 28px;
      font-weight: bold;
      color: #ffffff;
      margin: 0;
    }
    .content {
      padding: 40px 30px;
      color: #333333;
      line-height: 1.6;
    }
    .content h2 {
      color: #667eea;
      margin-top: 0;
    }
    .button {
      display: inline-block;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #ffffff !important;
      text-decoration: none;
      padding: 16px 40px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 16px;
      margin: 20px 0;
    }
    .footer {
      background-color: #f5f7fa;
      padding: 30px;
      text-align: center;
      color: #888888;
      font-size: 14px;
    }
    .warning {
      background-color: #fff3cd;
      border-left: 4px solid #ffc107;
      padding: 15px;
      margin: 20px 0;
      color: #856404;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">❄️</div>
      <h1 class="app-name">FreezerTracker</h1>
    </div>

    <div class="content">
      <h2>Your Login Link</h2>
      <p>Hi there,</p>
      <p>Click the button below to securely log in to your FreezerTracker account:</p>

      <div style="text-align: center;">
        <a href="{{ .ConfirmationURL }}" class="button">Log In to FreezerTracker</a>
      </div>

      <div class="warning">
        <strong>⚠️ Security Notice:</strong> This link will expire in 1 hour for your security.
      </div>

      <p style="color: #888; font-size: 14px; margin-top: 30px;">
        Or copy and paste this link into your browser:<br>
        <a href="{{ .ConfirmationURL }}" style="color: #667eea; word-break: break-all;">{{ .ConfirmationURL }}</a>
      </p>

      <p style="font-size: 14px; color: #888; margin-top: 30px;">
        If you didn't request this login link, you can safely ignore this email. Your account remains secure.
      </p>
    </div>

    <div class="footer">
      <p><strong>FreezerTracker</strong></p>
      <p>Track What's In Your Freezer</p>
      <p style="margin-top: 20px; font-size: 12px;">
        This email was sent to {{ .Email }}
      </p>
    </div>
  </div>
</body>
</html>
```

---

## 3. Reset Password

**Template Name:** Reset Password
**Subject:** Reset Your FreezerTracker Password ❄️

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #f5f7fa;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 40px 20px;
      text-align: center;
    }
    .logo {
      font-size: 64px;
      margin-bottom: 10px;
    }
    .app-name {
      font-size: 28px;
      font-weight: bold;
      color: #ffffff;
      margin: 0;
    }
    .content {
      padding: 40px 30px;
      color: #333333;
      line-height: 1.6;
    }
    .content h2 {
      color: #667eea;
      margin-top: 0;
    }
    .button {
      display: inline-block;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #ffffff !important;
      text-decoration: none;
      padding: 16px 40px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 16px;
      margin: 20px 0;
    }
    .footer {
      background-color: #f5f7fa;
      padding: 30px;
      text-align: center;
      color: #888888;
      font-size: 14px;
    }
    .warning {
      background-color: #fff3cd;
      border-left: 4px solid #ffc107;
      padding: 15px;
      margin: 20px 0;
      color: #856404;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">❄️</div>
      <h1 class="app-name">FreezerTracker</h1>
    </div>

    <div class="content">
      <h2>Reset Your Password</h2>
      <p>Hi there,</p>
      <p>We received a request to reset your password for your FreezerTracker account.</p>
      <p>Click the button below to create a new password:</p>

      <div style="text-align: center;">
        <a href="{{ .ConfirmationURL }}" class="button">Reset Password</a>
      </div>

      <div class="warning">
        <strong>⚠️ Important:</strong> This link will expire in 1 hour for security reasons.
      </div>

      <p style="color: #888; font-size: 14px; margin-top: 30px;">
        Or copy and paste this link into your browser:<br>
        <a href="{{ .ConfirmationURL }}" style="color: #667eea; word-break: break-all;">{{ .ConfirmationURL }}</a>
      </p>

      <p style="font-size: 14px; color: #ff3b30; margin-top: 30px;">
        <strong>Didn't request a password reset?</strong><br>
        If you didn't request this password reset, please ignore this email. Your password will remain unchanged and your account is still secure.
      </p>
    </div>

    <div class="footer">
      <p><strong>FreezerTracker</strong></p>
      <p>Track What's In Your Freezer</p>
      <p style="margin-top: 20px; font-size: 12px;">
        This email was sent to {{ .Email }}
      </p>
    </div>
  </div>
</body>
</html>
```

---

## 4. Change Email Address

**Template Name:** Change Email Address
**Subject:** Confirm Your New Email Address for FreezerTracker ❄️

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #f5f7fa;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 40px 20px;
      text-align: center;
    }
    .logo {
      font-size: 64px;
      margin-bottom: 10px;
    }
    .app-name {
      font-size: 28px;
      font-weight: bold;
      color: #ffffff;
      margin: 0;
    }
    .content {
      padding: 40px 30px;
      color: #333333;
      line-height: 1.6;
    }
    .content h2 {
      color: #667eea;
      margin-top: 0;
    }
    .button {
      display: inline-block;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #ffffff !important;
      text-decoration: none;
      padding: 16px 40px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 16px;
      margin: 20px 0;
    }
    .footer {
      background-color: #f5f7fa;
      padding: 30px;
      text-align: center;
      color: #888888;
      font-size: 14px;
    }
    .info-box {
      background-color: #e3f2fd;
      border-left: 4px solid #2196f3;
      padding: 15px;
      margin: 20px 0;
      color: #1565c0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">❄️</div>
      <h1 class="app-name">FreezerTracker</h1>
    </div>

    <div class="content">
      <h2>Confirm Email Change</h2>
      <p>Hi there,</p>
      <p>You recently requested to change the email address associated with your FreezerTracker account.</p>

      <div class="info-box">
        <strong>ℹ️ New Email:</strong> {{ .Email }}
      </div>

      <p>To complete this change and start using your new email address, please click the button below:</p>

      <div style="text-align: center;">
        <a href="{{ .ConfirmationURL }}" class="button">Confirm New Email</a>
      </div>

      <p style="color: #888; font-size: 14px; margin-top: 30px;">
        Or copy and paste this link into your browser:<br>
        <a href="{{ .ConfirmationURL }}" style="color: #667eea; word-break: break-all;">{{ .ConfirmationURL }}</a>
      </p>

      <p style="font-size: 14px; color: #888; margin-top: 30px;">
        If you didn't request this email change, please contact us immediately. Someone may be trying to access your account.
      </p>
    </div>

    <div class="footer">
      <p><strong>FreezerTracker</strong></p>
      <p>Track What's In Your Freezer</p>
      <p style="margin-top: 20px; font-size: 12px;">
        This email was sent to {{ .Email }}
      </p>
    </div>
  </div>
</body>
</html>
```

---

## 5. Invite User (Optional - for household invitations)

**Template Name:** Invite User
**Subject:** You've Been Invited to Join a Household on FreezerTracker ❄️

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #f5f7fa;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 40px 20px;
      text-align: center;
    }
    .logo {
      font-size: 64px;
      margin-bottom: 10px;
    }
    .app-name {
      font-size: 28px;
      font-weight: bold;
      color: #ffffff;
      margin: 0;
    }
    .content {
      padding: 40px 30px;
      color: #333333;
      line-height: 1.6;
    }
    .content h2 {
      color: #667eea;
      margin-top: 0;
    }
    .button {
      display: inline-block;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #ffffff !important;
      text-decoration: none;
      padding: 16px 40px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 16px;
      margin: 20px 0;
    }
    .footer {
      background-color: #f5f7fa;
      padding: 30px;
      text-align: center;
      color: #888888;
      font-size: 14px;
    }
    .highlight-box {
      background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
      border: 2px solid #667eea;
      border-radius: 12px;
      padding: 20px;
      margin: 20px 0;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">❄️</div>
      <h1 class="app-name">FreezerTracker</h1>
    </div>

    <div class="content">
      <h2>You've Been Invited!</h2>
      <p>Hi there,</p>
      <p>Great news! You've been invited to join a shared household on FreezerTracker.</p>

      <div class="highlight-box">
        <p style="margin: 0; font-size: 18px; font-weight: 600; color: #667eea;">
          Track your freezer items together with your family or roommates
        </p>
      </div>

      <p>With FreezerTracker, you can:</p>
      <ul>
        <li>See what's in your shared freezer in real-time</li>
        <li>Track expiry dates and get notifications</li>
        <li>Organize items by compartments</li>
        <li>View activity history of who added what and when</li>
      </ul>

      <p>Click the button below to accept the invitation and get started:</p>

      <div style="text-align: center;">
        <a href="{{ .ConfirmationURL }}" class="button">Accept Invitation</a>
      </div>

      <p style="color: #888; font-size: 14px; margin-top: 30px;">
        Or copy and paste this link into your browser:<br>
        <a href="{{ .ConfirmationURL }}" style="color: #667eea; word-break: break-all;">{{ .ConfirmationURL }}</a>
      </p>

      <p style="font-size: 14px; color: #888; margin-top: 30px;">
        If you don't want to join this household, you can safely ignore this email.
      </p>
    </div>

    <div class="footer">
      <p><strong>FreezerTracker</strong></p>
      <p>Track What's In Your Freezer</p>
      <p style="margin-top: 20px; font-size: 12px;">
        This email was sent to {{ .Email }}
      </p>
    </div>
  </div>
</body>
</html>
```

---

## Apply Templates Checklist

- [ ] Open Supabase Dashboard
- [ ] Go to Authentication → Email Templates
- [ ] Update "Confirm signup" template
- [ ] Update "Magic Link" template
- [ ] Update "Reset Password" template
- [ ] Update "Change Email Address" template
- [ ] (Optional) Update "Invite User" template
- [ ] Test each email flow to verify templates work correctly

## Testing Email Templates

After applying templates, test them by:

1. **Confirm Signup**: Create a new account in your app
2. **Magic Link**: Use passwordless login feature (if implemented)
3. **Reset Password**: Use "Forgot Password" feature
4. **Change Email**: Update email in account settings
5. **Invite User**: Send a household invitation

---

**Note:** All templates use Supabase's template variables:
- `{{ .ConfirmationURL }}` - The action link
- `{{ .Email }}` - The recipient's email address
- `{{ .Token }}` - The confirmation token (if needed separately)

These will be automatically replaced by Supabase when sending emails.
