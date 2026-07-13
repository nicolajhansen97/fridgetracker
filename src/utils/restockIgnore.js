import AsyncStorage from '@react-native-async-storage/async-storage';

// Item names (normalised keys) the user has chosen to stop seeing as restock
// suggestions ("I don't plan to buy this again"). Stored on-device; personal to
// this phone rather than shared with the household.
const KEY = 'freezely_restock_ignored_v1';

export async function loadIgnored() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export async function saveIgnored(list) {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(list));
  } catch {}
}
