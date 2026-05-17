// How long food stays safely usable in a home freezer (-18 C / 0 F), by
// category. Numbers are a conservative consensus of USDA FoodSafety.gov and
// the UK Food Standards Agency. Freezing pauses bacterial growth, so the
// printed "best before" date on the package is essentially irrelevant once
// the item is frozen — what matters is texture/flavor loss over time.
//
// Every function here accepts an optional `overrides` map (keyed by category
// or sub-bucket label) so users can tune defaults to their local food
// agency's guidance. The overrides live in FreezerSettingsContext, persisted
// to the user_freezer_settings table; this module stays pure.
import { getCategory } from './foodCategories';

export const FREEZER_MONTHS = {
  meat: 6,        // raw beef/pork/chicken pieces; USDA: 4-12mo, 6 is the safe middle
  fish: 3,        // fatty fish 2-3mo, lean fish 6-8mo; 3 covers the common case
  dairy: 3,       // milk 3mo, cream 2mo, hard cheese 6mo; eggs out-of-shell 12mo
  fruit: 10,      // berries, sliced fruit; FSA: 8-12mo
  vegetables: 10, // blanched veg; FSA: 8-12mo
  bread: 3,       // loaves, rolls; texture degrades after 3mo
  frozen: 3,      // already-frozen prepared meals; eat sooner for best quality
  pantry: 6,      // nuts, butter, flour, etc. when frozen; varies wildly
  drinks: 4,      // mostly not frozen — fallback for the few that are
  other: 6,       // unknown items: 6mo matches the most common buckets
};

const MS_PER_DAY = 86400000;

const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

// Specific overrides that beat the category default. Things like "ground
// beef" sit inside the meat category but only last 3 months frozen, not the
// 6mo whole-cut default. Sub-buckets are checked first; the longest
// matching keyword wins so "ground beef" beats "beef".
//
// Sources: USDA FoodSafety.gov, UK Food Standards Agency.
//
// labelKey points at the matching i18n string in `freezerLabel.*`.
const OVERRIDES = [
  {
    months: 1,
    labelKey: 'bacon',
    // Cured fats turn rancid fast even frozen.
    keywords: ['bacon', 'speck', 'leverpostej', 'pâté', 'paté'],
  },
  {
    months: 2,
    labelKey: 'sausage',
    keywords: [
      'sausage', 'hot dog', 'frankfurter',
      'pølse', 'medister', 'spegepølse',
      'wurst', 'bratwurst', 'bockwurst',
      'saucisse', 'salchicha', 'chorizo',
    ],
  },
  {
    months: 3,
    labelKey: 'groundMeat',
    keywords: [
      'ground beef', 'ground chicken', 'ground turkey', 'ground pork',
      'minced', 'mince ',
      'hakket', 'hakkebøf', 'frikadeller', 'kødboller', 'hakkekød',
      'hackfleisch', 'fleischbällchen', 'mett',
      'viande hachée', 'viande hachee', 'boulettes',
      'carne molida', 'carne picada', 'albóndigas',
    ],
  },
  {
    months: 6,
    labelKey: 'leanFish',
    // Lean white fish keeps about twice as long as fatty fish like salmon.
    keywords: [
      'cod', 'haddock', 'pollock', 'sole', 'plaice',
      'torsk', 'sej', 'rødspætte', 'kuller', 'hvilling',
      'kabeljau', 'seelachs', 'scholle', 'schellfisch',
      'cabillaud', 'morue', 'colin', 'lieu',
      'bacalao', 'merluza', 'abadejo',
    ],
  },
  {
    months: 6,
    labelKey: 'hardCheese',
    keywords: [
      'parmesan', 'cheddar', 'gruyère', 'gruyere', 'gouda', 'manchego',
      'hard cheese', 'aged cheese',
      'hård ost', 'lagret ost',
      'hartkäse',
      'fromage à pâte dure', 'fromage a pate dure',
      'queso duro', 'queso curado',
    ],
  },
  {
    months: 9,
    labelKey: 'butter',
    keywords: ['butter', 'smør', 'beurre', 'mantequilla'],
  },
];

// Flat map of sub-bucket defaults. Exposed so the settings screen can render
// "default: N months" hints next to each editable row.
export const OVERRIDE_DEFAULTS = Object.fromEntries(
  OVERRIDES.map((ov) => [ov.labelKey, ov.months])
);

// Settings-screen layout helpers: every editable knob, in display order.
// `isCategory` tells the screen which i18n namespace to translate from
// (shopping.cat_* for top-level categories; freezerLabel.* for sub-buckets).
export const EDITABLE_SUB_BUCKETS = OVERRIDES.map((ov) => ({
  key: ov.labelKey,
  defaultMonths: ov.months,
  isCategory: false,
}));

