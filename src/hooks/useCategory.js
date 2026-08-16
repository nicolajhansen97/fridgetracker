import { useMemo, useCallback } from 'react';
import { useFreezerSettings } from '../context/FreezerSettingsContext';
import { useLanguage } from '../i18n';
import { getCategory, categoryNameKey, isCustomCategory } from '../utils/foodCategories';

// Category helpers pre-bound with the user's manual overrides and custom
// categories, so screens don't have to thread state through every call.
//
//   const { getCategory, setCategory, labelFor, customCategories } = useCategory();
//   const cat = getCategory(item.name);   // override-aware
//   setCategory(item.name, 'meat');       // assign; null clears it
//   labelFor(cat);                        // localized (built-in) or custom name
export const useCategory = () => {
  const {
    categoryOverrides,
    customCategories,
    setCategoryOverride,
    addCustomCategory,
    removeCustomCategory,
  } = useFreezerSettings();
  const { t } = useLanguage();

  const setCategory = useCallback(
    (name, category) => setCategoryOverride(categoryNameKey(name), category),
    [setCategoryOverride]
  );

  const labelFor = useCallback(
    (key) => {
      if (isCustomCategory(key)) {
        const found = customCategories.find((c) => c.key === key);
        return found ? found.name : t('shopping.cat_other');
      }
      return t(`shopping.cat_${key}`);
    },
    [customCategories, t]
  );

  return useMemo(
    () => ({
      categoryOverrides,
      customCategories,
      getCategory: (name) => getCategory(name, categoryOverrides),
      isOverridden: (name) => !!categoryOverrides[categoryNameKey(name)],
      setCategory,
      addCustomCategory,
      removeCustomCategory,
      labelFor,
    }),
    [categoryOverrides, customCategories, setCategory, addCustomCategory, removeCustomCategory, labelFor]
  );
};
