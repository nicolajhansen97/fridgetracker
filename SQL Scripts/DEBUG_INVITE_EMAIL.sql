-- Run these one at a time in Supabase SQL Editor to debug the invite email

-- STEP 1: Check if pg_net extension is enabled
SELECT * FROM pg_extension WHERE extname = 'pg_net';

-- STEP 2: Test the function directly (replace with real emails)
SELECT send_household_invite_email(
  'Test Household',
  'nicolajhansen97@live.dk',
  'YOUR_TEST_EMAIL_HERE'  -- put the email you invited
);

-- STEP 3: Check what Resend actually responded (run ~5 seconds after step 2)
SELECT
  id,
  status_code,
  content::text,
  error_msg,
  created
FROM net._http_response
ORDER BY created DESC
LIMIT 5;
