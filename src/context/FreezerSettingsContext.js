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
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user) {
      setOverrides({});
      return;
    }
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_freezer_settings')
        .select('overrides')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      setOverrides(data?.overrides || {});
    } catch (e) {
      console.error('Error loading freezer settings:', e);
      setOverrides({});
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

  const value = useMemo(
    () => ({ overrides, loading, setOverride, resetAll, reload: load }),
    [overrides, loading, setOverride, resetAll, load]
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
