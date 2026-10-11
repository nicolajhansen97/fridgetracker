import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFridge } from '../context/FridgeContext';
import { useHousehold } from '../context/HouseholdContext';
import { useFridgeExpiry } from './useFridgeExpiry';
import { fetchOutcomes } from '../utils/outcomes';

// One number from 0 to 100 for how the freezer is doing.
//
// Two parts, both from data the app already has:
//
//   fresh  Of the items whose date we know (typed in or estimated), how many
//          are not past it. Weighted 60%: this is waste that has not happened
//          yet and can still be prevented.
//   eaten  Of everything that left the freezer in the last 30 days, how much
//          was eaten rather than thrown away. Weighted 40%.
//
// Each percentage point past its date or thrown away costs two points of its
// part, not one. Measured on 76 real freezers using estimated dates (the
// default) before settling on this: 44 have nothing past its date at all,
// while the 32 that do have a lot of it, a median of 24% of their items. With
// plain shares that freezer still scored 85 and the median was 96, which told
// nobody anything. Doubled, the freezers with a problem spread across good,
// fair and poor (9 / 14 / 12), and one with nothing past its date and nothing
// thrown still scores 100, which it has earned.
//
// A part with no data drops out and the other carries the score alone, so a
// new freezer is not marked down for history it does not have yet.

const WINDOW_DAYS = 30;
const FRESH_WEIGHT = 0.6;
const PENALTY = 2;
// Below this, one forgotten bag would swing the score by a third.
const MIN_TRACKED = 3;

export const scoreGrade = (score) => {
  if (score >= 90) return 'great';
  if (score >= 75) return 'good';
  if (score >= 50) return 'fair';
  return 'poor';
};

const penalised = (badShare) => Math.max(0, 1 - PENALTY * badShare);

export const useFreezerScore = () => {
  const { items } = useFridge();
  const { currentHousehold } = useHousehold();
  const { getDaysUntilExpiry } = useFridgeExpiry();
  const [outcomes, setOutcomes] = useState(null);

  const refresh = useCallback(async () => {
    const since = new Date();
    since.setDate(since.getDate() - WINDOW_DAYS);
    setOutcomes(await fetchOutcomes(currentHousehold?.id, since));
  }, [currentHousehold?.id]);

  // Eating or binning something changes the item count and moves the second
  // half of the score, so re-read then.
  useEffect(() => {
    refresh();
  }, [refresh, items.length]);

  const result = useMemo(() => {
    let tracked = 0;
    let past = 0;
    for (const item of items) {
      const days = getDaysUntilExpiry(item);
      if (days === null || days === undefined || Number.isNaN(days)) continue;
      tracked++;
      if (days < 0) past++;
    }

    // `share` is the plain fraction, which is what the breakdown shows: "18 of
    // 22 items" next to 82% reads true. The penalty only shapes the score.
    const freshShare = tracked >= MIN_TRACKED ? (tracked - past) / tracked : null;
    const left = outcomes ? outcomes.ate + outcomes.threw : 0;
    const eatenShare = left > 0 ? outcomes.ate / left : null;
    if (freshShare === null && eatenShare === null) return null;

    const fresh = freshShare === null ? null : penalised(1 - freshShare);
    const eaten = eatenShare === null ? null : penalised(1 - eatenShare);
    const blended =
      fresh !== null && eaten !== null
        ? FRESH_WEIGHT * fresh + (1 - FRESH_WEIGHT) * eaten
        : fresh !== null
          ? fresh
          : eaten;

    return {
      score: Math.round(blended * 100),
      fresh: { share: freshShare, tracked, past },
      eaten: {
        share: eatenShare,
        ate: outcomes?.ate || 0,
        threw: outcomes?.threw || 0,
      },
    };
  }, [items, getDaysUntilExpiry, outcomes]);

  return { result, refresh };
};
