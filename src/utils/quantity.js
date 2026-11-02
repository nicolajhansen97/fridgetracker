// Item amounts can be fractional (4.5 lbs, 1.25 kg); fridge_items.quantity is
// NUMERIC(10,2). Accepts a decimal comma, which most European keyboards type.
// Returns null for empty, zero or unreadable input so callers can pick a default.
export const parseQuantity = (value) => {
  const n = parseFloat(String(value ?? '').trim().replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
};
