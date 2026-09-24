import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../config/supabase';
import { useHousehold } from '../context/HouseholdContext';

export const normalizeTag = (s) => (s || '').trim().toLowerCase();

// How close two tags have to be before we suspect a typo rather than a new
// idea. One edit covers grill/gril and bbq/bbqs; two starts flagging genuinely
// different short words, which trains people to ignore the warning.
const NEAR_MATCH_DISTANCE = 1;

// Levenshtein, iterative, single row. Only ever runs over a handful of short
// tags when someone types a new one, so the naive version is the right one.
const editDistance = (a, b) => {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(
        prev[j] + 1,
        row[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    prev = row;
  }
  return prev[b.length];
};

// The household's defined tags: the set you can pick from.
//
// Applying a tag and inventing one are deliberately different actions. When
// any text box can mint a tag, a single typo puts "gril" in everyone's list
// permanently, and nothing about the UI tells you it was a mistake rather than
// a choice. Here, picking is a tap and creating is its own step with a
// near-match check in front of it.
export const useTagDefinitions = () => {
  const { currentHousehold } = useHousehold();
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const cache = useRef([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase.from('tag_definitions').select('name').order('name');
      if (currentHousehold?.id) {
        query = query.eq('household_id', currentHousehold.id);
      } else {
        query = query.is('household_id', null);
      }
      const { data, error } = await query;
      if (error) throw error;
      const names = (data || []).map((r) => r.name);
      cache.current = names;
      setTags(names);
    } catch (err) {
      // Most likely ADD_TAG_DEFINITIONS.sql has not been run. An empty
      // catalogue means the picker shows nothing and the field stays quiet,
      // which is the right way for an optional feature to be absent.
      if (__DEV__) console.warn('Tag definitions unavailable:', err?.message || err);
      cache.current = [];
      setTags([]);
    } finally {
      setLoading(false);
    }
  }, [currentHousehold?.id]);

  useEffect(() => {
    load();
  }, [load]);

  // An existing tag within one edit of what is being typed, if any. This is
  // the whole point of the catalogue: catching "gril" while someone is still
  // looking at it, rather than after it has spread across ten items.
  const nearMatch = useCallback((raw) => {
    const name = normalizeTag(raw);
    if (name.length < 3) return null;
    return (
      cache.current.find(
        (t) => t !== name && editDistance(t, name) <= NEAR_MATCH_DISTANCE
      ) || null
    );
  }, []);

  const exists = useCallback(
    (raw) => cache.current.includes(normalizeTag(raw)),
    []
  );

  const define = useCallback(async (raw) => {
    const name = normalizeTag(raw);
    if (!name || cache.current.includes(name)) return { success: true, name };
    try {
      const { error } = await supabase.rpc('define_tag', {
        p_name: name,
        p_household_id: currentHousehold?.id || null,
      });
      if (error) throw error;
      cache.current = [...cache.current, name].sort();
      setTags(cache.current);
      return { success: true, name };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, [currentHousehold?.id]);

  const rename = useCallback(async (from, to) => {
    try {
      const { error } = await supabase.rpc('rename_tag', {
        p_old: normalizeTag(from),
        p_new: normalizeTag(to),
        p_household_id: currentHousehold?.id || null,
      });
      if (error) throw error;
      await load();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, [currentHousehold?.id, load]);

  return { tags, loading, define, rename, nearMatch, exists, reload: load };
};
