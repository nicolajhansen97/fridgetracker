-- Update invite email with professional design + App Store / Google Play buttons
-- Run this in your Supabase SQL Editor

DROP FUNCTION IF EXISTS send_household_invite_email(text, text, text);
DROP FUNCTION IF EXISTS send_household_invite_email(text, text, text, uuid);
CREATE OR REPLACE FUNCTION send_household_invite_email(
  p_household_name text,
  p_invited_by_email text,
  p_invitee_email text,
  p_invite_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_html_body text;
BEGIN
  v_html_body :=
'<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You''ve been invited to Freezely</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,''Helvetica Neue'',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f2f5;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:580px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:48px 40px;text-align:center;">
              <p style="margin:0 0 14px;font-size:60px;line-height:1;">❄️</p>
              <h1 style="margin:0;color:#ffffff;font-size:34px;font-weight:800;letter-spacing:-0.5px;">Freezely</h1>
              <p style="margin:10px 0 0;color:rgba(255,255,255,0.80);font-size:15px;letter-spacing:0.3px;">Track What''s In Your Freezer</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:44px 40px 8px;">

              <h2 style="margin:0 0 6px;color:#1a1a2e;font-size:28px;font-weight:700;">You''ve been invited! 🎉</h2>
              <p style="margin:0 0 28px;color:#888;font-size:16px;">Hi there,</p>

              <!-- Invite card -->
              <div style="background:linear-gradient(135deg,#f3f4ff 0%,#f9f0ff 100%);border:1px solid #ddddf5;border-radius:12px;padding:22px 24px;margin-bottom:28px;">
                <p style="margin:0;color:#444;font-size:16px;line-height:1.65;">
                  <strong style="color:#667eea;">' || p_invited_by_email || '</strong>&nbsp;has invited you to join&nbsp;<strong style="color:#667eea;">&ldquo;' || p_household_name || '&rdquo;</strong>&nbsp;on&nbsp;Freezely.
                </p>
              </div>

              <p style="margin:0 0 28px;color:#555;font-size:15px;line-height:1.75;">
                Freezely helps families and roommates keep track of what''s in their shared freezer — so everyone knows what''s available and nothing gets forgotten at the back.
              </p>

              <!-- Steps -->
              <div style="background:#f8f9fa;border-radius:12px;padding:24px 28px;margin-bottom:32px;">
                <p style="margin:0 0 14px;color:#333;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;">📱 How to accept your invitation</p>
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td style="padding:6px 0;vertical-align:top;">
                      <span style="display:inline-block;background:#667eea;color:#fff;border-radius:50%;width:22px;height:22px;text-align:center;font-size:12px;font-weight:700;line-height:22px;margin-right:12px;">1</span>
                      <span style="color:#555;font-size:15px;">Download <strong>Freezely</strong> from the App Store or Google Play</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;vertical-align:top;">
                      <span style="display:inline-block;background:#667eea;color:#fff;border-radius:50%;width:22px;height:22px;text-align:center;font-size:12px;font-weight:700;line-height:22px;margin-right:12px;">2</span>
                      <span style="color:#555;font-size:15px;">Sign up or log in using <strong>this email address</strong></span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;vertical-align:top;">
                      <span style="display:inline-block;background:#667eea;color:#fff;border-radius:50%;width:22px;height:22px;text-align:center;font-size:12px;font-weight:700;line-height:22px;margin-right:12px;">3</span>
                      <span style="color:#555;font-size:15px;">Your invitation will be waiting for you in the app</span>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- Download buttons -->
              <p style="margin:0 0 18px;color:#333;font-size:14px;font-weight:700;text-align:center;text-transform:uppercase;letter-spacing:0.8px;">Download Freezely</p>
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center" style="padding:0 8px 0 0;">
                    <a href="https://apps.apple.com/us/app/alliance-center-for-last-war/id6758313587"
                       style="display:inline-block;background:#000000;color:#ffffff;text-decoration:none;border-radius:12px;padding:15px 28px;font-size:14px;font-weight:600;letter-spacing:0.2px;line-height:1;">
                      🍎&nbsp;&nbsp;App Store
                    </a>
                  </td>
                  <td align="center" style="padding:0 0 0 8px;">
                    <a href="https://play.google.com/store/apps/details?id=com.nicolajhansen97.aclw"
                       style="display:inline-block;background:#01875f;color:#ffffff;text-decoration:none;border-radius:12px;padding:15px 28px;font-size:14px;font-weight:600;letter-spacing:0.2px;line-height:1;">
                      ▶&nbsp;&nbsp;Google Play
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:32px 0 0;color:#bbb;font-size:13px;text-align:center;line-height:1.6;">
                If you didn''t expect this invitation, you can safely ignore this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8f9fa;border-top:1px solid #eeeeee;padding:24px 40px;text-align:center;">
              <p style="margin:0 0 4px;color:#667eea;font-size:15px;font-weight:700;">Freezely</p>
              <p style="margin:0 0 8px;color:#aaa;font-size:12px;">Track What''s In Your Freezer</p>
              <p style="margin:0;color:#ccc;font-size:11px;">This invitation was sent to ' || p_invitee_email || '</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>';

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

  IF p_invite_id IS NOT NULL THEN
    UPDATE household_invitations
    SET last_email_sent_at = now()
    WHERE id = p_invite_id;
  END IF;

  RETURN json_build_object('success', true);

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION send_household_invite_email(text, text, text, uuid) TO authenticated;

-- Update resend_invite_email to delegate to send_household_invite_email
-- so both use the same professional template
CREATE OR REPLACE FUNCTION resend_invite_email(p_invite_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite household_invitations%ROWTYPE;
  v_household households%ROWTYPE;
  v_inviter_email text;
  v_hours_since_last numeric;
BEGIN
  SELECT * INTO v_invite FROM household_invitations WHERE id = p_invite_id AND status = 'pending';
  IF v_invite.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invite not found');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM household_members
    WHERE household_id = v_invite.household_id
      AND user_id = auth.uid()
      AND role = 'owner'
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Access denied');
  END IF;

  IF v_invite.last_email_sent_at IS NOT NULL THEN
    v_hours_since_last := EXTRACT(EPOCH FROM (now() - v_invite.last_email_sent_at)) / 3600;
    IF v_hours_since_last < 24 THEN
      RETURN json_build_object(
        'success', false,
        'cooldown', true,
        'hours_remaining', ROUND((24 - v_hours_since_last)::numeric, 1)
      );
    END IF;
  END IF;

  SELECT * INTO v_household FROM households WHERE id = v_invite.household_id;
  SELECT email INTO v_inviter_email FROM auth.users WHERE id = auth.uid();

  RETURN send_household_invite_email(
    v_household.name,
    v_inviter_email,
    v_invite.invited_email,
    p_invite_id
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION resend_invite_email(uuid) TO authenticated;
