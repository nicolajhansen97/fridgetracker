import React, { createContext, useState, useContext, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../config/supabase';
import { useAuth } from './AuthContext';

// Per-user overrides for freezer-storage durations. Defaults live in code
// (utils/freezerStorage.js); only changed values are persisted to the
// user_freezer_settings table as a JSONB blob.
//
// Shape of `overrides`: { [categoryOrSubBucketKey]: months }.
// Keys are the same ones the util uses internally (e.g. "meat", "groundMeat").

const FreezerSettingsContext = createContext(null);

export const FreezerSettingsProvider = ({ children }) => {
  const { user } = useAuth();
  const [overrides, setOverrides] = useState({});
  // Manual food-category overrides: { [lowercased product name]: categoryKey }.
  const [categoryOverrides, setCategoryOverrides] = useState({});
  // User-defined categories: [{ key: 'custom:<id>', name }].
  const [customCategories, setCustomCategories] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user) {
      setOverrides({});
      setCategoryOverrides({});
      setCustomCategories([]);
      return;
    }
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_freezer_settings')
        .select('overrides, category_overrides, custom_categories')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      setOverrides(data?.overrides || {});
      setCategoryOverrides(data?.category_overrides || {});
      setCustomCategories(Array.isArray(data?.custom_categories) ? data.custom_categories : []);
    } catch (e) {
      console.error('Error loading freezer settings:', e);
      setOverrides({});
      setCategoryOverrides({});
      setCustomCategories([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  // Persist a single override (or remove it if months === null). Optimistic
  // local update so the UI stays snappy even if the network is slow.
  const setOverride = useCallback(
    async (key, months) => {
      if (!user) return { success: false, error: 'Not signed in' };

      const next = { ...overrides };
      if (months === null || months === undefined) {
        delete next[key];
      } else {
        next[key] = months;
      }
      setOverrides(next);

      try {
        const { error } = await supabase
          .from('user_freezer_settings')
          .upsert(
            { user_id: user.id, overrides: next },
            { onConflict: 'user_id' }
          );
        if (error) throw error;
        return { success: true };
      } catch (e) {
        console.error('Error saving freezer setting:', e);
        // Roll back the optimistic update on failure.
        setOverrides(overrides);
        return { success: false, error: e.message };
      }
    },
    [user, overrides]
  );

  // Wipe every user override, falling back to in-code defaults for everything.
  const resetAll = useCallback(async () => {
    if (!user) return { success: false };
    setOverrides({});
    try {
      const { error } = await supabase
        .from('user_freezer_settings')
        .upsert({ user_id: user.id, overrides: {} }, { onConflict: 'user_id' });
      if (error) throw error;
      return { success: true };
    } catch (e) {
      console.error('Error resetting freezer settings:', e);
      return { success: false, error: e.message };
    }
  }, [user]);

  // Assign (or clear, when category is null) a manual category for a product
  // name. Keyed by the lowercased name so it applies everywhere that product
  // appears. Optimistic, with rollback on failure.
  const setCategoryOverride = useCallback(
    async (nameKey, category) => {
      if (!user || !nameKey) return { success: false, error: 'Not signed in' };

      const next = { ...categoryOverrides };
      if (!category) {
        delete next[nameKey];
      } else {
        next[nameKey] = category;
      }
      setCategoryOverrides(next);

      try {
        const { error } = await supabase
          .from('user_freezer_settings')
          .upsert(
            { user_id: user.id, category_overrides: next },
            { onConflict: 'user_id' }
          );
        if (error) throw error;
        return { success: true };
      } catch (e) {
        console.error('Error saving category override:', e);
        setCategoryOverrides(categoryOverrides);
        return { success: false, error: e.message };
      }
    },
    [user, categoryOverrides]
  );

  // Create a custom category (or reuse one with the same name). Generates a
  // namespaced key, persists, and returns the key immediately so the caller can
  // assign it right away.
  const addCustomCategory = useCallback(
    (name) => {
      const trimmed = (name || '').trim();
      if (!user || !trimmed) return null;
      const existing = customCategories.find(
        (c) => c.name.toLowerCase() === trimmed.toLowerCase()
      );
      if (existing) return existing.key;

      const key = `custom:${Date.now().toString(36)}`;
      const next = [...customCategories, { key, name: trimmed }];
      setCustomCategories(next);
      supabase
        .from('user_freezer_settings')
        .upsert({ user_id: user.id, custom_categories: next }, { onConflict: 'user_id' })
        .then(({ error }) => {
          if (error) {
            console.error('Error saving custom category:', error);
            setCustomCategories(customCategories);
          }
        });
      return key;
    },
    [user, customCategories]
  );

  // Delete a custom category and clear any product assignments pointing to it
  // (those products fall back to auto-detection).
  const removeCustomCategory = useCallback(
    async (key) => {
      if (!user) return { success: false };
      const nextCats = customCategories.filter((c) => c.key !== key);
      const nextOverrides = Object.fromEntries(
        Object.entries(categoryOverrides).filter(([, v]) => v !== key)
      );
      setCustomCategories(nextCats);
      setCategoryOverrides(nextOverrides);
      try {
        const { error } = await supabase
          .from('user_freezer_settings')
          .upsert(
            { user_id: user.id, custom_categories: nextCats, category_overrides: nextOverrides },
            { onConflict: 'user_id' }
          );
        if (error) throw error;
        return { success: true };
      } catch (e) {
        console.error('Error removing custom category:', e);
        setCustomCategories(customCategories);
        setCategoryOverrides(categoryOverrides);
        return { success: false, error: e.message };
      }
    },
    [user, customCategories, categoryOverrides]
  );

  const value = useMemo(
    () => ({
      overrides,
      categoryOverrides,
      customCategories,
      loading,
      setOverride,
      setCategoryOverride,
      addCustomCategory,
      removeCustomCategory,
      resetAll,
      reload: load,
    }),
    [overrides, categoryOverrides, customCategories, loading, setOverride, setCategoryOverride, addCustomCategory, removeCustomCategory, resetAll, load]
  );

  return (
    <FreezerSettingsContext.Provider value={value}>
      {children}
    </FreezerSettingsContext.Provider>
  );
};

export const useFreezerSettings = () => {
  const ctx = useContext(FreezerSettingsContext);
  if (!ctx) {
    throw new Error('useFreezerSettings must be used within a FreezerSettingsProvider');
  }
  return ctx;
};
