import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../config/supabase';
import { useHousehold } from '../context/HouseholdContext';

const nameKey = (n) => (n || '').trim().toLowerCase();

// Remembered prices, so a price is typed once per item rather than on every
// add. Backed by the item_prices table and the remember_item_price RPC
// (SQL Scripts/ADD_ITEM_PRICES.sql), scoped to the household where there is
// one so either partner typing a price helps both.
//
// Everything here fails quietly: if the migration hasn't been run, priceFor()
// just returns null forever and the price field stays an empty optional box.
// That is exactly how it should degrade — a missing suggestion, not an error.
export const useItemPrices = () => {
  const { currentHousehold } = useHousehold();
  const [prices, setPrices] = useState({});
  const [loading, setLoading] = useState(true);
  // Mirrors `prices` for the callbacks below, so remembering a price doesn't
  // have to wait for a re-render before the next lookup sees it.
  const cache = useRef({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase.from('item_prices').select('name_key, item_name, price, quantity, unit');
      if (currentHousehold?.id) {
        query = query.eq('household_id', currentHousehold.id);
      } else {
        query = query.is('household_id', null);
      }
      const { data, error } = await query;
      if (error) throw error;

      const map = {};
      for (const row of data || []) {
        map[row.name_key] = {
          price: Number(row.price),
          quantity: row.quantity == null ? null : Number(row.quantity),
          unit: row.unit || '',
          name: row.item_name,
        };
      }
      cache.current = map;
      setPrices(map);
    } catch (err) {
      if (__DEV__) console.warn('Item prices unavailable:', err?.message || err);
      cache.current = {};
      setPrices({});
    } finally {
      setLoading(false);
    }
  }, [currentHousehold?.id]);

  useEffect(() => {
    load();
  }, [load]);

  // The remembered price for a name, scaled to the quantity being added where
  // we know both. Someone who paid 45 kr for 2 chicken breasts and now adds 3
  // should see 67.50, not 45 — the remembered figure is a total, not a rate,
  // so it only transfers as-is when the quantity matches.
  const priceFor = useCallback((name, quantity) => {
    const entry = cache.current[nameKey(name)];
    if (!entry) return null;
    const qty = Number(quantity);
    if (!entry.quantity || !isFinite(qty) || qty <= 0 || entry.quantity <= 0) return entry.price;
    if (qty === entry.quantity) return entry.price;
    return Math.round((entry.price / entry.quantity) * qty * 100) / 100;
  }, []);

  const remember = useCallback(async (name, price, quantity, unit) => {
    if (!name || price === null || price === undefined) return;
    const key = nameKey(name);
    if (!key) return;

    cache.current = {
      ...cache.current,
      [key]: { price: Number(price), quantity: quantity == null ? null : Number(quantity), unit: unit || '', name },
    };
    setPrices(cache.current);

    try {
      const { error } = await supabase.rpc('remember_item_price', {
        p_name: name,
        p_price: price,
        p_household_id: currentHousehold?.id || null,
        p_quantity: quantity == null ? null : Number(quantity),
        p_unit: unit || null,
      });
      if (error) throw error;
    } catch (err) {
      // The price is already saved on the item itself; only the suggestion for
      // next time is lost, which isn't worth interrupting the user over.
      if (__DEV__) console.warn('Could not remember price:', err?.message || err);
    }
  }, [currentHousehold?.id]);

  return { prices, priceFor, remember, loading, reload: load };
};
