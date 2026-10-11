import { supabase } from '../config/supabase';

// How much left the freezer by being eaten rather than thrown away since
// `since`, summed from get_consumption_stats. Shared by the weekly summary and
// the freezer score so the two can never disagree about the same week.
//
// Counts events, not quantities: "6 eaten" means six times something was
// eaten, which is how people remember a week, and it keeps a 2 kg bag from
// outweighing six portions.
//
// Resolves to null when the numbers are unavailable (offline, or the RPC
// missing). Callers treat that as unknown and leave the figure out, rather
// than showing a zero that would read as a perfect week.
export const fetchOutcomes = async (householdId, since) => {
  try {
    const { data, error } = await supabase.rpc('get_consumption_stats', {
      p_household_id: householdId || null,
      p_since: since.toISOString(),
    });
    if (error) throw error;
    return (data || []).reduce(
      (acc, row) => ({
        ate: acc.ate + (Number(row.consumed_events) || 0),
        threw: acc.threw + (Number(row.thrown_events) || 0),
        threwValue: acc.threwValue + (Number(row.thrown_value) || 0),
      }),
      { ate: 0, threw: 0, threwValue: 0 }
    );
  } catch (e) {
    if (__DEV__) console.warn('[outcomes] unavailable:', e?.message || e);
    return null;
  }
};
