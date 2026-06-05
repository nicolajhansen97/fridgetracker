import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  RefreshControl,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../config/supabase';
import { useFridge } from '../context/FridgeContext';
import { useShoppingList } from '../context/ShoppingListContext';
import { useSavedRecipes } from '../context/SavedRecipesContext';
import { useLanguage } from '../i18n';
import {
  Screen,
  ScreenHeader,
  Card,
  Icon,
  Pill,
  Badge,
  PrimaryButton,
  SectionTitle,
  EmptyState,
} from '../components/ui';
import { colors, gradients, radii, shadows, spacing, typography } from '../theme';
import { useFridgeExpiry } from '../hooks/useFridgeExpiry';

const FAMILY_SIZE_KEY = 'freezely_family_size';

// Pick a food-category icon deterministically from the recipe title so
// every card doesn't look identical. Stable across renders.
const FOOD_ICONS = [
  'restaurant-outline',
  'pizza-outline',
  'fast-food-outline',
  'fish-outline',
  'leaf-outline',
  'cafe-outline',
  'flame-outline',
  'nutrition-outline',
];
const iconForRecipe = (title = '') => {
  const hash = title.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return FOOD_ICONS[hash % FOOD_ICONS.length];
};

const formatQty = (qty) => {
  if (!qty && qty !== 0) return '';
  const fractions = { 0.25: '¼', 0.5: '½', 0.75: '¾', 0.33: '⅓', 0.67: '⅔', 0.125: '⅛' };
  const rounded = Math.round(qty * 1000) / 1000;
  const whole = Math.floor(rounded);
  const frac = Math.round((rounded - whole) * 1000) / 1000;
  const fracStr = fractions[frac] || (frac > 0 ? frac.toFixed(2).replace(/\.?0+$/, '') : '');
  if (whole === 0) return fracStr || String(rounded);
  return fracStr ? `${whole} ${fracStr}` : String(whole > 0 ? whole : rounded);
};


