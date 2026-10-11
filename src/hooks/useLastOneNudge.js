import { useCallback } from 'react';
import { useFridge } from '../context/FridgeContext';
import { useShoppingList } from '../context/ShoppingListContext';
import { useNudge } from '../context/NudgeContext';
import { useLanguage } from '../i18n';
import { sameName } from '../utils/names';

// After the last of something is eaten, offer to put it on the shopping list.
//
// Eight in ten "eaten" taps finish an item, which is exactly the moment
// someone knows they are out, yet most households never open the shopping
// list. "The last" means the last under that name: eating one of four bags of
// peas is not running out, so there is nothing to offer.
//
// Only after eating, never after throwing away. Binning something is usually
// the reason not to buy it again, at least not in that amount.
//
// Call it with the item as it was before it was eaten, once the eat succeeded.
export const useLastOneNudge = () => {
  const { items } = useFridge();
  const { items: listItems, addItem } = useShoppingList();
  const { showNudge } = useNudge();
  const { t } = useLanguage();

  return useCallback(
    (eaten) => {
      if (!eaten?.name) return;
      const key = sameName(eaten.name);

      // Whether `items` has already dropped the eaten row depends on render
      // timing, so exclude it by id rather than relying on either.
      const stillHave = items.some((it) => it.id !== eaten.id && sameName(it.name) === key);
      if (stillHave) return;

      const alreadyListed = listItems.some((it) => !it.checked && sameName(it.name) === key);
      if (alreadyListed) return;

      const name = eaten.name.trim();
      showNudge({
        message: t('nudge.lastOne', { name }),
        actionLabel: t('nudge.addToList'),
        onAction: async () => {
          const result = await addItem(name);
          showNudge({
            message: result?.success ? t('nudge.added') : t('nudge.addFailed'),
            duration: 2500,
          });
        },
      });
    },
    [items, listItems, addItem, showNudge, t]
  );
};
