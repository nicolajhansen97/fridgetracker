// Look up a scanned barcode against Open Food Facts — a free, open, food-focused
// product database (no API key needed). Returns a normalized product or null.
//
// Docs: https://world.openfoodfacts.org/api/v2/product/<barcode>.json

import { supabase } from '../config/supabase';

const ENDPOINT = 'https://world.openfoodfacts.org/api/v2/product';

// Map Open Food Facts units onto the units the Add Item form supports
// (pcs, kg, g, lbs, oz, portions). Volume units (l/ml/cl) have no equivalent,
// so we leave quantity/unit unset and let the user pick.
const UNIT_MAP = { g: 'g', kg: 'kg', oz: 'oz', lb: 'lbs', lbs: 'lbs' };

// Resolve an item's quantity, PREFERRING the exact net weight (more reliable
// than guessing piece counts) and only falling back to a piece count when no
// weight is available.
const resolveQuantity = (p) => {
  // 1. Open Food Facts' normalized numeric net quantity (usually grams).
  const pqUnit = (p.product_quantity_unit || 'g').toLowerCase();
  const pq = parseFloat(p.product_quantity);
  if (Number.isFinite(pq) && pq > 0 && UNIT_MAP[pqUnit]) {
    return { quantity: Math.round(pq), unit: UNIT_MAP[pqUnit] };
  }
  // 2. Otherwise parse the free-text quantity.
  return parseQuantityText(p.quantity);
};

const parseQuantityText = (raw) => {
  if (!raw || typeof raw !== 'string') return { quantity: null, unit: null };
  const s = raw.toLowerCase().replace(',', '.');
  // Weight first: "N x M unit" → total weight; or "M unit".
  const multi = s.match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(g|kg|oz|lb|lbs)\b/);
  if (multi) {
    const total = parseFloat(multi[1]) * parseFloat(multi[2]);
    if (total > 0) return { quantity: Math.round(total), unit: UNIT_MAP[multi[3]] };
  }
  const single = s.match(/(\d+(?:\.\d+)?)\s*(g|kg|oz|lb|lbs)\b/);
  if (single) {
    const v = parseFloat(single[1]);
    if (v > 0) return { quantity: Math.round(v), unit: UNIT_MAP[single[2]] };
  }
  // Pieces only when no weight is given (e.g. "3 pieces", "6 stk").
  const pieces = s.match(/(\d+)\s*(?:x|×|pcs|pieces?|pièces?|piezas?|st(?:k|ück)|stuks?|units?|stück)/);
  if (pieces) {
    const n = parseInt(pieces[1], 10);
    if (n > 0) return { quantity: n, unit: 'pcs' };
  }
  return { quantity: null, unit: null };
};

// Returns { name, quantity, unit, brand } or null when nothing usable is found.
export const lookupBarcode = async (code) => {
  if (!code) return null;
  try {
    const url = `${ENDPOINT}/${encodeURIComponent(code)}.json?fields=product_name,product_name_en,generic_name,brands,quantity,product_quantity,product_quantity_unit`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Freezely/1.0 (freezely app)' } });
    if (!res.ok) return null;
    const json = await res.json();
    if (json.status !== 1 || !json.product) return null;

    const p = json.product;
    const brand = (p.brands || '').split(',')[0].trim();
    const name = (p.product_name_en || p.product_name || p.generic_name || brand || '').trim();
    if (!name) return null;

    const { quantity, unit } = resolveQuantity(p);
    return { name, quantity, unit, brand };
  } catch (e) {
    console.warn('[productLookup] failed:', e?.message);
    return null;
  }
};

// Identify a product from a package photo via the analyze-product edge function
// (vision AI). For items not in any barcode database. Returns { name, quantity,
// unit } or null. base64 is a raw JPEG (no data: prefix).
// Returns one of:
//   { ok: true, name, quantity, unit }   — a product was identified
//   { ok: false, unavailable: true }      — couldn't reach/run the service
//   { ok: false, unavailable: false }     — service ran but recognized nothing
export const analyzeProductImage = async (base64, locale) => {
  if (!base64) return { ok: false, unavailable: true };
  try {
    const { data, error } = await supabase.functions.invoke('analyze-product', {
      body: { imageBase64: base64, locale },
    });
    if (error) {
      console.warn('[analyzeProductImage] invoke error:', error.message);
      return { ok: false, unavailable: true };
    }
    const name = (data?.name || '').trim();
    if (!name) return { ok: false, unavailable: false };
    return { ok: true, name, quantity: data?.quantity ?? null, unit: data?.unit ?? null };
  } catch (e) {
    console.warn('[analyzeProductImage] failed:', e?.message);
    return { ok: false, unavailable: true };
  }
};
