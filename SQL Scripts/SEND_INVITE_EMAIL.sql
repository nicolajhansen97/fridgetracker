-- Function to send household invite emails via Resend API using pg_net
-- Run this in your Supabase SQL Editor

CREATE OR REPLACE FUNCTION send_household_invite_email(
  p_household_name text,
  p_invited_by_email text,
  p_invitee_email text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_html_body text;
BEGIN
  -- Build the HTML email body
  v_html_body := '<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, ''Helvetica Neue'', Arial, sans-serif; background-color: #f5f7fa; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; }
    .logo { font-size: 64px; margin-bottom: 10px; }
    .app-name { font-size: 28px; font-weight: bold; color: #ffffff; margin: 0; }
    .content { padding: 40px 30px; color: #333333; line-height: 1.6; }
    .content h2 { color: #667eea; margin-top: 0; font-size: 24px; }
    .highlight-box { background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%); border-left: 4px solid #667eea; padding: 15px 20px; margin: 25px 0; border-radius: 0 8px 8px 0; }
    .highlight-box p { margin: 0; color: #333; font-size: 16px; }
    .highlight-box strong { color: #667eea; }
    .steps { background-color: #f8f9ff; border-radius: 12px; padding: 20px 25px; margin: 25px 0; }
    .steps h3 { color: #667eea; margin-top: 0; font-size: 16px; }
    .steps ol { margin: 0; padding-left: 20px; color: #555; }
    .steps li { margin-bottom: 8px; font-size: 15px; }
    .footer { background-color: #f5f7fa; padding: 30px; text-align: center; color: #888888; font-size: 14px; border-top: 1px solid #eee; }
    .footer strong { color: #667eea; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">❄️</div>
      <h1 class="app-name">Freezely</h1>
    </div>

    <div class="content">
      <h2>You''ve been invited!</h2>
      <p>Hi there,</p>

      <div class="highlight-box">
        <p><strong>' || p_invited_by_email || '</strong> has invited you to join <strong>"' || p_household_name || '"</strong> on Freezely.</p>
      </div>

      <p>Freezely helps you track what''s in your freezer and share it with your household — so everyone knows what''s available and nothing gets forgotten at the back of the freezer.</p>

      <div class="steps">
        <h3>📱 How to accept your invitation:</h3>
        <ol>
          <li>Download <strong>Freezely</strong> from the App Store</li>
          <li>Sign up or log in using <strong>this email address</strong></li>
          <li>Your invitation will be waiting for you in the app</li>
        </ol>
      </div>

      <p style="color: #888; font-size: 14px;">
        If you didn''t expect this invitation or don''t want to join, you can safely ignore this email.
      </p>
    </div>

    <div class="footer">
      <p><strong>Freezely</strong></p>
      <p>Track What''s In Your Freezer</p>
      <p style="margin-top: 15px; font-size: 12px; color: #aaa;">
        This invitation was sent to ' || p_invitee_email || '
      </p>
    </div>
  </div>
</body>
</html>';

  -- Send the email via Resend API using pg_net
  PERFORM net.http_post(
    url := 'https://api.resend.com/emails',
    headers := '{"Authorization": "Bearer re_C9KzNk63_N9p4C1u1HqenDRtTv9Buf34K", "Content-Type": "application/json"}'::jsonb,
    body := jsonb_build_object(
      'from', 'Freezely <freezely@lastwarac.com>',
      'to', ARRAY[p_invitee_email],
      'subject', p_invited_by_email || ' invited you to join ' || p_household_name || ' on Freezely',
      'html', v_html_body
    )
  );

  RETURN json_build_object('success', true);

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION send_household_invite_email(text, text, text) TO authenticated;

-- -------------------------------------------------------
-- RPC to get pending invites for a household (bypasses RLS)
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION get_pending_invites(p_household_id uuid)
RETURNS TABLE (
  id uuid,
  invited_email text,
  created_at timestamptz,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow if caller is an owner of the household
  IF NOT EXISTS (
    SELECT 1 FROM household_members
    WHERE household_id = p_household_id
      AND user_id = auth.uid()
      AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
    SELECT hi.id, hi.invited_email, hi.created_at, hi.status
    FROM household_invitations hi
    WHERE hi.household_id = p_household_id
      AND hi.status = 'pending'
    ORDER BY hi.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_pending_invites(uuid) TO authenticated;

-- -------------------------------------------------------
-- RPC to cancel a pending invite (bypasses RLS)
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION cancel_household_invite(p_invite_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_household_id uuid;
BEGIN
  -- Get the household_id for this invite
  SELECT household_id INTO v_household_id
  FROM household_invitations
  WHERE id = p_invite_id AND status = 'pending';

  IF v_household_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invite not found');
  END IF;

  -- Only allow if caller is an owner of the household
  IF NOT EXISTS (
    SELECT 1 FROM household_members
    WHERE household_id = v_household_id
      AND user_id = auth.uid()
      AND role = 'owner'
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Access denied');
  END IF;

  DELETE FROM household_invitations WHERE id = p_invite_id;

  RETURN json_build_object('success', true);

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION cancel_household_invite(uuid) TO authenticated;