const RecipeSuggestionsScreen = ({ navigation }) => {
  const { items, loadItems } = useFridge();
  const { addItem: addToShoppingList } = useShoppingList();
  const { savedRecipes, saveRecipe, unsaveRecipe, dbRowToRecipe } = useSavedRecipes();
  const { getDaysUntilExpiry: getItemDaysUntilExpiry } = useFridgeExpiry();
  const { t, locale } = useLanguage();

  // Wrap so items with no expiry sort to the bottom of the urgency list.
  const getDaysUntilExpiry = (item) => {
    const d = getItemDaysUntilExpiry(item);
    return d === null ? Infinity : d;
  };

  const [activeTab, setActiveTab] = useState('discover'); // 'discover' | 'saved'

  const [refreshing, setRefreshing] = useState(false);
  const [selectedIngredients, setSelectedIngredients] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [familySize, setFamilySize] = useState(4);
  const [hasSearched, setHasSearched] = useState(false);

  const [selectedRecipeIdx, setSelectedRecipeIdx] = useState(null);
  const [refineText, setRefineText] = useState('');
  const [refining, setRefining] = useState(false);
  const [showFamilyEditor, setShowFamilyEditor] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  // Auto-pick expiring items the first time the user lands on this screen so
  // they don't stare at an empty "select something" state. We only do it once
  // per session — after that, the user's manual selection is sacred.
  const [autoSelectedOnce, setAutoSelectedOnce] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(FAMILY_SIZE_KEY).then((val) => {
      if (val) setFamilySize(parseInt(val));
    });
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    try { await loadItems(); } catch (e) { console.error('Refresh error:', e); }
    finally { setRefreshing(false); }
  };

  const ingredientList = useMemo(() => {
    const map = new Map();
    items.forEach((item) => {
      const existing = map.get(item.name);
      const days = getDaysUntilExpiry(item);
      if (!existing || days < existing.daysUntilExpiry) {
        map.set(item.name, { name: item.name, daysUntilExpiry: days });
      }
    });
    return [...map.values()].sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
  }, [items, getItemDaysUntilExpiry]);

  const allItemNames = useMemo(() => ingredientList.map((i) => i.name), [ingredientList]);

  const filteredIngredientList = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    if (!q) return ingredientList;
    return ingredientList.filter((i) => i.name.toLowerCase().includes(q));
  }, [ingredientList, pickerSearch]);

  useEffect(() => {
    if (autoSelectedOnce) return;
    if (ingredientList.length === 0) return;
    const expiring = ingredientList
      .filter((i) => i.daysUntilExpiry <= 7)
      .map((i) => i.name);
    if (expiring.length > 0) {
      setSelectedIngredients(expiring);
    }
    setAutoSelectedOnce(true);
  }, [ingredientList, autoSelectedOnce]);

  const toggleIngredient = (name) => {
    setSelectedIngredients((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  const selectExpiring = () => {
    const expiring = ingredientList.filter((i) => i.daysUntilExpiry <= 7).map((i) => i.name);
    setSelectedIngredients(
      expiring.length > 0 ? expiring : ingredientList.slice(0, 5).map((i) => i.name)
    );
  };

  const callGenerate = async (payload) => {
    const { data, error: invokeError } = await supabase.functions.invoke('generate-recipes', {
      body: payload,
    });
    if (invokeError) {
      // Supabase's FunctionsHttpError exposes the upstream Response as
      // `invokeError.context`. Read its body to surface the actual error
      // (missing OPENROUTER_API_KEY, upstream 401, model rate-limit, etc.)
      // instead of the generic "non-2xx" wrapper.
      let detail = invokeError.message || 'Network error';
      let status = '';
      let parsedBody = null;
      try {
        const resp = invokeError.context;
        if (resp) {
          if (resp.status) status = ` [HTTP ${resp.status}]`;
          if (typeof resp.text === 'function') {
            const text = await resp.text();
            if (text) {
              try {
                parsedBody = JSON.parse(text);
                detail = parsedBody.error
                  ? `${parsedBody.error}${parsedBody.detail ? ` — ${parsedBody.detail}` : ''}`
                  : text;
              } catch {
                detail = text;
              }
            }
          }
        }
      } catch {}
      // Swap the raw sentinel for a localized message the user actually wants
      // to read. Limit-reached is a normal state, not a crash.
      if (parsedBody?.error === 'DAILY_LIMIT_REACHED') {
        const friendly = t('recipes.dailyLimitReached', {
          limit: parsedBody.limit ?? 3,
        });
        console.warn('[generate-recipes] rate-limited:', friendly);
        throw new Error(friendly);
      }
      console.warn('[generate-recipes] invoke error' + status + ':', detail);
      throw new Error(detail + status);
    }
    if (data?.error) throw new Error(data.error);
    return data?.recipes || [];
  };

  const searchRecipes = async () => {
    const trimmedPrompt = aiPrompt.trim();
    if (selectedIngredients.length === 0 && !trimmedPrompt) return;
    setRecipes([]);
    setLoading(true);
    setError(null);
    setHasSearched(true);
    try {
      const otherFridgeItems = allItemNames.filter((n) => !selectedIngredients.includes(n));
      const newRecipes = await callGenerate({
        mustUseItems: selectedIngredients,
        otherFridgeItems,
        familySize,
        locale,
        prompt: trimmedPrompt || undefined,
      });
      setRecipes(newRecipes);
    } catch (e) {
      setError(e.message || String(e));
      setRecipes([]);
    } finally {
      setLoading(false);
    }
  };

  const refineRecipe = async () => {
    const idx = selectedRecipeIdx;
    if (idx == null || !refineText.trim()) return;
    setRefining(true);
    try {
      const otherFridgeItems = allItemNames.filter((n) => !selectedIngredients.includes(n));
      const refined = await callGenerate({
        mustUseItems: selectedIngredients,
        otherFridgeItems,
        familySize,
        locale,
        prompt: aiPrompt.trim() || undefined,
        refineFrom: recipes[idx],
        refineInstruction: refineText.trim(),
      });
      if (refined.length > 0) {
        setRecipes((prev) => prev.map((r, i) => (i === idx ? refined[0] : r)));
        setRefineText('');
      } else {
        Alert.alert(t('common.error'), t('recipes.refineFailed'));
      }
    } catch (e) {
      Alert.alert(t('common.error'), e.message || String(e));
    } finally {
      setRefining(false);
    }
  };

  // selectedRecipe is computed further below in a tab-aware way.

  const closeRecipe = () => {
    setSelectedRecipeIdx(null);
    setRefineText('');
  };

  const addMissingToShoppingListFn = async () => {
    if (!selectedRecipe) return;
    const missing = (selectedRecipe.ingredients || []).filter((ing) => !ing.inFridge);
    if (missing.length === 0) {
      Alert.alert(t('recipes.allInStock'), t('recipes.allInStockDesc'));
      return;
    }
    let added = 0;
    for (const ing of missing) {
      const qty = ing.amount
        ? `${formatQty(ing.amount)} ${ing.unit || ''}`.trim()
        : '';
      const result = await addToShoppingList(ing.name, qty);
      if (result.success) added++;
    }
    Alert.alert(t('recipes.addedToList'), t('recipes.addedToListDesc', { count: added }));
  };

  const setFamily = (n) => {
    const clamped = Math.min(20, Math.max(1, n));
    setFamilySize(clamped);
    AsyncStorage.setItem(FAMILY_SIZE_KEY, String(clamped));
  };

  // Saved recipes store the inFridge flag from when they were saved. Re-run
  // a loose name match against the current fridge so the modal shows accurate
  // strikethroughs after items get eaten / replenished.
  const recipeWithLiveInFridge = (recipe) => {
    if (!recipe) return recipe;
    const fridgeNames = items.map((i) => (i.name || '').toLowerCase());
    const updatedIngredients = (recipe.ingredients || []).map((ing) => {
      const n = (ing.name || '').toLowerCase();
      const inFridge =
        n.length > 1 &&
        fridgeNames.some((f) => f.includes(n) || n.includes(f));
      return { ...ing, inFridge };
    });
    return { ...recipe, ingredients: updatedIngredients };
  };

  // Map saved DB rows into the camelCase recipe shape the rest of the screen uses.
  const savedAsRecipes = useMemo(
    () => savedRecipes.map(dbRowToRecipe),
    [savedRecipes]
  );

  // Which array drives the visible "recipes" list depends on the active tab.
  const visibleRecipes = activeTab === 'saved' ? savedAsRecipes : recipes;
  const selectedRecipe = (() => {
    if (selectedRecipeIdx == null) return null;
    const raw = visibleRecipes[selectedRecipeIdx];
    return activeTab === 'saved' ? recipeWithLiveInFridge(raw) : raw;
  })();

  // Is the currently-open recipe saved? Match by _savedId (preferred — the
  // row id) or by title as a fallback for freshly-generated recipes.
  const currentSavedRow = useMemo(() => {
    const r = selectedRecipe;
    if (!r) return null;
    if (r._savedId) return savedRecipes.find((s) => s.id === r._savedId) || null;
    return savedRecipes.find((s) => s.title === r.title) || null;
  }, [selectedRecipe, savedRecipes]);
  const isCurrentSaved = !!currentSavedRow;

  const toggleSaveCurrent = async () => {
    if (!selectedRecipe) return;
    if (isCurrentSaved) {
      await unsaveRecipe(currentSavedRow.id);
    } else {
      await saveRecipe(selectedRecipe);
    }
  };

  const QUICK_REFINES = [
    t('recipes.refineVegetarian'),
    t('recipes.refineFaster'),
    t('recipes.refineNoOven'),
    t('recipes.refineSpicy'),
    t('recipes.refineKidFriendly'),
  ];

  return (
    <Screen>
      <ScreenHeader
        title={t('recipes.title')}
      />

      <View style={styles.tabRow}>
        <TouchableOpacity
          onPress={() => setActiveTab('discover')}
          style={[styles.tab, activeTab === 'discover' && styles.tabActive]}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === 'discover' && styles.tabTextActive]}>
            {t('recipes.tabDiscover')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab('saved')}
          style={[styles.tab, activeTab === 'saved' && styles.tabActive]}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === 'saved' && styles.tabTextActive]}>
            {savedRecipes.length > 0
              ? t('recipes.tabSavedWithCount', { count: savedRecipes.length })
              : t('recipes.tabSaved')}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {activeTab === 'saved' ? (
          savedAsRecipes.length === 0 ? (
            <EmptyState
              icon="bookmark-outline"
              title={t('recipes.savedEmpty')}
              description={t('recipes.savedEmptyDesc')}
            />
          ) : (
            <>
              <SectionTitle>
                {t('recipes.savedCount', { count: savedAsRecipes.length })}
              </SectionTitle>
              {savedAsRecipes.map((recipe, idx) => {
                // Re-compute inFridge against the current fridge so badges are
                // accurate even if the recipe was saved a week ago.
                const live = recipeWithLiveInFridge(recipe);
                const ingredients = live.ingredients || [];
                const matched = ingredients.filter((i) => i.inFridge).length;
                const total = ingredients.length;
                const missing = total - matched;
                const allMatched = total > 0 && missing === 0;
                return (
                  <TouchableOpacity
                    key={recipe.id || idx}
                    onPress={() => setSelectedRecipeIdx(idx)}
                    activeOpacity={0.85}
                  >
                    <Card style={styles.recipeCard} padded={false}>
                      <LinearGradient
                        colors={gradients.hero}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.recipeArt}
                      >
                        <Icon
                          name={iconForRecipe(recipe.title)}
                          size={32}
                          color={colors.surface}
                        />
                      </LinearGradient>
                      <View style={styles.recipeBody}>
                        <Text style={styles.recipeTitle} numberOfLines={2}>
                          {recipe.title}
                        </Text>
                        <View style={styles.recipeMetaRow}>
                          {recipe.totalMinutes ? (
                            <View style={styles.metaItem}>
                              <Icon name="time-outline" size={13} color={colors.textMuted} />
                              <Text style={styles.metaItemText}>{recipe.totalMinutes} min</Text>
                            </View>
                          ) : null}
                          <View style={styles.metaItem}>
                            <Icon
                              name={allMatched ? 'checkmark-circle' : 'list-outline'}
                              size={13}
                              color={allMatched ? colors.success : colors.textMuted}
                            />
                            <Text
                              style={[
                                styles.metaItemText,
                                allMatched && { color: colors.success, fontWeight: '700' },
                              ]}
                            >
                              {matched}/{total}
                            </Text>
                          </View>
                          {missing > 0 ? (
                            <Text style={styles.metaMissing}>
                              · {t('recipes.missingCount', { count: missing })}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                      <View style={styles.recipeArrow}>
                        <Icon name="chevron-forward" size={20} color={colors.textMuted} />
                      </View>
                    </Card>
                  </TouchableOpacity>
                );
              })}
            </>
          )
        ) : (
        <>
        <View style={styles.familyRow}>
          {showFamilyEditor ? (
            <View style={styles.familyEditor}>
              <Icon name="people-outline" size={16} color={colors.textMuted} />
              <Text style={styles.familyEditorLabel}>{t('recipes.familySize')}</Text>
              <View style={styles.familyStepper}>
                <TouchableOpacity style={styles.stepBtn} onPress={() => setFamily(familySize - 1)}>
                  <Text style={styles.stepBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.familyValue}>{familySize}</Text>
                <TouchableOpacity style={styles.stepBtn} onPress={() => setFamily(familySize + 1)}>
                  <Text style={styles.stepBtnText}>+</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={() => setShowFamilyEditor(false)} hitSlop={8}>
                <Icon name="checkmark" size={18} color={colors.primary} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.familyChip}
              onPress={() => setShowFamilyEditor(true)}
              activeOpacity={0.7}
            >
              <Icon name="people-outline" size={14} color={colors.textMuted} />
              <Text style={styles.familyChipText}>
                {t('recipes.servesSimple', { count: familySize })}
              </Text>
              <Icon name="chevron-down" size={14} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {ingredientList.length === 0 ? (
          <EmptyState
            icon="restaurant-outline"
            title={t('recipes.noItems')}
            description={t('recipes.addItemsToDiscover')}
          />
        ) : (
          <>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionLabel}>{t('recipes.yourIngredients')}</Text>
              <TouchableOpacity onPress={() => setPickerOpen(true)} hitSlop={8}>
                <Text style={styles.linkText}>
                  {selectedIngredients.length === 0
                    ? t('recipes.openPicker')
                    : t('recipes.edit')}
                </Text>
              </TouchableOpacity>
            </View>

            {selectedIngredients.length === 0 ? (
              <TouchableOpacity
                style={styles.emptySelection}
                onPress={() => setPickerOpen(true)}
                activeOpacity={0.8}
              >
                <Icon name="add-circle-outline" size={26} color={colors.primary} />
                <Text style={styles.emptySelectionText}>
                  {t('recipes.tapToSelect')}
                </Text>
                <Icon name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.selectionPreview}
                onPress={() => setPickerOpen(true)}
                activeOpacity={0.8}
              >
                <View style={styles.selectionChips}>
                  {selectedIngredients.slice(0, 6).map((name) => (
                    <View key={name} style={styles.selChip}>
                      <Text style={styles.selChipText} numberOfLines={1}>
                        {name}
                      </Text>
                    </View>
                  ))}
                  {selectedIngredients.length > 6 ? (
                    <View style={[styles.selChip, styles.selChipMore]}>
                      <Text style={styles.selChipMoreText}>
                        +{selectedIngredients.length - 6}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Icon name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            )}

            <View style={styles.aiPromptBox}>
              <Icon name="sparkles-outline" size={16} color={colors.primary} />
              <TextInput
                value={aiPrompt}
                onChangeText={setAiPrompt}
                placeholder={t('recipes.aiPromptPlaceholder')}
                placeholderTextColor={colors.textMuted}
                style={styles.aiPromptInput}
                multiline
              />
              {aiPrompt ? (
                <TouchableOpacity onPress={() => setAiPrompt('')} hitSlop={8}>
                  <Icon name="close-circle" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              ) : null}
            </View>

            {(selectedIngredients.length > 0 || aiPrompt.trim().length > 0) && (
              <PrimaryButton
                title={
                  selectedIngredients.length > 0
                    ? t('recipes.findRecipes', { count: selectedIngredients.length })
                    : t('recipes.findFromPrompt')
                }
                onPress={searchRecipes}
                loading={loading}
                style={{ marginTop: spacing.md, marginBottom: spacing.sm }}
              />
            )}

            {loading && (
              <View style={styles.centered}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.subText}>{t('recipes.findingRecipes')}</Text>
              </View>
            )}

            {!loading && error && (
              <EmptyState icon="alert-circle-outline" title={t('common.error')} description={error} />
            )}

            {!loading && !error && hasSearched && recipes.length === 0 && (
              <EmptyState
                icon="search-outline"
                title={t('recipes.noRecipesFoundMulti')}
                description={t('recipes.tryDifferent')}
              />
            )}

            {!loading && recipes.length > 0 && (
              <>
                <SectionTitle>
                  {t('recipes.recipeCount', { count: recipes.length })}
                  {familySize !== 4 ? `  ·  ${t('recipes.forPeople', { count: familySize })}` : ''}
                </SectionTitle>
                {recipes.map((recipe, idx) => {
                  const ingredients = recipe.ingredients || [];
                  const matched = ingredients.filter((i) => i.inFridge).length;
                  const total = ingredients.length;
                  const missing = total - matched;
                  const allMatched = total > 0 && missing === 0;
                  return (
                    <TouchableOpacity
                      key={idx}
                      onPress={() => setSelectedRecipeIdx(idx)}
                      activeOpacity={0.85}
                    >
                      <Card style={styles.recipeCard} padded={false}>
                        <LinearGradient
                          colors={gradients.hero}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.recipeArt}
                        >
                          <Icon
                            name={iconForRecipe(recipe.title)}
                            size={32}
                            color={colors.surface}
                          />
                        </LinearGradient>
                        <View style={styles.recipeBody}>
                          <Text style={styles.recipeTitle} numberOfLines={2}>
                            {recipe.title}
                          </Text>
                          <View style={styles.recipeMetaRow}>
                            {recipe.totalMinutes ? (
                              <View style={styles.metaItem}>
                                <Icon name="time-outline" size={13} color={colors.textMuted} />
                                <Text style={styles.metaItemText}>{recipe.totalMinutes} min</Text>
                              </View>
                            ) : null}
                            <View style={styles.metaItem}>
                              <Icon
                                name={allMatched ? 'checkmark-circle' : 'list-outline'}
                                size={13}
                                color={allMatched ? colors.success : colors.textMuted}
                              />
                              <Text
                                style={[
                                  styles.metaItemText,
                                  allMatched && { color: colors.success, fontWeight: '700' },
                                ]}
                              >
                                {matched}/{total}
                              </Text>
                            </View>
                            {missing > 0 ? (
                              <Text style={styles.metaMissing}>
                                · {t('recipes.missingCount', { count: missing })}
                              </Text>
                            ) : null}
                          </View>
                        </View>
                        <View style={styles.recipeArrow}>
                          <Icon name="chevron-forward" size={20} color={colors.textMuted} />
                        </View>
                      </Card>
                    </TouchableOpacity>
                  );
                })}
              </>
            )}

            {!hasSearched && selectedIngredients.length === 0 && (
              <View style={styles.centered}>
                <Icon name="hand-left-outline" size={32} color={colors.textMuted} />
                <Text style={styles.subText}>{t('recipes.selectIngredients')}</Text>
              </View>
            )}
          </>
        )}
        </>
        )}
        <View style={{ height: spacing.xxxl }} />
      </ScrollView>

      <Modal
        visible={pickerOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPickerOpen(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>
              {t('recipes.selectIngredientsTitle')}
            </Text>
            <TouchableOpacity
              onPress={() => {
                setPickerOpen(false);
                setPickerSearch('');
              }}
              hitSlop={8}
            >
              <Text style={styles.pickerDone}>{t('recipes.done')}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.searchBox}>
            <Icon name="search-outline" size={18} color={colors.textMuted} />
            <TextInput
              value={pickerSearch}
              onChangeText={setPickerSearch}
              placeholder={t('recipes.searchIngredients')}
              placeholderTextColor={colors.textMuted}
              style={styles.searchInput}
              autoCorrect={false}
              autoCapitalize="none"
            />
            {pickerSearch ? (
              <TouchableOpacity onPress={() => setPickerSearch('')} hitSlop={8}>
                <Icon name="close-circle" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.pickerActions}>
            <TouchableOpacity onPress={selectExpiring} hitSlop={8}>
              <Text style={styles.linkText}>{t('recipes.selectExpiring')}</Text>
            </TouchableOpacity>
            <Text style={styles.pickerCount}>
              {t('recipes.selectedCount', { count: selectedIngredients.length })}
            </Text>
          </View>

          <ScrollView
            contentContainerStyle={styles.pickerListContent}
            keyboardShouldPersistTaps="handled"
          >
            {filteredIngredientList.length === 0 ? (
              <EmptyState
                icon="search-outline"
                title={t('recipes.noMatch')}
                description={t('recipes.tryDifferent')}
              />
            ) : (
              <Card padded={false} style={styles.listCard}>
                {filteredIngredientList.map(({ name, daysUntilExpiry }, idx) => {
                  const isSelected = selectedIngredients.includes(name);
                  const isExpiring = daysUntilExpiry <= 7;
                  const isExpired = daysUntilExpiry < 0;
                  const dotColor = isExpired
                    ? colors.danger
                    : isExpiring
                    ? colors.warning
                    : null;
                  return (
                    <TouchableOpacity
                      key={name}
                      onPress={() => toggleIngredient(name)}
                      activeOpacity={0.6}
                      style={[
                        styles.row,
                        idx > 0 && styles.rowDivider,
                        isSelected && styles.rowSelected,
                      ]}
                    >
                      <View
                        style={[styles.checkbox, isSelected && styles.checkboxOn]}
                      >
                        {isSelected ? (
                          <Icon name="checkmark" size={14} color={colors.surface} />
                        ) : null}
                      </View>
                      <Text
                        style={[styles.rowText, isSelected && styles.rowTextOn]}
                        numberOfLines={2}
                      >
                        {name}
                      </Text>
                      {dotColor ? (
                        <View style={[styles.rowDot, { backgroundColor: dotColor }]} />
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </Card>
            )}
            <View style={{ height: spacing.xl }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={!!selectedRecipe}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeRecipe}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={closeRecipe} hitSlop={8} style={styles.modalCloseRow}>
              <Icon name="close" size={20} color={colors.primary} />
              <Text style={styles.modalClose}>{t('recipes.close')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={toggleSaveCurrent}
              hitSlop={8}
              accessibilityLabel={
                isCurrentSaved ? t('recipes.unsave') : t('recipes.save')
              }
              style={styles.bookmarkBtn}
            >
              <Icon
                name={isCurrentSaved ? 'bookmark' : 'bookmark-outline'}
                size={22}
                color={isCurrentSaved ? colors.primary : colors.textMuted}
              />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {selectedRecipe && (
              <View style={styles.modalBody}>
                <LinearGradient
                  colors={gradients.hero}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.modalArt}
                >
                  <Icon name="restaurant-outline" size={42} color={colors.surface} />
                </LinearGradient>

                <Text style={styles.modalTitle}>{selectedRecipe.title}</Text>
                {selectedRecipe.description ? (
                  <Text style={styles.modalDesc}>{selectedRecipe.description}</Text>
                ) : null}


                <View style={styles.metaRow}>
                  {selectedRecipe.totalMinutes > 0 && (
                    <View style={styles.metaPill}>
                      <Icon name="time-outline" size={13} color="#075985" />
                      <Text style={styles.metaPillText}>{selectedRecipe.totalMinutes} min</Text>
                    </View>
                  )}
                  <View style={[styles.metaPill, styles.metaPillPrimary]}>
                    <Icon name="people-outline" size={13} color="#0F766E" />
                    <Text style={[styles.metaPillText, { color: '#0F766E' }]}>
                      {t('recipes.servesSimple', { count: selectedRecipe.servings || familySize })}
                    </Text>
                  </View>
                </View>

                <PrimaryButton
                  title={t('recipes.addMissingToList')}
                  icon={<Icon name="cart-outline" size={16} color={colors.surface} />}
                  onPress={addMissingToShoppingListFn}
                  style={{ marginTop: spacing.md }}
                />

                <SectionTitle>{t('recipes.ingredients')}</SectionTitle>
                <Card padded={false}>
                  {(selectedRecipe.ingredients || []).map((ing, idx) => (
                    <View key={idx} style={[styles.ingItem, idx > 0 && styles.ingItemDivider]}>
                      <View style={styles.ingDotWrap}>
                        {ing.inFridge ? (
                          <Icon name="checkmark-circle" size={16} color={colors.primary} />
                        ) : (
                          <View style={styles.ingBullet} />
                        )}
                      </View>
                      <Text style={[styles.ingText, ing.inFridge && styles.ingInFridge]}>
                        {ing.amount ? <Text style={styles.ingQty}>{formatQty(ing.amount)} </Text> : null}
                        {ing.unit ? <Text style={styles.ingUnit}>{ing.unit} </Text> : null}
                        {ing.name}
                      </Text>
                    </View>
                  ))}
                </Card>

                {(selectedRecipe.steps || []).length > 0 && (
                  <>
                    <SectionTitle>{t('recipes.instructions')}</SectionTitle>
                    <View style={{ gap: spacing.md }}>
                      {selectedRecipe.steps.map((step, i) => (
                        <View key={i} style={styles.step}>
                          <View style={styles.stepNumberBadge}>
                            <Text style={styles.stepNumber}>{i + 1}</Text>
                          </View>
                          <Text style={styles.stepText}>{step}</Text>
                        </View>
                      ))}
                    </View>
                  </>
                )}

                <SectionTitle>{t('recipes.refineTitle')}</SectionTitle>
                <Text style={styles.refineHelp}>{t('recipes.refineHelp')}</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.pillRow}
                >
                  {QUICK_REFINES.map((q) => (
                    <View key={q} style={{ marginRight: 8 }}>
                      <Pill label={q} onPress={() => setRefineText(q)} />
                    </View>
                  ))}
                </ScrollView>
                <TextInput
                  value={refineText}
                  onChangeText={setRefineText}
                  placeholder={t('recipes.refinePlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  style={styles.refineInput}
                  multiline
                />
                <PrimaryButton
                  title={t('recipes.refineNow')}
                  icon={<Icon name="sparkles-outline" size={16} color={colors.surface} />}
                  onPress={refineRecipe}
                  loading={refining}
                  disabled={!refineText.trim()}
                  style={{ marginTop: spacing.sm }}
                />
              </View>
            )}
            <View style={{ height: spacing.xxxl }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.lg },
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  tabText: {
    ...typography.bodySmall,
    color: colors.textMuted,
    fontWeight: '600',
  },
  tabTextActive: {
    color: colors.text,
    fontWeight: '700',
  },
  familyRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: spacing.md,
  },
  familyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  familyChipText: {
    ...typography.bodySmall,
    color: colors.text,
    fontWeight: '600',
  },
  familyEditor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  familyEditorLabel: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
  familyStepper: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepBtn: {
    width: 26,
    height: 26,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: { fontSize: 16, fontWeight: '700', color: colors.text },
  familyValue: {
    ...typography.bodyStrong,
    color: colors.primary,
    minWidth: 18,
    textAlign: 'center',
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sectionLabel: { ...typography.label, color: colors.textMuted },
  linkText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  pillRow: { paddingVertical: 4, paddingRight: spacing.lg },
  listCard: {
    marginBottom: spacing.sm,
  },
  emptySelection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  emptySelectionText: {
    flex: 1,
    ...typography.body,
    color: colors.textMuted,
    fontWeight: '600',
  },
  selectionPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  selectionChips: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  selChip: {
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    maxWidth: '100%',
  },
  selChipText: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '600',
  },
  selChipMore: {
    backgroundColor: colors.primary,
  },
  selChipMoreText: {
    ...typography.caption,
    color: colors.surface,
    fontWeight: '700',
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  pickerTitle: {
    ...typography.h3,
    color: colors.text,
  },
  pickerDone: {
    ...typography.bodyStrong,
    color: colors.primary,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surfaceMuted,
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radii.md,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    padding: 0,
  },
  pickerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  pickerCount: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '600',
  },
  pickerListContent: {
    paddingHorizontal: spacing.lg,
  },
  aiPromptBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  aiPromptInput: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    padding: 0,
    minHeight: 22,
    maxHeight: 100,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    gap: 12,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  rowSelected: {
    backgroundColor: colors.surfaceMuted,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  rowText: {
    flex: 1,
    ...typography.body,
    color: colors.text,
  },
  rowTextOn: {
    fontWeight: '700',
  },
  rowDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sourceLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.pill,
    marginBottom: spacing.sm,
  },
  sourceLinkText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '600',
  },
  centered: { alignItems: 'center', paddingVertical: spacing.xxxl },
  subText: { ...typography.body, color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center' },
  recipeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  recipeArt: {
    width: 84,
    height: 84,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recipeBody: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  recipeTitle: {
    ...typography.bodyStrong,
    fontSize: 16,
    color: colors.text,
    marginBottom: 6,
  },
  recipeMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaItemText: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '600',
  },
  metaMissing: {
    ...typography.caption,
    color: colors.warning,
    fontWeight: '600',
  },
  recipeArrow: {
    paddingRight: spacing.md,
  },

  modalContainer: { flex: 1, backgroundColor: colors.bg },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  modalCloseRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  modalClose: { ...typography.bodyStrong, color: colors.primary },
  bookmarkBtn: { padding: 4 },
  modalArt: {
    width: '100%',
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.lg,
    marginBottom: spacing.md,
  },
  modalBody: { padding: spacing.lg },
  modalTitle: { ...typography.h2, color: colors.text, marginBottom: spacing.xs },
  modalDesc: { ...typography.body, color: colors.textMuted, marginBottom: spacing.md, lineHeight: 21 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.sm },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.infoSoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  metaPillPrimary: { backgroundColor: '#CCFBF1' },
  metaPillText: { fontSize: 12, fontWeight: '700', color: '#075985' },
  ingItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    gap: 10,
  },
  ingItemDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  ingDotWrap: { width: 18, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  ingBullet: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.textSubtle },
  ingText: { ...typography.body, color: colors.text, flex: 1, lineHeight: 21 },
  ingInFridge: { color: colors.textSubtle, textDecorationLine: 'line-through' },
  ingQty: { fontWeight: '700', color: colors.text },
  ingUnit: { color: colors.textMuted },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  stepNumberBadge: {
    backgroundColor: colors.primary,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  stepNumber: { color: colors.surface, fontSize: 13, fontWeight: '700' },
  stepText: { flex: 1, ...typography.body, color: colors.text, lineHeight: 22 },

  refineHelp: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  refineInput: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    minHeight: 64,
    color: colors.text,
    ...typography.body,
    marginTop: spacing.sm,
  },
});

export default RecipeSuggestionsScreen;
