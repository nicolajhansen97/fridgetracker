import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../config/supabase';
import { useFridge } from '../context/FridgeContext';
import { useHousehold } from '../context/HouseholdContext';
import { loadIgnored, saveIgnored } from '../utils/restockIgnore';

const MS_PER_DAY = 86400000;
const WINDOW_DAYS = 90;      // history window we reason over
const LOW_WEEKS = 1.5;       // < this many weeks of supply (and used regularly) => restock
const TARGET_WEEKS = 3;      // when restocking, aim to top up to ~this many weeks
const OVER_WEEKS = 8;        // > this many weeks of supply while still used => overstocked
const MIN_OBSERVED_WEEKS = 1;

const nameKey = (n) => (n || '').trim().toLowerCase();

// Combines live inventory (grouped by item name) with consumption history from
// the activity log to work out, per item: how much is on hand, how fast it's
// used, roughly how long the current stock lasts, and whether it's running low
// or being over-bought. Backs the Restock screen and shopping suggestions.
//
// Requires the get_consumption_stats RPC (SQL Scripts/CREATE_CONSUMPTION_STATS_RPC.sql).
export const useStockInsights = () => {
  const { items } = useFridge();
  const { currentHousehold } = useHousehold();
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [ignored, setIgnored] = useState([]);

  useEffect(() => {
    loadIgnored().then(setIgnored);
  }, []);

  const ignore = useCallback((key) => {
    setIgnored((prev) => {
      if (prev.includes(key)) return prev;
      const next = [...prev, key];
      saveIgnored(next);
      return next;
    });
  }, []);

  const unignore = useCallback((key) => {
    setIgnored((prev) => {
      const next = prev.filter((k) => k !== key);
      saveIgnored(next);
      return next;
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const since = new Date(Date.now() - WINDOW_DAYS * MS_PER_DAY).toISOString();
      const { data, error: e } = await supabase.rpc('get_consumption_stats', {
        p_household_id: currentHousehold?.id || null,
        p_since: since,
      });
      if (e) throw e;
      setStats(data || []);
    } catch (err) {
      // Fail quietly — most likely the get_consumption_stats RPC hasn't been
      // created yet. The screen shows a friendly empty state; no scary toast.
      if (__DEV__) console.warn('Consumption stats unavailable:', err?.message || err);
      setError(true);
      setStats([]);
    } finally {
      setLoading(false);
    }
  }, [currentHousehold?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const insights = useMemo(() => {
    const now = Date.now();

    // Sum current quantity per normalised name (each add is its own row, and
    // the same food may sit in several drawers).
    const onHandMap = new Map();
    for (const it of items || []) {
      const key = nameKey(it.name);
      if (!key) continue;
      const cur = onHandMap.get(key) || { name: it.name, qty: 0, unit: it.unit || '', count: 0 };
      cur.qty += Number(it.quantity) || 0;
      cur.count += 1;
      if (!cur.unit && it.unit) cur.unit = it.unit;
      onHandMap.set(key, cur);
    }

    const statMap = new Map();
    for (const s of stats) statMap.set(s.name_key, s);

    const all = [];
    for (const key of new Set([...onHandMap.keys(), ...statMap.keys()])) {
      const oh = onHandMap.get(key);
      const st = statMap.get(key);

      const onHand = oh ? oh.qty : 0;
      const name = (oh && oh.name) || (st && st.item_name) || key;
      const unit = (oh && oh.unit) || '';
      const consumedQty = st ? Number(st.consumed_qty) || 0 : 0;
      const consumedEvents = st ? st.consumed_events || 0 : 0;
      const thrownEvents = st ? st.thrown_events || 0 : 0;

      // Rate is over the observed span (first activity → now), so a recently
      // started item isn't diluted across the whole 90-day window.
      let observedWeeks = WINDOW_DAYS / 7;
      if (st && st.first_activity) {
        const days = Math.min(WINDOW_DAYS, (now - new Date(st.first_activity).getTime()) / MS_PER_DAY);
        observedWeeks = Math.max(MIN_OBSERVED_WEEKS, days / 7);
      }
      const usedPerWeek = consumedQty > 0 ? consumedQty / observedWeeks : 0;
      const weeksLeft = usedPerWeek > 0 ? onHand / usedPerWeek : (onHand > 0 ? Infinity : 0);

      // Wasteful = thrown away repeatedly, at least as often as actually used.
      const wastes = thrownEvents >= 2 && thrownEvents >= Math.max(1, consumedEvents);

      let status = 'ok';
      let suggestedQty = 0;
      if (usedPerWeek > 0 && weeksLeft < LOW_WEEKS) {
        status = 'low';
        suggestedQty = Math.max(1, Math.ceil(usedPerWeek * TARGET_WEEKS - onHand));
      } else if (wastes || (usedPerWeek > 0 && onHand > 0 && weeksLeft > OVER_WEEKS)) {
        status = 'over';
      }

      all.push({
        key, name, unit, onHand, packs: oh ? oh.count : 0, usedPerWeek, weeksLeft,
        consumedEvents, consumedQty, thrownEvents, status, suggestedQty,
      });
    }

    const ignoredSet = new Set(ignored);
    const low = all
      .filter((x) => x.status === 'low')
      .sort((a, b) => a.weeksLeft - b.weeksLeft);
    const restock = low.filter((x) => !ignoredSet.has(x.key));

    // Every ignored item (resolved to its current data where we still have it),
    // so a manage/settings view can list and restore them regardless of status.
    const byKey = new Map(all.map((x) => [x.key, x]));
    const ignoredItems = ignored
      .map((k) => byKey.get(k) || { key: k, name: k, onHand: 0, unit: '', usedPerWeek: 0, weeksLeft: 0, packs: 0, status: 'low' })
      .sort((a, b) => a.name.localeCompare(b.name));
    const overbought = all
      .filter((x) => x.status === 'over')
      .sort((a, b) => b.thrownEvents - a.thrownEvents || b.weeksLeft - a.weeksLeft);
    // Free-tier "running low": purely inventory-based (down to your last one or
    // two) — no consumption history needed, so it works without the RPC or Pro.
    const lowBasic = all
      .filter((x) => x.onHand > 0 && x.onHand <= 1)
      .sort((a, b) => a.onHand - b.onHand || a.name.localeCompare(b.name));

    // Overviews (top handful, not an exhaustive list):
    // what you're holding the most of, and what you use the most.
    const mostStocked = all
      .filter((x) => x.onHand > 0)
      .sort((a, b) => b.onHand - a.onHand)
      .slice(0, 6);
    const mostUsed = all
      .filter((x) => x.usedPerWeek > 0)
      .sort((a, b) => b.usedPerWeek - a.usedPerWeek)
      .slice(0, 5);

    return { restock, lowBasic, ignoredItems, overbought, mostStocked, mostUsed };
  }, [items, stats, ignored]);

  return { ...insights, loading, error, reload: load, ignore, unignore };
};
