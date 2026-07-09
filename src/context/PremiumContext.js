import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { Platform, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../config/supabase';
import { useAuth } from './AuthContext';
import { useHousehold } from './HouseholdContext';
import {
  getPurchases,
  revenueCatApiKey,
  isPurchasesAvailable,
  getPackageByProduct,
  getIntroTrialDays,
  isHouseholdProduct,
  PRO_ENTITLEMENT,
  PRO_OFFERING,
  INDIVIDUAL_PRODUCT_ID,
  HOUSEHOLD_PRODUCT_ID,
} from '../config/purchases';

// Freezely Pro subscription state, backed by RevenueCat.
//
// Two products both grant the `pro` entitlement:
//   - individual ($0.99/mo) — Pro for the buyer only.
//   - household ($1.49/mo)  — Pro for everyone in the buyer's household.
//
// RevenueCat only knows about the individual buyer, so household sharing is
// propagated through Supabase: when a member holds the household product we
// upsert the household's `premium_until` into the `household_premium` table,
// which every member can read. A user is therefore Pro when EITHER their own
// entitlement is active OR their current household has active premium.
//
// A RevenueCat webhook can later write `household_premium` server-side so
// renewals propagate even if the buyer never reopens the app; until then the
// buyer's client refreshes it on launch / purchase. The calendar gate is fully
// client-side via usePremium().
//
// In dev builds only, a persisted override (`freezely_dev_pro`) forces Pro on.

const DEV_PRO_KEY = 'freezely_dev_pro';

const PremiumContext = createContext(null);

// Pull the active `pro` entitlement (or null) plus which product unlocked it.
const getActivePro = (info) => {
  const ent = info?.entitlements?.active?.[PRO_ENTITLEMENT];
  if (!ent) return null;
  return {
    productIdentifier: ent.productIdentifier,
    expirationDate: ent.expirationDate || null,
  };
};

export const PremiumProvider = ({ children }) => {
  const { user } = useAuth();
  const { currentHousehold } = useHousehold();

  const [ownPro, setOwnPro] = useState(null); // { productIdentifier, expirationDate } | null
  const [householdUntil, setHouseholdUntil] = useState(null); // ISO string | null
  const [compedUntil, setCompedUntil] = useState(null); // profiles.premium_until | null
  const [offering, setOffering] = useState(null);
  const [loading, setLoading] = useState(true);
  const [devPro, setDevPro] = useState(false);
  const configuredRef = useRef(false);

  const householdId = currentHousehold?.id || null;
  const householdIdRef = useRef(householdId);
  useEffect(() => {
    householdIdRef.current = householdId;
  }, [householdId]);

  // Share the buyer's household entitlement with their household so other
  // members can read it. Best-effort: silently no-ops if the table isn't
  // present yet (SQL not run) or the write is denied.
  const pushHouseholdPremium = useCallback(
    async (hid, expirationISO) => {
      if (!hid || !user?.id) return;
      try {
        await supabase.from('household_premium').upsert(
          {
            household_id: hid,
            premium_until: expirationISO,
            updated_by: user.id,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'household_id' }
        );
      } catch (e) {
        console.warn('[premium] household upsert failed:', e?.message);
      }
    },
    [user?.id]
  );

  const loadHouseholdPremium = useCallback(async (hid) => {
    if (!hid) {
      setHouseholdUntil(null);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('household_premium')
        .select('premium_until')
        .eq('household_id', hid)
        .maybeSingle();
      if (error) throw error;
      setHouseholdUntil(data?.premium_until || null);
    } catch (e) {
      console.warn('[premium] household read failed:', e?.message);
      setHouseholdUntil(null);
    }
  }, []);

  // Read a manually-granted (comped) Pro from the user's profile row. This is
  // how we grant Pro outside of store billing — set profiles.premium_until in
  // Supabase and the user is Pro until that date, no purchase required.
  const loadProfilePremium = useCallback(async (uid) => {
    if (!uid) {
      setCompedUntil(null);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('premium_until')
        .eq('id', uid)
        .maybeSingle();
      if (error) throw error;
      setCompedUntil(data?.premium_until || null);
    } catch (e) {
      console.warn('[premium] profile read failed:', e?.message);
      setCompedUntil(null);
    }
  }, []);

  // Apply a fresh customerInfo: record the buyer's entitlement and, if it's the
  // household product, share it with the current household. Reads householdId
  // from a ref so the RevenueCat listener always sees the latest value.
  const lastInfoRef = useRef(null);
  const applyInfo = useCallback(
    (info) => {
      lastInfoRef.current = info;
      const active = getActivePro(info);
      setOwnPro(active);
      const hid = householdIdRef.current;
      if (active && isHouseholdProduct(active.productIdentifier) && hid) {
        pushHouseholdPremium(hid, active.expirationDate);
        setHouseholdUntil(active.expirationDate); // optimistic
      }
    },
    [pushHouseholdPremium]
  );
  const applyInfoRef = useRef(applyInfo);
  useEffect(() => {
    applyInfoRef.current = applyInfo;
  }, [applyInfo]);

  // Configure the SDK once, identify the user, read status + offerings, and
  // subscribe to live updates so purchases/renewals/expiries flip state.
  useEffect(() => {
    let cancelled = false;
    const Purchases = getPurchases();

    const init = async () => {
      if (__DEV__) {
        try {
          const v = await AsyncStorage.getItem(DEV_PRO_KEY);
          if (!cancelled && v === 'true') setDevPro(true);
        } catch {}
      }

      if (!isPurchasesAvailable() || !Purchases) {
        if (!cancelled) setLoading(false);
        return;
      }

      try {
        if (!configuredRef.current) {
          Purchases.configure({ apiKey: revenueCatApiKey });
          configuredRef.current = true;
        }
        let info;
        if (user?.id) {
          const r = await Purchases.logIn(user.id);
          info = r.customerInfo;
        } else {
          info = await Purchases.getCustomerInfo();
        }
        if (!cancelled) applyInfoRef.current(info);

        const offerings = await Purchases.getOfferings();
        const current = offerings?.current || offerings?.all?.[PRO_OFFERING] || null;
        if (!cancelled) setOffering(current);
      } catch (e) {
        console.warn('[premium] init failed:', e?.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    init();

    let listener;
    if (Purchases && isPurchasesAvailable()) {
      listener = (info) => applyInfoRef.current(info);
      try {
        Purchases.addCustomerInfoUpdateListener(listener);
      } catch {}
    }

    return () => {
      cancelled = true;
      if (Purchases && listener) {
        try {
          Purchases.removeCustomerInfoUpdateListener(listener);
        } catch {}
      }
    };
  }, [user?.id]);

  // When the active household changes, read its shared premium and (if the
  // buyer holds a household subscription) make sure this household has it too.
  useEffect(() => {
    loadHouseholdPremium(householdId);
    if (lastInfoRef.current && householdId) {
      const active = getActivePro(lastInfoRef.current);
      if (active && isHouseholdProduct(active.productIdentifier)) {
        pushHouseholdPremium(householdId, active.expirationDate);
      }
    }
  }, [householdId, loadHouseholdPremium, pushHouseholdPremium]);

  // Load any comped (manually granted) Pro whenever the signed-in user changes.
  // Independent of RevenueCat, so it works even where store billing is absent.
  useEffect(() => {
    loadProfilePremium(user?.id || null);
  }, [user?.id, loadProfilePremium]);

  const ownActive = !!ownPro;
  const householdActive = useMemo(() => {
    if (!householdUntil) return false;
    return new Date(householdUntil).getTime() > Date.now();
  }, [householdUntil]);
  const compedActive = useMemo(() => {
    if (!compedUntil) return false;
    return new Date(compedUntil).getTime() > Date.now();
  }, [compedUntil]);

  const isPremium = ownActive || householdActive || compedActive || (__DEV__ && devPro);
  const premiumSource = ownActive
    ? 'self'
    : householdActive
    ? 'household'
    : compedActive
    ? 'comped'
    : __DEV__ && devPro
    ? 'dev'
    : null;

  const individualPackage = useMemo(
    () => getPackageByProduct(offering, INDIVIDUAL_PRODUCT_ID),
    [offering]
  );
  const householdPackage = useMemo(
    () => getPackageByProduct(offering, HOUSEHOLD_PRODUCT_ID),
    [offering]
  );
  const individualPrice = individualPackage?.product?.priceString || null;
  const householdPrice = householdPackage?.product?.priceString || null;

  // Free-trial length comes straight from the store's introductory offer, not
  // from the app. Either product's trial works (they're configured the same).
  const trialDays = useMemo(
    () => getIntroTrialDays(individualPackage) || getIntroTrialDays(householdPackage) || null,
    [individualPackage, householdPackage]
  );

  const purchasePackage = useCallback(
    async (pkg) => {
      const Purchases = getPurchases();
      if (!Purchases || !pkg) return { success: false, error: 'unavailable' };
      try {
        const { customerInfo } = await Purchases.purchasePackage(pkg);
        applyInfo(customerInfo);
        return { success: !!getActivePro(customerInfo) };
      } catch (e) {
        if (e?.userCancelled) return { success: false, cancelled: true };
        console.warn('[premium] purchase failed:', e?.message);
        return { success: false, error: e?.message || 'purchase_failed' };
      }
    },
    [applyInfo]
  );

  const purchaseIndividual = useCallback(
    () => purchasePackage(individualPackage),
    [purchasePackage, individualPackage]
  );
  const purchaseHousehold = useCallback(
    () => purchasePackage(householdPackage),
    [purchasePackage, householdPackage]
  );

  const restore = useCallback(async () => {
    const Purchases = getPurchases();
    if (!Purchases) return { success: false, error: 'unavailable' };
    try {
      const info = await Purchases.restorePurchases();
      applyInfo(info);
      return { success: true, isPremium: !!getActivePro(info) };
    } catch (e) {
      console.warn('[premium] restore failed:', e?.message);
      return { success: false, error: e?.message || 'restore_failed' };
    }
  }, [applyInfo]);

  const manageSubscription = useCallback(async () => {
    const Purchases = getPurchases();
    try {
      const info = Purchases ? await Purchases.getCustomerInfo() : null;
      const url =
        info?.managementURL ||
        (Platform.OS === 'ios'
          ? 'https://apps.apple.com/account/subscriptions'
          : 'https://play.google.com/store/account/subscriptions');
      Linking.openURL(url);
    } catch (e) {
      console.warn('[premium] manage failed:', e?.message);
    }
  }, []);

  const setDevPremium = useCallback(async (value) => {
    if (!__DEV__) return;
    setDevPro(value);
    try {
      await AsyncStorage.setItem(DEV_PRO_KEY, value ? 'true' : 'false');
    } catch {}
  }, []);

  const value = useMemo(
    () => ({
      isPremium,
      premiumSource,
      loading,
      offering,
      individualPackage,
      householdPackage,
      individualPrice,
      householdPrice,
      trialDays,
      purchaseIndividual,
      purchaseHousehold,
      restore,
      manageSubscription,
      canPurchase: isPurchasesAvailable(),
      devPro,
      setDevPremium,
    }),
    [
      isPremium,
      premiumSource,
      loading,
      offering,
      individualPackage,
      householdPackage,
      individualPrice,
      householdPrice,
      trialDays,
      purchaseIndividual,
      purchaseHousehold,
      restore,
      manageSubscription,
      devPro,
      setDevPremium,
    ]
  );

  return <PremiumContext.Provider value={value}>{children}</PremiumContext.Provider>;
};

export const usePremium = () => {
  const ctx = useContext(PremiumContext);
  if (!ctx) {
    throw new Error('usePremium must be used within a PremiumProvider');
  }
  return ctx;
};
