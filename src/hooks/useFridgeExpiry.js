import { useMemo } from 'react';
import { useFreezerSettings } from '../context/FreezerSettingsContext';
import {
  getEffectiveExpiry,
  getDaysUntilExpiry,
  getExpiryStatus,
  isPastFreezerWindow,
  isExpiringSoon,
  getFreezerInfo,
  getFreezerMonths,
} from '../utils/freezerStorage';

// Returns expiry helpers pre-bound with the user's current overrides from
// FreezerSettingsContext. Screens import this instead of the raw util so
// they don't have to thread `overrides` through every call manually.
//
// Usage:
//   const { getEffectiveExpiry, isPastFreezerWindow } = useFridgeExpiry();
//   const expiry = getEffectiveExpiry(item);
//   const stale = items.filter(isPastFreezerWindow);
export const useFridgeExpiry = () => {
  const { overrides } = useFreezerSettings();
  return useMemo(
    () => ({
      getEffectiveExpiry: (item) => getEffectiveExpiry(item, overrides),
      getDaysUntilExpiry: (item) => getDaysUntilExpiry(item, overrides),
      getExpiryStatus: (item) => getExpiryStatus(item, overrides),
      isPastFreezerWindow: (item) => isPastFreezerWindow(item, overrides),
      isExpiringSoon: (item) => isExpiringSoon(item, overrides),
      getFreezerInfo: (name) => getFreezerInfo(name, overrides),
      getFreezerMonths: (name) => getFreezerMonths(name, overrides),
    }),
    [overrides]
  );
};
