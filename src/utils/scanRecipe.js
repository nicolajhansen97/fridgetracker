import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from '../config/supabase';

// Helpers for scanned recipes (Pro): photo → scan-recipe edge function →
// recipe, plus the live "what do I already have" check used every time a
// scanned recipe is opened.

export const MAX_SCAN_PAGES = 3; // Groq's vision model takes at most 3 images

const FRACTIONS = [
  [0.125, '⅛'], [0.25, '¼'], [1 / 3, '⅓'], [0.5, '½'], [2 / 3, '⅔'], [0.75, '¾'],
];

// 0.5 → "½", 1.5 → "1 ½", 250 → "250".
export const formatQty = (qty) => {
  if (!qty && qty !== 0) return '';
  const whole = Math.floor(qty);
  const rest = qty - whole;
  // Large amounts (grams, ml) read better as plain numbers.
  if (rest < 0.02 || qty >= 20) return String(Math.round(qty * 10) / 10);
  const near = FRACTIONS.find(([v]) => Math.abs(rest - v) < 0.02);
  if (!near) return String(Math.round(qty * 100) / 100);
  return whole > 0 ? `${whole} ${near[1]}` : near[1];
};

const UNICODE_FRACTIONS = { '¼': 0.25, '½': 0.5, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 0.125 };

// What people type as an amount: "2", "2,5", "1/2", "1 ½", "2-3" (low end).
// Same rules as the scan-recipe edge function. null when it isn't a number.
export const parseAmount = (v) => {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? v : null;
  let s = String(v).trim().replace(',', '.').replace(/\s*[-–]\s*[\d.]+.*$/, '');
  let total = 0;
  for (const [ch, val] of Object.entries(UNICODE_FRACTIONS)) {
    if (s.includes(ch)) {
      total += val;
      s = s.replace(ch, ' ').trim();
    }
  }
  const mixed = s.match(/^(\d+)\s+(\d+)\/(\d+)/);
  const frac = s.match(/^(\d+)\/(\d+)/);
  if (mixed) total += Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  else if (frac) total += Number(frac[1]) / Number(frac[2]);
  else if (s) {
    const n = parseFloat(s);
    if (Number.isFinite(n)) total += n;
  }
  return total > 0 && Number.isFinite(total) ? Math.round(total * 1000) / 1000 : null;
};

// "2 dl", "½ tsp", "3" — or '' when the recipe gives no amount.
export const formatAmount = (amount, unit, factor = 1) => {
  if (!amount) return unit || '';
  return `${formatQty(amount * factor)} ${unit || ''}`.trim();
};

// Text on a cookbook page needs more pixels than a product label: 1600px
// wide keeps small print legible while staying well under the request limit.
export const prepareScanImage = async (uri) => {
  const out = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1600 } }],
    { compress: 0.6, base64: true, format: ImageManipulator.SaveFormat.JPEG }
  );
  return out.base64;
};

// Returns { ok: true, recipe } | { ok: false, reason: 'notFound' | 'limit' | 'failed', limit }
export const scanRecipeImages = async (base64Images, { locale, inventory }) => {
  try {
    const { data, error } = await supabase.functions.invoke('scan-recipe', {
      body: { images: base64Images, locale, inventory },
    });
    if (error) {
      let body = null;
      try {
        const text = await error.context?.text?.();
        body = text ? JSON.parse(text) : null;
      } catch {}
      if (body?.error === 'DAILY_LIMIT_REACHED') {
        return { ok: false, reason: 'limit', limit: body.limit };
      }
      console.warn('[scan-recipe] invoke error:', body?.detail || body?.error || error.message);
      return { ok: false, reason: 'failed' };
    }
    if (!data?.found || !data?.recipe) return { ok: false, reason: 'notFound' };
    const recipe = {
      ...data.recipe,
      source: 'scan',
      // Marks the recipe as scanned even if the `source` column doesn't
      // exist yet (ADD_SCANNED_RECIPES.sql not run); see SavedRecipesContext.
      ingredients: (data.recipe.ingredients || []).map((ing) => ({ ...ing, scanned: true })),
    };
    return { ok: true, recipe };
  } catch (e) {
    console.warn('[scan-recipe] failed:', e?.message);
    return { ok: false, reason: 'failed' };
  }
};

// ---------- live inventory matching ----------

// "Hakket kød 8-12%" → "hakket kød"; "Æg (M)" → "æg".
const normName = (s) =>
  String(s || '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[\d.,]+\s*(?:-\s*[\d.,]+)?\s*%?/g, ' ')
    .replace(/[.,;:!?'"’“”()*/+&]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// Does `needle` appear in `hay` as whole words? "oksekød" is in "hakket
// oksekød", but "peber" is not in "peberfrugt" and "is" is not in "ris".
const containsWords = (hay, needle) => {
  if (!needle || needle.length < 3) return hay === needle && !!hay;
  const i = ` ${hay} `.indexOf(` ${needle} `);
  return i !== -1;
};

const namesMatch = (ingredientName, itemName) => {
  const a = normName(ingredientName);
  const b = normName(itemName);
  if (!a || !b) return false;
  if (a === b) return true;
  return containsWords(a, b) || containsWords(b, a);
};

// For each ingredient: is it at home right now, and is it already on the
// shopping list? The item the AI matched at scan time wins while it's still
// in stock; otherwise fall back to a whole-word name match so things bought
// after the scan are picked up too.
//
// Returns ingredients with { haveItem: string|null, inFridge, onList }.
export const matchRecipeToInventory = (ingredients = [], items = [], shoppingItems = []) => {
  const byLower = new Map();
  items.forEach((it) => {
    if (it?.name) byLower.set(it.name.toLowerCase(), it.name);
  });
  const openShopping = shoppingItems.filter((s) => !s.checked && s.name);

  return ingredients.map((ing) => {
    let haveItem = null;
    if (ing.fridgeItem && byLower.has(ing.fridgeItem.toLowerCase())) {
      haveItem = byLower.get(ing.fridgeItem.toLowerCase());
    } else {
      for (const name of byLower.values()) {
        if (namesMatch(ing.name, name)) { haveItem = name; break; }
      }
    }
    const onList = !haveItem && openShopping.some((s) => namesMatch(ing.name, s.name));
    return { ...ing, haveItem, inFridge: !!haveItem, onList };
  });
};

// Same counting rule as AI recipes: staples don't count as missing.
export const matchStats = (matched = []) => {
  const counted = matched.filter((i) => !i.pantry || i.inFridge);
  const have = counted.filter((i) => i.inFridge).length;
  return { matched: have, total: counted.length, missing: counted.length - have };
};
