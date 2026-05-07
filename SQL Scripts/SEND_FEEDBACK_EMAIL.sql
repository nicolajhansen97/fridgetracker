-- Function to send in-app feedback emails via Resend API using pg_net
-- Run this in your Supabase SQL Editor.
--
-- The app calls this RPC with the form contents; the function emails
-- the developer (nicolajdeveloper@gmail.com) using the same Resend
-- credentials already used for household invites.
--
-- Drop any earlier signatures so this script is safe to re-run after
-- the argument list changes. CREATE OR REPLACE alone fails for that.
DROP FUNCTION IF EXISTS send_feedback_email(text, text, text, text, text);
DROP FUNCTION IF EXISTS send_feedback_email(text, text, text, text, text, text, text, text);

CREATE OR REPLACE FUNCTION send_feedback_email(
  p_category         text,
  p_message          text,
  p_app_version      text,
  p_platform         text,
  p_platform_version text,
  p_device_model     text,
  p_device_id        text,
  p_locale           text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_email text;
  v_user_id    uuid;
  v_subject    text;
  v_html       text;
  v_emoji      text;
  v_label      text;
  v_device     text;
BEGIN
  -- Caller info
  v_user_id    := auth.uid();
  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

  -- Validate
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  IF p_category NOT IN ('bug', 'feature', 'question', 'other') THEN
    RETURN json_build_object('success', false, 'error', 'Invalid category');
  END IF;
  IF p_message IS NULL OR length(trim(p_message)) = 0 THEN
    RETURN json_build_object('success', false, 'error', 'Message is empty');
  END IF;

  -- Pretty-print the category for the subject
  v_label := CASE p_category
    WHEN 'bug'      THEN 'Bug report'
    WHEN 'feature'  THEN 'Feature request'
    WHEN 'question' THEN 'Question'
    ELSE 'Feedback'
  END;
  v_emoji := CASE p_category
    WHEN 'bug'      THEN '🐞'
    WHEN 'feature'  THEN '💡'
    WHEN 'question' THEN '❓'
    ELSE '💬'
  END;
  v_subject := v_emoji || ' [Freezely] ' || v_label || ' from ' || COALESCE(v_user_email, 'anonymous');

  -- Combine device fields into one display string for the email body.
  v_device := CASE
    WHEN p_device_model IS NOT NULL AND length(p_device_model) > 0
      THEN p_device_model || ' (' || COALESCE(p_platform, '?') || ' ' || COALESCE(p_platform_version, '?') || ')'
    ELSE COALESCE(p_platform, '?') || ' ' || COALESCE(p_platform_version, '?')
  END;

  -- Build HTML body. Escape user-provided strings to prevent HTML injection.
  v_html := '<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>
  body { margin:0; padding:0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background:#F8FAFC; color:#0F172A; }
  .container { max-width:600px; margin:0 auto; background:#fff; }
  .header { background: linear-gradient(135deg,#14B8A6 0%,#6366F1 100%); color:#fff; padding:32px 28px; }
  .badge { display:inline-block; background:rgba(255,255,255,0.18); padding:4px 10px; border-radius:8px; font-size:12px; font-weight:700; letter-spacing:0.5px; text-transform:uppercase; margin-bottom:8px; }
  .title { font-size:22px; font-weight:700; margin:0; }
  .content { padding:28px; }
  .label { font-size:11px; font-weight:700; letter-spacing:1px; color:#64748B; text-transform:uppercase; margin-bottom:6px; }
  .message { background:#F1F5F9; border-radius:12px; padding:16px 18px; font-size:15px; line-height:1.55; white-space:pre-wrap; word-break:break-word; }
  .meta { margin-top:24px; padding-top:20px; border-top:1px solid #E2E8F0; font-size:13px; color:#64748B; line-height:1.7; }
  .meta b { color:#0F172A; font-weight:600; }
</style></head>
<body>
  <div class="container">
    <div class="header">
      <span class="badge">' || v_label || '</span>
      <h1 class="title">' || v_emoji || ' New ' || lower(v_label) || '</h1>
    </div>
    <div class="content">
      <div class="label">Message</div>
      <div class="message">' ||
        replace(replace(replace(replace(p_message,
          '&', '&amp;'),
          '<', '&lt;'),
          '>', '&gt;'),
          chr(10), '<br/>') ||
      '</div>
      <div class="meta">
        <div><b>From:</b> ' || COALESCE(v_user_email, 'unknown') || '</div>
        <div><b>App version:</b> ' || COALESCE(p_app_version, '?') || '</div>
        <div><b>Device:</b> ' || v_device || '</div>
        <div><b>Language:</b> ' || COALESCE(p_locale, '?') || '</div>
        <div><b>User ID:</b> ' || v_user_id::text || '</div>
        <div><b>Device ID:</b> ' || COALESCE(p_device_id, '?') || '</div>
      </div>
    </div>
  </div>
</body></html>';

  -- Send via Resend API
  PERFORM net.http_post(
    url     := 'https://api.resend.com/emails',
    headers := '{"Authorization": "Bearer re_C9KzNk63_N9p4C1u1HqenDRtTv9Buf34K", "Content-Type": "application/json"}'::jsonb,
    body    := jsonb_build_object(
      'from',     'Freezely <freezely@lastwarac.com>',
      'to',       ARRAY['nicolajdeveloper@gmail.com'],
      'reply_to', v_user_email,
      'subject',  v_subject,
      'html',     v_html
    )
  );

  RETURN json_build_object('success', true);

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION send_feedback_email(text, text, text, text, text, text, text, text) TO authenticated;
