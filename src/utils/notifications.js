import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

// Local expiry reminders.
//
// Everything is scheduled on-device: no push tokens, no server, works offline.
// The catch is that a local notification's text is baked in when it's
// scheduled, so we can't just register one repeating "daily digest" — the body
// has to name the items actually due that morning. Instead we plan the next
// HORIZON_DAYS individually and re-plan whenever the inventory, the preferences
// or the language change. Re-planning is cancel-all + reschedule: cheap (at
// most ~21 pending notifications, well under the iOS cap of 64) and it saves us
// having to diff two schedules.
//
// The horizon means someone who doesn't open the app for a week still gets
// reminded; beyond that the schedule goes quiet until they come back. That's a
// deliberate trade — the alternative is repeating notifications whose text
// can't reflect what's actually in the freezer.
//
// This module stays free of i18n on purpose: buildSchedule returns structured
// entries and the caller formats them, which keeps the date maths testable and
// the translations in one place.

export const HORIZON_DAYS = 7;
export const FREE_LEAD_DAYS = 3;
export const MIN_LEAD_DAYS = 1;
export const MAX_LEAD_DAYS = 14;
export const CHANNEL_ID = 'expiry';

// How many item names fit in a notification body before it gets truncated to
// "+N more". Three is about what a lock screen shows without eliding.
export const MAX_NAMES_IN_BODY = 3;

// Stop nagging about things the user has clearly decided to keep. Without this
// a single forgotten bag of peas produces a reminder every morning forever,
// which is how notification permission gets revoked.
export const OVERDUE_GRACE_DAYS = 14;

export const PREFS_KEY = 'freezely_notification_prefs';

export const DEFAULT_PREFS = {
  enabled: false,
  dailyTime: '09:00', // HH:mm, device-local
  leadDays: FREE_LEAD_DAYS,
  eveningNudge: false, // Pro
  eveningTime: '18:00',
  weeklySummary: false, // Pro
  weeklyDay: 0, // 0 = Sunday, matches Date#getDay()
  weeklyTime: '10:00',
};

// Free accounts get the morning digest at a fixed 3-day lead. The tunable lead,
// the evening nudge and the weekly summary are Pro. Resolving in one place
// keeps the settings UI and the scheduler from ever disagreeing — in
// particular, a lapsed subscriber silently stops receiving the Pro ones
// without their stored preferences being destroyed.
export const resolvePrefs = (prefs, isPremium) => {
  const p = { ...DEFAULT_PREFS, ...(prefs || {}) };
  const leadDays = Math.min(MAX_LEAD_DAYS, Math.max(MIN_LEAD_DAYS, Number(p.leadDays) || FREE_LEAD_DAYS));
  if (isPremium) return { ...p, leadDays };
  return { ...p, leadDays: FREE_LEAD_DAYS, eveningNudge: false, weeklySummary: false };
};

const parseTime = (hhmm) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ''));
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return { h, min };
};

export const formatTime = (hhmm) => {
  const t = parseTime(hhmm) || parseTime(DEFAULT_PREFS.dailyTime);
  return `${String(t.h).padStart(2, '0')}:${String(t.min).padStart(2, '0')}`;
};

export const timeToDate = (hhmm) => {
  const t = parseTime(hhmm) || parseTime(DEFAULT_PREFS.dailyTime);
  const d = new Date();
  d.setHours(t.h, t.min, 0, 0);
  return d;
};

