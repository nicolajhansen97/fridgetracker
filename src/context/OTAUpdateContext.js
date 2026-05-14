import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import * as Updates from 'expo-updates';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Auto-prompt only once per hour after a "Later" dismissal. Manual checks
// (from Profile) ignore this cooldown.
const DISMISS_COOLDOWN_MS = 60 * 60 * 1000;
const DISMISS_KEY = 'freezely_ota_dismissed_until';

// In Expo Go, Updates.* throw "not accessible in Expo Go" — Updates.isEnabled
// doesn't reliably guard against this, so use appOwnership as the source of
// truth. 'expo' = running inside Expo Go; null/'standalone' = real build.
const IS_EXPO_GO = Constants.appOwnership === 'expo';

const OTAUpdateContext = createContext(null);

// Best-effort check + fetch. Idempotent — safe to call repeatedly. Native
// expo-updates dedupes downloads internally so calling fetchUpdateAsync on
// an already-downloaded bundle is a no-op.
const runCheck = async () => {
  if (IS_EXPO_GO) return;
  if (!Updates.isEnabled) return;
  try {
    const result = await Updates.checkForUpdateAsync();
    if (result?.isAvailable) {
      await Updates.fetchUpdateAsync();
    }
  } catch (e) {
    console.log('OTA check failed:', e?.message || e);
  }
};

export const OTAUpdateProvider = ({ children }) => {
  // expo-updates' reactive hook. Surfaces native module state regardless of
  // whether the native auto-check or our own check triggered it. This is the
  // critical piece — without it, my own checkForUpdateAsync would report
  // "no update" once native auto-fetch finished, and the modal would never
  // show during the current session.
  const updatesState = Updates.useUpdates();

  const [reloading, setReloading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [dismissedThisSession, setDismissedThisSession] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  // Latch: once we've seen an update signal this session we keep the modal up
  // until the user dismisses or applies it. Without this, the modal flickers
  // off and back on as expo-updates transitions
  // isUpdateAvailable=true → both false (briefly) → isUpdatePending=true,
  // which the user perceives as the prompt appearing twice for one update.
  const [updateSeen, setUpdateSeen] = useState(false);

  // Load the persisted dismissal cooldown on mount.
  useEffect(() => {
    AsyncStorage.getItem(DISMISS_KEY)
      .then((val) => {
        if (val) {
          const ts = parseInt(val, 10);
          if (!Number.isNaN(ts) && ts > Date.now()) setCooldownUntil(ts);
        }
      })
      .catch(() => {});
  }, []);

  // Check exactly once per cold start. We used to also re-check on
  // background→foreground via AppState, but the user found that too noisy,
  // so resuming the app from background no longer triggers a re-check —
  // the next cold start will pick up any new OTA.
  useEffect(() => {
    if (IS_EXPO_GO) return;
    if (!Updates.isEnabled) return;
    runCheck();
  }, []);

  // Latch any update signal from useUpdates().
  useEffect(() => {
    if (updatesState?.isUpdateAvailable || updatesState?.isUpdatePending) {
      setUpdateSeen(true);
    }
  }, [updatesState?.isUpdateAvailable, updatesState?.isUpdatePending]);

  // Modal shows when EITHER:
  //   - a new bundle is on the server but not yet fetched (isUpdateAvailable)
  //   - a new bundle has been fetched and is pending (isUpdatePending)
  // …AND the user hasn't dismissed it this session, AND we're not in a
  // post-dismissal cooldown.
  const updateAvailable = useMemo(() => {
    if (IS_EXPO_GO) return false;
    if (!Updates.isEnabled) return false;
    if (dismissedThisSession) return false;
    if (cooldownUntil && Date.now() < cooldownUntil) return false;
    return updateSeen;
  }, [updateSeen, dismissedThisSession, cooldownUntil]);

  // Manual check (from Profile). Ignores cooldown and session-dismissal so
  // the user can always force a check.
  const checkManually = async () => {
    if (IS_EXPO_GO) return { isAvailable: false, disabled: true };
    if (!Updates.isEnabled) return { isAvailable: false, disabled: true };
    setChecking(true);
    setDismissedThisSession(false);
    setCooldownUntil(0);
    setUpdateSeen(false);
    try {
      const result = await Updates.checkForUpdateAsync();
      if (result?.isAvailable) {
        await Updates.fetchUpdateAsync();
        setUpdateSeen(true);
        return { isAvailable: true };
      }
      // Could already be fetched and pending.
      if (updatesState?.isUpdatePending) {
        setUpdateSeen(true);
        return { isAvailable: true };
      }
      return { isAvailable: false };
    } catch (e) {
      return { isAvailable: false, error: e?.message || String(e) };
    } finally {
      setChecking(false);
    }
  };

  const updateNow = async () => {
    setReloading(true);
    try {
      await Updates.reloadAsync();
    } catch (e) {
      console.error('OTA reload failed:', e);
      setReloading(false);
    }
  };

  const dismiss = async () => {
    const until = Date.now() + DISMISS_COOLDOWN_MS;
    try {
      await AsyncStorage.setItem(DISMISS_KEY, String(until));
    } catch {}
    setCooldownUntil(until);
    setDismissedThisSession(true);
    setUpdateSeen(false);
  };

  return (
    <OTAUpdateContext.Provider
      value={{
        updateAvailable,
        reloading,
        checking,
        checkManually,
        updateNow,
        dismiss,
      }}
    >
      {children}
    </OTAUpdateContext.Provider>
  );
};

export const useOTAUpdate = () => {
  const ctx = useContext(OTAUpdateContext);
  if (!ctx) {
    throw new Error('useOTAUpdate must be used within an OTAUpdateProvider');
  }
  return ctx;
};
