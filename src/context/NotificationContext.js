import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFridge } from './FridgeContext';
import { usePremium } from './PremiumContext';
import { useLanguage } from '../i18n';
import { useFridgeExpiry } from '../hooks/useFridgeExpiry';
import {
  DEFAULT_PREFS,
  PREFS_KEY,
  MAX_NAMES_IN_BODY,
  applySchedule,
  buildSchedule,
  cancelAll,
  configureNotifications,
  getPermissionStatus,
  requestPermission,
  resolvePrefs,
} from '../utils/notifications';

// Expiry reminders: preferences, permission state, and keeping the scheduled
// notifications in step with the freezer.
//
// Preferences live in AsyncStorage rather than Supabase because the schedule is
// per-device — someone with a phone and a tablet wants to be reminded on one of
// them, and the notifications themselves are local anyway.
//
// The schedule is rebuilt (cancel-all + reschedule) whenever the inventory,
// preferences, language or Pro status change, and again whenever the app comes
// to the foreground so the 7-day horizon rolls forward. Rebuilds are debounced
// because adding a few items in a row would otherwise thrash the scheduler.

const RESCHEDULE_DEBOUNCE_MS = 1200;

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const { items } = useFridge();
  const { isPremium } = usePremium();
  const { getDaysUntilExpiry } = useFridgeExpiry();
  const { t, locale } = useLanguage();

  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [loaded, setLoaded] = useState(false);
  const [permission, setPermission] = useState('undetermined');
  const [scheduledCount, setScheduledCount] = useState(0);

  // Load persisted preferences and set up the handler / Android channel once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await configureNotifications();
      try {
        const raw = await AsyncStorage.getItem(PREFS_KEY);
        if (!cancelled && raw) setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(raw) });
      } catch (e) {
        console.warn('[notifications] prefs load failed:', e?.message);
      }
      const status = await getPermissionStatus();
      if (!cancelled) {
        setPermission(status);
        setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback(async (next) => {
    setPrefs(next);
    try {
      await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(next));
    } catch (e) {
      console.warn('[notifications] prefs save failed:', e?.message);
    }
  }, []);

  const updatePrefs = useCallback(
    (patch) => persist({ ...prefs, ...patch }),
    [persist, prefs]
  );

  // Turning reminders on is the moment to ask for permission — asking at first
  // launch, before the user knows what the app does, is how you get a
  // permanent "no".
  const enable = useCallback(async () => {
    let status = permission;
    if (status !== 'granted') {
      const granted = await requestPermission();
      status = granted ? 'granted' : 'denied';
      setPermission(status);
    }
    if (status !== 'granted') return { success: false, permission: status };
    await persist({ ...prefs, enabled: true });
    return { success: true, permission: status };
  }, [permission, persist, prefs]);

  const disable = useCallback(async () => {
    await persist({ ...prefs, enabled: false });
    await cancelAll();
    setScheduledCount(0);
  }, [persist, prefs]);

  // Turn a planned entry into the text the user actually sees. Kept here rather
  // than in the util so the scheduling maths stays i18n-free.
  const formatEntry = useCallback(
    (entry) => {
      const shown = entry.due.slice(0, MAX_NAMES_IN_BODY).filter(Boolean);
      const hidden = entry.due.length - shown.length;
      const list =
        shown.join(', ') + (hidden > 0 ? ` ${t('notif.andMore', { count: hidden })}` : '');

      if (entry.kind === 'evening') {
        return { kind: entry.kind, date: entry.date, title: t('notif.eveningTitle'), body: list };
      }

      if (entry.kind === 'weekly') {
        // A week with nothing due but something already past would otherwise
        // read "0 items expire this week".
        if (!entry.weekCount && entry.overdue) {
          return {
            kind: entry.kind,
            date: entry.date,
            title: t('notif.overdueTitle', { count: entry.overdue }),
            body: t('notif.overdueBody'),
          };
        }
        const body = entry.overdue
          ? `${list} · ${t('notif.overdueLine', { count: entry.overdue })}`
          : list;
        return {
          kind: entry.kind,
          date: entry.date,
          title: t('notif.weeklyTitle', { count: entry.weekCount }),
          body,
        };
      }

      // Digest. When nothing is due but something has recently gone past its
      // date, lead with that instead of an empty "0 items to use" headline.
      if (!entry.due.length && entry.overdue) {
        return {
          kind: entry.kind,
          date: entry.date,
          title: t('notif.overdueTitle', { count: entry.overdue }),
          body: t('notif.overdueBody'),
        };
      }
      const body = entry.overdue
        ? `${list} · ${t('notif.overdueLine', { count: entry.overdue })}`
        : list;
      return {
        kind: entry.kind,
        date: entry.date,
        title: t('notif.digestTitle', { count: entry.due.length }),
        body,
      };
    },
    [t]
  );

  const reschedule = useCallback(async () => {
    const resolved = resolvePrefs(prefs, isPremium);
    if (!resolved.enabled || permission !== 'granted') {
      await cancelAll();
      setScheduledCount(0);
      return 0;
    }
    const plan = buildSchedule({
      items,
      daysUntil: getDaysUntilExpiry,
      prefs,
      isPremium,
    });
    const n = await applySchedule(plan.map(formatEntry));
    setScheduledCount(n);
    return n;
  }, [prefs, isPremium, permission, items, getDaysUntilExpiry, formatEntry]);

  // Debounced: `reschedule` changes identity whenever items or prefs do, so a
  // burst of edits collapses into one rebuild.
  const rescheduleRef = useRef(reschedule);
  useEffect(() => {
    rescheduleRef.current = reschedule;
  }, [reschedule]);

  useEffect(() => {
    if (!loaded) return undefined;
    const id = setTimeout(() => {
      rescheduleRef.current();
    }, RESCHEDULE_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [loaded, reschedule, locale]);

  // Rolling the horizon forward on foreground is what keeps a user who opens
  // the app daily permanently covered.
  useEffect(() => {
    if (!loaded) return undefined;
    const sub = AppState.addEventListener('change', async (state) => {
      if (state !== 'active') return;
      const status = await getPermissionStatus();
      setPermission((prev) => (prev === status ? prev : status));
      rescheduleRef.current();
    });
    return () => sub.remove();
  }, [loaded]);

  const resolved = useMemo(() => resolvePrefs(prefs, isPremium), [prefs, isPremium]);

  const value = useMemo(
    () => ({
      prefs,
      resolved, // what will actually fire, after the Pro gate
      loaded,
      permission,
      scheduledCount,
      enable,
      disable,
      updatePrefs,
      reschedule,
    }),
    [prefs, resolved, loaded, permission, scheduledCount, enable, disable, updatePrefs, reschedule]
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
};

export const useNotifications = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return ctx;
};
