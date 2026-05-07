import { useEffect, useRef } from 'react';
import { Platform, AppState } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n';
import { supabase } from '../config/supabase';
import { CURRENT_VERSION } from '../changelog';
import { getDeviceId, getDeviceModel, getPlatformVersion } from '../utils/deviceInfo';

const APP_VERSION = CURRENT_VERSION;

// Don't re-track on every render — at most once every few minutes per session.
const MIN_TRACK_INTERVAL_MS = 5 * 60 * 1000;

const trackSession = async (locale) => {
  try {
    const deviceId = await getDeviceId();
    await supabase.rpc('track_user_session', {
      p_device_id: deviceId,
      p_platform: Platform.OS,
      p_platform_version: getPlatformVersion(),
      p_device_model: getDeviceModel(),
      p_app_version: APP_VERSION,
      p_locale: locale || null,
    });
  } catch (e) {
    // Soft-fail: tracking is opportunistic.
    console.log('Session track failed:', e?.message || e);
  }
};

const SessionTracker = () => {
  const { user } = useAuth();
  const { locale } = useLanguage();
  const lastTrackedRef = useRef(0);

  // Track on auth/locale change, and again whenever the app comes back to the foreground.
  useEffect(() => {
    if (!user?.id) return;

    const maybeTrack = () => {
      const now = Date.now();
      if (now - lastTrackedRef.current < MIN_TRACK_INTERVAL_MS) return;
      lastTrackedRef.current = now;
      trackSession(locale);
    };

    maybeTrack();

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') maybeTrack();
    });
    return () => sub.remove();
  }, [user?.id, locale]);

  return null;
};

export default SessionTracker;
