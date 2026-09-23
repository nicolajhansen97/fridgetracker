import React, { createContext, useState, useContext, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../config/supabase';
import { useAuth } from './AuthContext';
import { useHousehold } from './HouseholdContext';

// Household-scoped weekly meal plan, backed by public.meal_plans
// (SQL Scripts/CREATE_MEAL_PLANS.sql). One meal per day, keyed by date.
//
// Loads a rolling window rather than everything: a plan from four months ago
// is history nobody scrolls back to, and fetching the whole table would grow
// without bound. The window is generous enough that paging back a week or two
// in the UI never hits an empty screen.

const MealPlanContext = createContext(null);

const PAST_DAYS = 14;
const FUTURE_DAYS = 28;

export const ymd = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const MealPlanProvider = ({ children }) => {
  const { user } = useAuth();
  const { currentHousehold } = useHousehold();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);

  const householdId = currentHousehold?.id || null;

  const load = useCallback(async () => {
    if (!user) {
      setPlans([]);
      return;
    }
    setLoading(true);
    try {
      const from = new Date();
      from.setDate(from.getDate() - PAST_DAYS);
      const to = new Date();
      to.setDate(to.getDate() + FUTURE_DAYS);

      let query = supabase
        .from('meal_plans')
        .select('*')
        .gte('plan_date', ymd(from))
        .lte('plan_date', ymd(to))
        .order('plan_date', { ascending: true });

      if (householdId) {
        query = query.eq('household_id', householdId);
      } else {
        query = query.is('household_id', null).eq('user_id', user.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setPlans(data || []);
    } catch (e) {
      // Most likely CREATE_MEAL_PLANS.sql hasn't been run. The screen shows an
      // empty week rather than an error, which is also what an unplanned week
      // looks like — no scary state for a feature that is entirely optional.
      if (__DEV__) console.warn('Meal plans unavailable:', e?.message || e);
      setPlans([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id, householdId]);

  useEffect(() => {
    load();
  }, [load]);

  const byDate = useMemo(() => {
    const map = {};
    for (const p of plans) map[p.plan_date] = p;
    return map;
  }, [plans]);

  // Set (or replace) the meal on a given day.
  const setMeal = useCallback(async (date, { title, recipe = null, source = 'manual', sourceItemIds = [] }) => {
    if (!title || !title.trim()) return { success: false, error: 'Missing title' };
    try {
      const { data, error } = await supabase.rpc('set_meal_plan', {
        p_date: date,
        p_title: title.trim(),
        p_recipe: recipe,
        p_household_id: householdId,
        p_source: source,
        p_source_item_ids: sourceItemIds,
      });
      if (error) throw error;

      const row = Array.isArray(data) ? data[0] : data;
      setPlans((prev) => {
        const rest = prev.filter((p) => p.plan_date !== date);
        return row ? [...rest, row].sort((a, b) => a.plan_date.localeCompare(b.plan_date)) : rest;
      });
      return { success: true, row };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }, [householdId]);

  const clearMeal = useCallback(async (date) => {
    const existing = byDate[date];
    if (!existing) return { success: true };
    try {
      const { error } = await supabase.from('meal_plans').delete().eq('id', existing.id);
      if (error) throw error;
      setPlans((prev) => prev.filter((p) => p.id !== existing.id));
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }, [byDate]);

  const value = useMemo(
    () => ({ plans, byDate, loading, setMeal, clearMeal, reload: load }),
    [plans, byDate, loading, setMeal, clearMeal, load]
  );

  return <MealPlanContext.Provider value={value}>{children}</MealPlanContext.Provider>;
};

export const useMealPlan = () => {
  const ctx = useContext(MealPlanContext);
  if (!ctx) throw new Error('useMealPlan must be used within a MealPlanProvider');
  return ctx;
};
