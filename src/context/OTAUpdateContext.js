import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import * as Updates from 'expo-updates';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Auto-prompt only once per hour after a "Later" dismissal. Manual checks
// (from Profile) ignore this cooldown.
const DISMISS_COOLDOWN_MS = 60 * 60 * 1000;
const DISMISS_KEY = 'freezely_ota_dismissed_until';

const OTAUpdateContext = createContext(null);

export const OTAUpdateProvider = ({ children }) => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [checking, setChecking] = useState(false);
  const cancelledRef = useRef(false);

  // Internal: returns { isAvailable, suppressed?, error? }
  const runCheck = async ({ skipCooldown }) => {
    if (!Updates.isEnabled) return { isAvailable: false };

    if (!skipCooldown) {
      const dismissedUntil = await AsyncStorage.getItem(DISMISS_KEY);
      if (dismissedUntil && Date.now() < parseInt(dismissedUntil, 10)) {
        return { isAvailable: false, suppressed: true };
      }
    }

    const result = await Updates.checkForUpdateAsync();
    if (!result.isAvailable) return { isAvailable: false };

    await Updates.fetchUpdateAsync();
    if (!cancelledRef.current) setUpdateAvailable(true);
    return { isAvailable: true };
  };

  // Auto-check on mount.
  useEffect(() => {
    cancelledRef.current = false;
    runCheck({ skipCooldown: false }).catch((e) => {
      console.log('OTA auto-check failed:', e?.message || e);
    });
    return () => { cancelledRef.current = true; };
  }, []);

  // Manual check (called from Settings/Profile). Returns the result so the
  // caller can show a "you're up to date" alert when nothing's there.
  const checkManually = async () => {
    if (!Updates.isEnabled) return { isAvailable: false, disabled: true };
    setChecking(true);
    try {
      // Manual check ignores the dismissal cooldown.
      return await runCheck({ skipCooldown: true });
    } catch (e) {
      console.log('OTA manual check failed:', e?.message || e);
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
    try {
      await AsyncStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_COOLDOWN_MS));
    } catch {}
    setUpdateAvailable(false);
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