export const dateToTime = (date) =>
  `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

// Local wall-clock time on `dayOffset` days from now. Going through setDate and
// then setHours lets the Date normalise across a DST boundary, so "09:00" stays
// 09:00 to the user rather than drifting an hour twice a year.
const atTime = (now, dayOffset, hhmm) => {
  const t = parseTime(hhmm) || parseTime(DEFAULT_PREFS.dailyTime);
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(t.h, t.min, 0, 0);
  return d;
};

// Plan the notifications for the next HORIZON_DAYS.
//
//   items      — raw fridge items
//   daysUntil  — (item) => number|null, already bound to the user's overrides
//                (pass useFridgeExpiry().getDaysUntilExpiry)
//   now        — injectable for tests
//
// Returns [{ kind, date, due: [name], overdue: n, weekCount: n }], unformatted.
export const buildSchedule = ({ items, daysUntil, prefs, isPremium, now = new Date() }) => {
  const p = resolvePrefs(prefs, isPremium);
  if (!p.enabled) return [];

  // Days-to-expiry is computed once relative to today; on a future day `d` the
  // remaining days are simply (days - d). Items with no expiry tracking at all
  // are not our business.
  const tracked = [];
  for (const item of items || []) {
    const days = daysUntil(item);
    if (days === null || days === undefined || Number.isNaN(days)) continue;
    tracked.push({ name: item?.name || '', days });
  }
  if (!tracked.length) return [];

  const plan = [];

  for (let d = 0; d < HORIZON_DAYS; d++) {
    const remaining = (i) => i.days - d;

    // Morning digest — what needs using, plus a nudge about anything recently
    // gone past its date.
    const digestAt = atTime(now, d, p.dailyTime);
    if (digestAt > now) {
      const due = tracked.filter((i) => remaining(i) >= 0 && remaining(i) <= p.leadDays);
      const overdue = tracked.filter(
        (i) => remaining(i) < 0 && remaining(i) >= -OVERDUE_GRACE_DAYS
      );
      if (due.length || overdue.length) {
        plan.push({
          kind: 'digest',
          date: digestAt,
          due: due.sort((a, b) => a.days - b.days).map((i) => i.name),
          overdue: overdue.length,
        });
      }
    }

    // Evening nudge (Pro) — only fires when something actually runs out today
    // or tomorrow, so it stays rare enough to be worth reading.
    if (p.eveningNudge) {
      const eveningAt = atTime(now, d, p.eveningTime);
      if (eveningAt > now) {
        const tonight = tracked.filter((i) => remaining(i) >= 0 && remaining(i) <= 1);
        if (tonight.length) {
          plan.push({
            kind: 'evening',
            date: eveningAt,
            due: tonight.sort((a, b) => a.days - b.days).map((i) => i.name),
            overdue: 0,
          });
        }
      }
    }

    // Weekly summary (Pro) — the week ahead, for planning rather than rescue.
    if (p.weeklySummary) {
      const weeklyAt = atTime(now, d, p.weeklyTime);
      if (weeklyAt > now && weeklyAt.getDay() === Number(p.weeklyDay)) {
        const week = tracked.filter((i) => remaining(i) >= 0 && remaining(i) <= 7);
        const overdue = tracked.filter(
          (i) => remaining(i) < 0 && remaining(i) >= -OVERDUE_GRACE_DAYS
        );
        if (week.length || overdue.length) {
          plan.push({
            kind: 'weekly',
            date: weeklyAt,
            due: week.sort((a, b) => a.days - b.days).map((i) => i.name),
            overdue: overdue.length,
            weekCount: week.length,
          });
        }
      }
    }
  }

  return plan.sort((a, b) => a.date - b.date);
};

// expo-notifications moved to a typed trigger enum; tolerate both shapes so an
// SDK bump doesn't silently stop scheduling.
const dateTrigger = (date) => {
  const types = Notifications.SchedulableTriggerInputTypes;
  return types?.DATE
    ? { type: types.DATE, date, channelId: CHANNEL_ID }
    : { date, channelId: CHANNEL_ID };
};

export const configureNotifications = async () => {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldShowAlert: true, // pre-SDK-53 key, harmless on newer versions
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Expiry reminders',
        importance: Notifications.AndroidImportance?.DEFAULT ?? 3,
        lightColor: '#14B8A6',
      });
    } catch (e) {
      console.warn('[notifications] channel setup failed:', e?.message);
    }
  }
};

export const getPermissionStatus = async () => {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status;
  } catch (e) {
    console.warn('[notifications] permission check failed:', e?.message);
    return 'undetermined';
  }
};

export const requestPermission = async () => {
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch (e) {
    console.warn('[notifications] permission request failed:', e?.message);
    return false;
  }
};

// Replace the pending schedule wholesale. `entries` are already formatted:
// [{ date, title, body, kind }].
export const applySchedule = async (entries) => {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (e) {
    console.warn('[notifications] cancel failed:', e?.message);
    return 0;
  }
  let scheduled = 0;
  for (const entry of entries) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: entry.title,
          body: entry.body,
          sound: false,
          data: { kind: entry.kind },
        },
        trigger: dateTrigger(entry.date),
      });
      scheduled++;
    } catch (e) {
      console.warn('[notifications] schedule failed:', e?.message);
    }
  }
  return scheduled;
};

// Fire one notification a few seconds out so the user can confirm reminders
// really arrive on this device. Worth having: "I enabled it and nothing
// happened" is otherwise impossible to tell apart from "nothing was due".
export const sendTestNotification = async ({ title, body }) => {
  const types = Notifications.SchedulableTriggerInputTypes;
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: false, data: { kind: 'test' } },
      trigger: types?.TIME_INTERVAL
        ? { type: types.TIME_INTERVAL, seconds: 3, channelId: CHANNEL_ID }
        : { seconds: 3, channelId: CHANNEL_ID },
    });
    return true;
  } catch (e) {
    console.warn('[notifications] test send failed:', e?.message);
    return false;
  }
};

export const cancelAll = async () => {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (e) {
    console.warn('[notifications] cancel failed:', e?.message);
  }
};
