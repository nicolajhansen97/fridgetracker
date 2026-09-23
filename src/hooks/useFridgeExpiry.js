import { useMemo } from 'react';
import { useFreezerSettings } from '../context/FreezerSettingsContext';
import {
  getEffectiveExpiry,
  getFreezerEstimate,
  getExpiryChoices,
  usesManualExpiry,
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
// Each item-based helper also takes the user's date-source preference, so the
// whole app agrees on which date an item is judged by. A screen offering a
// temporary look at the other date (Use Soon's dropdown) passes a `source`
// explicitly; everything else omits it and follows the setting.
//
// Usage:
//   const { getEffectiveExpiry, isPastFreezerWindow } = useFridgeExpiry();
//   const expiry = getEffectiveExpiry(item);
//   const stale = items.filter((i) => isPastFreezerWindow(i));
export const useFridgeExpiry = () => {
  const { overrides, dateSource } = useFreezerSettings();
  return useMemo(
    () => ({
      dateSource,
      getEffectiveExpiry: (item, source = dateSource) => getEffectiveExpiry(item, overrides, source),
      getFreezerEstimate: (item) => getFreezerEstimate(item, overrides),
      getExpiryChoices: (item, source = dateSource) => getExpiryChoices(item, overrides, source),
      usesManualExpiry: (item, source = dateSource) => usesManualExpiry(item, source),
      getDaysUntilExpiry: (item, source = dateSource) => getDaysUntilExpiry(item, overrides, source),
      getExpiryStatus: (item, source = dateSource) => getExpiryStatus(item, overrides, source),
      isPastFreezerWindow: (item, source = dateSource) => isPastFreezerWindow(item, overrides, source),
      isExpiringSoon: (item, source = dateSource) => isExpiringSoon(item, overrides, source),
      getFreezerInfo: (name) => getFreezerInfo(name, overrides),
      getFreezerMonths: (name) => getFreezerMonths(name, overrides),
    }),
    [overrides, dateSource]
  );
};
