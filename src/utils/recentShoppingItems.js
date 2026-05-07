import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'freezely_shopping_recents_v1';
const MAX_ENTRIES = 40;

// Each entry: { name: string, quantity: string, count: number, lastUsed: number }

export async function loadRecents() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function recordAdd(name, quantity) {
  if (!name) return;
  const trimmedName = name.trim();
  const trimmedQty = (quantity || '').trim();
  if (!trimmedName) return;
  try {
    const list = await loadRecents();
    const idx = list.findIndex(
      (e) => e.name.toLowerCase() === trimmedName.toLowerCase()
    );
    let next;
    if (idx >= 0) {
      const existing = list[idx];
      next = [
        { ...existing, quantity: trimmedQty || existing.quantity, count: (existing.count || 1) + 1, lastUsed: Date.now() },
        ...list.slice(0, idx),
        ...list.slice(idx + 1),
      ];
    } else {
      next = [{ name: trimmedName, quantity: trimmedQty, count: 1, lastUsed: Date.now() }, ...list];
    }
    if (next.length > MAX_ENTRIES) next = next.slice(0, MAX_ENTRIES);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
    return next;
  } catch {
    return null;
  }
}

// Suggest items based on a query. If query empty, returns top N most-used recents.
export function suggest(recents, query, limit = 8) {
  if (!Array.isArray(recents) || recents.length === 0) return [];
  if (!query || !query.trim()) {
    return [...recents]
      .sort((a, b) => (b.count || 0) - (a.count || 0) || (b.lastUsed || 0) - (a.lastUsed || 0))
      .slice(0, limit);
  }
  const q = query.trim().toLowerCase();
  return recents
    .filter((e) => e.name.toLowerCase().includes(q))
    .sort((a, b) => {
      const aStarts = a.name.toLowerCase().startsWith(q) ? 0 : 1;
      const bStarts = b.name.toLowerCase().startsWith(q) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      return (b.count || 0) - (a.count || 0);
    })
    .slice(0, limit);
}
