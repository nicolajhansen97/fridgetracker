import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../config/supabase';
import { useAuth } from '../context/AuthContext';
import { useHousehold } from '../context/HouseholdContext';

// Units people add themselves in the amount picker ("bags", "boxes"…), shared
// with the household through public.custom_units.
//
// The first version kept this list on the phone only. Units found there are
// moved into the shared table the first time it loads. Until
// CREATE_CUSTOM_UNITS.sql has been run, the table doesn't exist and the list
// keeps working from the phone, so the app can ship before the SQL.

const LOCAL_KEY = 'freezely_custom_units';

const sameUnit = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

const readLocal = async () => {
  try {
    const val = await AsyncStorage.getItem(LOCAL_KEY);
    const list = val ? JSON.parse(val) : [];
    return Array.isArray(list) ? list.filter((u) => typeof u === 'string') : [];
  } catch {
    return [];
  }
};

const writeLocal = (names) =>
  AsyncStorage.setItem(LOCAL_KEY, JSON.stringify(names)).catch(() => {});

export const useCustomUnits = () => {
  const { user } = useAuth();
  const { currentHousehold } = useHousehold();
  const householdId = currentHousehold?.id || null;

  // [{ id, name }]; id is null for units only stored on the phone.
  const [units, setUnits] = useState([]);
  const [shared, setShared] = useState(false);

  const load = useCallback(async () => {
    const local = await readLocal();
    if (!user) {
      setUnits(local.map((name) => ({ id: null, name })));
      return;
    }

    let query = supabase
      .from('custom_units')
      .select('id, name')
      .order('created_at', { ascending: true });
    query = householdId
      ? query.eq('household_id', householdId)
      : query.is('household_id', null).eq('created_by_user_id', user.id);
    const { data, error } = await query;

    if (error) {
      // Most likely the table isn't created yet. Keep using the phone's list.
      console.warn('[custom units] falling back to this device:', error.message);
      setShared(false);
      setUnits(local.map((name) => ({ id: null, name })));
      return;
    }

    let rows = data || [];
    const toMove = local.filter((name) => !rows.some((r) => sameUnit(r.name, name)));
    if (toMove.length > 0) {
      const { data: moved, error: moveError } = await supabase
        .from('custom_units')
        .insert(
          toMove.map((name) => ({
            household_id: householdId,
            created_by_user_id: user.id,
            name,
          }))
        )
        .select('id, name');
      if (moveError) {
        console.warn('[custom units] could not move device units:', moveError.message);
      } else {
        rows = [...rows, ...(moved || [])];
      }
    }
    // Only forget the phone's list once everything on it is in the table.
    if (local.length > 0 && local.every((name) => rows.some((r) => sameUnit(r.name, name)))) {
      AsyncStorage.removeItem(LOCAL_KEY).catch(() => {});
    }

    setShared(true);
    setUnits(rows);
  }, [user?.id, householdId]);

  useEffect(() => {
    load();
  }, [load]);

  const addUnit = useCallback(
    async (name) => {
      const clean = name.trim();
      if (!clean || units.some((u) => sameUnit(u.name, clean))) return;

      if (!shared || !user) {
        const next = [...units, { id: null, name: clean }];
        setUnits(next);
        writeLocal(next.map((u) => u.name));
        return;
      }

      // Show it immediately; swap in the real row when the insert returns.
      setUnits((prev) => [...prev, { id: null, name: clean }]);
      const { data, error } = await supabase
        .from('custom_units')
        .insert({ household_id: householdId, created_by_user_id: user.id, name: clean })
        .select('id, name')
        .single();
      if (error) {
        // A household member added the same unit a moment ago (unique index):
        // reload to pick up their row. Anything else: drop the optimistic row.
        console.warn('[custom units] add failed:', error.message);
        if (error.code === '23505') load();
        else setUnits((prev) => prev.filter((u) => u.name !== clean));
        return;
      }
      setUnits((prev) => prev.map((u) => (u.id === null && u.name === clean ? data : u)));
    },
    [units, shared, user?.id, householdId, load]
  );

  const removeUnit = useCallback(
    async (unit) => {
      const next = units.filter((u) => u !== unit);
      setUnits(next);
      if (!unit.id) {
        writeLocal(next.filter((u) => !u.id).map((u) => u.name));
        return;
      }
      const { error } = await supabase.from('custom_units').delete().eq('id', unit.id);
      if (error) {
        console.warn('[custom units] remove failed:', error.message);
        load();
      }
    },
    [units, load]
  );

  return { units, addUnit, removeUnit };
};
