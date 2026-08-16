import { Platform } from 'react-native';
import Constants from 'expo-constants';

// RevenueCat configuration. Mirrors src/config/supabase.js — public SDK keys
// live in app.json -> expo.extra and are safe to ship in the bundle (same as
// the Supabase anon key). Entitlement / offering / product identifiers must
// match what's configured in the RevenueCat dashboard and the stores.
//
// Both products grant the same `pro` entitlement. The household product
// additionally unlocks Pro for every member of the buyer's household — that
// propagation is handled in PremiumContext via Supabase (RevenueCat only knows
// about the individual buyer).
export const PRO_ENTITLEMENT = 'pro';
export const PRO_OFFERING = 'default';
export const INDIVIDUAL_PRODUCT_ID = 'freezely_pro_monthly'; // $0.99 / month
export const HOUSEHOLD_PRODUCT_ID = 'freezely_pro_household_monthly'; // $1.49 / month

const extra = Constants.expoConfig?.extra || {};

// Platform-specific public SDK key. Empty until the keys are filled into
// app.json — when empty we run in free mode rather than crashing.
export const revenueCatApiKey =
  Platform.select({
    ios: extra.revenueCatIosKey,
    android: extra.revenueCatAndroidKey,
    default: null,
  }) || null;

// react-native-purchases is a native module. Require it lazily and guard so
// the JS bundle still runs where the native side isn't linked (web, Expo Go,
// or before a fresh EAS build). Returns the Purchases module or null.
let _purchases;
export const getPurchases = () => {
  if (_purchases !== undefined) return _purchases;
  if (Platform.OS === 'web') {
    _purchases = null;
    return _purchases;
  }
  try {
    // eslint-disable-next-line global-require
    _purchases = require('react-native-purchases').default;
  } catch (e) {
    console.warn('[purchases] react-native-purchases unavailable:', e?.message);
    _purchases = null;
  }
  return _purchases;
};

// True only when we have both a key and the linked native module — i.e. real
// purchases can happen. Callers use this to decide whether to attempt billing.
export const isPurchasesAvailable = () => !!revenueCatApiKey && !!getPurchases();

// Find a specific package in an offering by its store product identifier.
//
// iOS reports the bare product id (e.g. `freezely_pro_monthly`). Google Play
// reports it as `subscriptionId:basePlanId` (e.g.
// `freezely_pro_monthly:monthly-autorenewing`), so an exact match fails on
// Android. We match the bare id OR the `<productId>:` prefix — safe because the
// two subscription ids don't prefix each other.
export const getPackageByProduct = (offering, productId) => {
  if (!offering || !productId) return null;
  return (
    (offering.availablePackages || []).find((p) => {
      const id = p?.product?.identifier;
      return id === productId || (typeof id === 'string' && id.startsWith(`${productId}:`));
    }) || null
  );
};

// True when an entitlement was unlocked by the household product (so the
// buyer's purchase should be shared with the rest of their household). Tolerates
// Google Play's `subscriptionId:basePlanId` form as well as the bare id.
export const isHouseholdProduct = (productIdentifier) =>
  typeof productIdentifier === 'string' &&
  (productIdentifier === HOUSEHOLD_PRODUCT_ID ||
    productIdentifier.startsWith(`${HOUSEHOLD_PRODUCT_ID}:`));

// Read the free-trial length (in days) from a package's store introductory
// offer, or null when the store offers no free trial. The trial is configured
// in App Store Connect / Play Console — the app never defines it, it only
// reflects what the store reports.
export const getIntroTrialDays = (pkg) => {
  const intro = pkg?.product?.introPrice;
  if (!intro || intro.price !== 0) return null; // price 0 == free trial offer
  const n = intro.periodNumberOfUnits || 0;
  const unit = (intro.periodUnit || '').toUpperCase();
  const mult = unit === 'WEEK' ? 7 : unit === 'MONTH' ? 30 : unit === 'YEAR' ? 365 : 1;
  const days = n * mult;
  return days > 0 ? days : null;
};
