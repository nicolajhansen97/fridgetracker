-- Tracks one row per (user, device) so you can see what hardware
-- each user is on and when they last opened the app.
-- Run this in your Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.user_devices (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id         TEXT NOT NULL,           -- client-generated, persisted in AsyncStorage
  platform          TEXT,                    -- 'ios' / 'android' / 'web'
  platform_version  TEXT,                    -- e.g. '17.4' or Android API level
  device_model      TEXT,                    -- 'samsung SM-G998B' on Android, NULL on iOS
  app_version       TEXT,                    -- e.g. '1.0.2'
  locale            TEXT,                    -- e.g. 'en'
  first_seen_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  open_count        INTEGER NOT NULL DEFAULT 1,
  UNIQUE (user_id, device_id)
);

CREATE INDEX IF NOT EXISTS user_devices_user_id_idx     ON public.user_devices (user_id);
CREATE INDEX IF NOT EXISTS user_devices_last_seen_idx   ON public.user_devices (last_seen_at DESC);
CREATE INDEX IF NOT EXISTS user_devices_platform_idx    ON public.user_devices (platform);

-- Row-Level Security: users see only their own rows. Service role / dashboard
-- queries bypass RLS so you can still query everyone from the SQL editor.
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see their own devices" ON public.user_devices;
CREATE POLICY "Users see their own devices"
  ON public.user_devices
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Upsert RPC. SECURITY DEFINER so we can write through RLS in a single call.
-- Drop any prior signature in case args change between revisions.
DROP FUNCTION IF EXISTS public.track_user_session(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.track_user_session(
  p_device_id        TEXT,
  p_platform         TEXT,
  p_platform_version TEXT,
  p_device_model     TEXT,
  p_app_version      TEXT,
  p_locale           TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.user_devices (
    user_id, device_id, platform, platform_version,
    device_model, app_version, locale
  )
  VALUES (
    auth.uid(), p_device_id, p_platform, p_platform_version,
    p_device_model, p_app_version, p_locale
  )
  ON CONFLICT (user_id, device_id) DO UPDATE SET
    platform         = EXCLUDED.platform,
    platform_version = EXCLUDED.platform_version,
    device_model     = COALESCE(EXCLUDED.device_model, public.user_devices.device_model),
    app_version      = EXCLUDED.app_version,
    locale           = EXCLUDED.locale,
    last_seen_at     = NOW(),
    open_count       = public.user_devices.open_count + 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.track_user_session(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- Convenience view: most-recently-active devices, joined with user email.
-- Query from the SQL editor: SELECT * FROM user_devices_overview LIMIT 50;
CREATE OR REPLACE VIEW public.user_devices_overview AS
SELECT
  d.id,
  u.email           AS user_email,
  d.user_id,
  d.device_id,
  d.platform,
  d.platform_version,
  d.device_model,
  d.app_version,
  d.locale,
  d.first_seen_at,
  d.last_seen_at,
  d.open_count
FROM public.user_devices d
JOIN auth.users u ON u.id = d.user_id
ORDER BY d.last_seen_at DESC;
