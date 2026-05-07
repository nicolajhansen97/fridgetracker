import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DEVICE_ID_KEY = 'freezely_device_id';

let cachedDeviceId = null;

// Generate (or load) a stable per-install identifier. Lives in AsyncStorage,
// so it persists across app launches but resets if the user clears app data.
export const getDeviceId = async () => {
  if (cachedDeviceId) return cachedDeviceId;
  try {
    let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      const ts = Date.now().toString(36);
      const rnd = Math.random().toString(36).slice(2, 10);
      id = `dev_${ts}_${rnd}`;
      await AsyncStorage.setItem(DEVICE_ID_KEY, id);
    }
    cachedDeviceId = id;
    return id;
  } catch {
    return 'unknown';
  }
};

// Best-effort device model string. Android exposes Brand+Model via Platform.constants;
// iOS doesn't expose the model name without a native module, so it stays null.
export const getDeviceModel = () => {
  if (Platform.OS === 'android') {
    const c = Platform.constants || {};
    const parts = [c.Manufacturer, c.Model].filter(Boolean);
    return parts.length ? parts.join(' ') : null;
  }
  return null;
};

export const getPlatformVersion = () => String(Platform.Version);