export const EDITABLE_CATEGORIES = Object.entries(FREEZER_MONTHS).map(
  ([cat, months]) => ({ key: cat, defaultMonths: months, isCategory: true })
);

// Sanitize a user-provided override value. Returns null when the value is
// invalid (non-number, ≤0, > 60), in which case the default is used.
const validOverride = (v) => {
  const n = typeof v === 'number' ? v : parseInt(v, 10);
  return Number.isFinite(n) && n > 0 && n <= 60 ? n : null;
};

const monthsForCategory = (category, overrides) => {
  const userValue = overrides ? validOverride(overrides[category]) : null;
  if (userValue !== null) return userValue;
  return FREEZER_MONTHS[category] ?? FREEZER_MONTHS.other;
};

const monthsForSubBucket = (subBucket, overrides) => {
  const userValue = overrides ? validOverride(overrides[subBucket.labelKey]) : null;
  if (userValue !== null) return userValue;
  return subBucket.months;
};

// Returns { months, labelKey, isCategory } for an item. labelKey is either a
// specific override key (e.g. 'groundMeat' → freezerLabel.groundMeat) or a
// top-level category (e.g. 'meat' → shopping.cat_meat); isCategory tells the
// caller which i18n namespace to look in.
export const getFreezerInfo = (name, overrides) => {
  if (!name) {
    return {
      months: monthsForCategory('other', overrides),
      labelKey: 'other',
      isCategory: true,
    };
  }
  const lower = name.toLowerCase();

  // Specific overrides win, longest keyword first so "ground beef" beats
  // a generic "beef" rule if we ever add one.
  let bestOverride = null;
  let bestLen = 0;
  for (const ov of OVERRIDES) {
    for (const kw of ov.keywords) {
      if (lower.includes(kw) && kw.length > bestLen) {
        bestOverride = ov;
        bestLen = kw.length;
      }
    }
  }
  if (bestOverride) {
    return {
      months: monthsForSubBucket(bestOverride, overrides),
      labelKey: bestOverride.labelKey,
      isCategory: false,
    };
  }

  const category = getCategory(name);
  return {
    months: monthsForCategory(category, overrides),
    labelKey: category,
    isCategory: true,
  };
};

// Returns just the recommended freezer storage time in months for an item
// name. Use getFreezerInfo() when you also need the label for the user.
export const getFreezerMonths = (name, overrides) =>
  getFreezerInfo(name, overrides).months;

// Computes the effective expiry date for a frozen item:
//   1. If the item has a frozen_date, expiry = frozen_date + freezer months
//      for that category. The printed expiry_date is ignored — it was a
//      fridge-only date and freezing extends safe storage far beyond it.
//   2. If there's no frozen_date but there is an expiry_date, fall back to
//      that (treat the item as a normal fridge item).
//   3. If neither is set, returns null (no expiry tracking).
//
// Returns a Date at midnight, or null.
export const getEffectiveExpiry = (item, overrides) => {
  if (!item) return null;
  if (item.frozen_date) {
    const frozen = startOfDay(item.frozen_date);
    const months = getFreezerMonths(item.name, overrides);
    const expiry = new Date(frozen);
    expiry.setMonth(expiry.getMonth() + months);
    return expiry;
  }
  if (item.expiry_date) return startOfDay(item.expiry_date);
  return null;
};

// Days from today to the item's effective expiry. Negative = past. null when
// the item has no expiry tracking at all (caller decides what that means).
export const getDaysUntilExpiry = (item, overrides) => {
  const expiry = getEffectiveExpiry(item, overrides);
  if (!expiry) return null;
  const today = startOfDay(new Date());
  return Math.ceil((expiry - today) / MS_PER_DAY);
};

// Coarse status bucket used for badge color and "expiring soon" filters.
// Anything within 7 days is "soon"; the rest is "ok"; null when no expiry.
export const getExpiryStatus = (item, overrides) => {
  const days = getDaysUntilExpiry(item, overrides);
  if (days === null) return null;
  if (days < 0) return 'expired';
  if (days <= 1) return 'critical';
  if (days <= 7) return 'soon';
  return 'ok';
};

// True when an item is past its effective expiry — used by the stats screen
// to count items "past their freezer-safe window".
export const isPastFreezerWindow = (item, overrides) =>
  getExpiryStatus(item, overrides) === 'expired';

// True when an item should appear in the "expiring soon" list (within 7 days
// of its effective expiry, including already-expired).
export const isExpiringSoon = (item, overrides) => {
  const s = getExpiryStatus(item, overrides);
  return s === 'expired' || s === 'critical' || s === 'soon';
};
