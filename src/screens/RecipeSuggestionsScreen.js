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
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../config/supabase';
import { useFridge } from '../context/FridgeContext';
import { useShoppingList } from '../context/ShoppingListContext';
import { useSavedRecipes } from '../context/SavedRecipesContext';
import { usePremium } from '../context/PremiumContext';
import { useLanguage } from '../i18n';
import {
  Screen,
  ScreenHeader,
  IconButton,
  Card,
  Icon,
  Pill,
  Badge,
  PrimaryButton,
  SectionTitle,
  EmptyState,
  OptionSheet,
} from '../components/ui';
import PaywallModal from '../components/PaywallModal';
import ScannedRecipeModal from '../components/ScannedRecipeModal';
import {
  formatQty,
  MAX_SCAN_PAGES,
  matchRecipeToInventory,
  matchStats,
  prepareScanImage,
  scanRecipeImages,
} from '../utils/scanRecipe';
import { colors, gradients, radii, shadows, spacing, typography } from '../theme';
import useAdaptiveLayout from '../hooks/useAdaptiveLayout';
import Grid from '../components/ui/Grid';
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

// Pantry staples (salt, oil, flour…) are assumed to be at home: they don't
// count as missing and don't go on the shopping list.
const ingredientStats = (ingredients = []) => {
  const counted = ingredients.filter((i) => !i.pantry);
  const matched = counted.filter((i) => i.inFridge).length;
  const total = counted.length;
  const missing = total - matched;
  return { matched, total, missing, allMatched: total > 0 && missing === 0 };
};


const RecipeSuggestionsScreen = ({ navigation }) => {
  const { items, loadItems } = useFridge();
  const { items: shoppingItems, addItem: addToShoppingList } = useShoppingList();
  const { savedRecipes, saveRecipe, updateRecipe, unsaveRecipe, dbRowToRecipe } = useSavedRecipes();
  const { isPremium } = usePremium();
  const { getDaysUntilExpiry: getItemDaysUntilExpiry } = useFridgeExpiry();
  const { t, locale } = useLanguage();
  // Recipe cards go two-up on the iPhone Duo inner screen / iPad.
  const { columns, frame, isExpanded } = useAdaptiveLayout();

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

  // Recipe scanning (Pro): photo of a cookbook page / printout / card → AI
  // reads it → saved to the household cookbook as a 'scan' recipe.
  const [scanSourceOpen, setScanSourceOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [scannedOpenId, setScannedOpenId] = useState(null);

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
      // Provider errors are for us, not the user. Log the detail, show a
      // message they can act on.
      console.warn('[generate-recipes] invoke error' + status + ':', detail);
      throw new Error(t('recipes.generateFailed'));
    }
    if (data?.error) {
      console.warn('[generate-recipes] error:', data.error);
      throw new Error(t('recipes.generateFailed'));
    }
    return data?.recipes || [];
  };

  const searchRecipes = async () => {
    const trimmedPrompt = aiPrompt.trim();
    if (selectedIngredients.length === 0 && !trimmedPrompt) return;
    // Searching again means "show me something else", so tell the AI what
    // it already suggested.
    const excludeTitles = recipes.map((r) => r.title).filter(Boolean);
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
        excludeTitles: excludeTitles.length ? excludeTitles : undefined,
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
    const missing = (selectedRecipe.ingredients || []).filter(
      (ing) => !ing.inFridge && !ing.pantry
    );
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
  // a name match against the current fridge so the modal shows accurate
  // strikethroughs after items get eaten / replenished. Newer recipes know
  // exactly which item they matched (fridgeItem); older ones fall back to a
  // loose match on the ingredient name.
  const recipeWithLiveInFridge = (recipe) => {
    if (!recipe) return recipe;
    const fridgeNames = items.map((i) => (i.name || '').toLowerCase());
    const updatedIngredients = (recipe.ingredients || []).map((ing) => {
      if ('fridgeItem' in ing) {
        // null means the AI found no matching item when the recipe was made
        // (e.g. salt, or "peber" which is not "peberfrugt").
        const inFridge =
          !!ing.fridgeItem && fridgeNames.includes(ing.fridgeItem.toLowerCase());
        return { ...ing, inFridge };
      }
      const n = (ing.name || '').toLowerCase();
      // Short names ("is", "æg") would substring-match half the freezer.
      const inFridge = fridgeNames.some(
        (f) => f === n || (f.length >= 4 && n.length >= 4 && (f.includes(n) || n.includes(f)))
      );
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

  // ---------- Recipe scanning ----------

  const startScan = () => {
    if (!isPremium) {
      setPaywallVisible(true);
      return;
    }
    setScanSourceOpen(true);
  };

  // Resolves true for "add another page", false for "read it now".
  const askAnotherPage = (count) =>
    new Promise((resolve) => {
      Alert.alert(
        t('recipeScan.pageTaken', { count }),
        t('recipeScan.anotherPageDesc'),
        [
          { text: t('recipeScan.addPage'), onPress: () => resolve(true) },
          { text: t('recipeScan.readNow'), style: 'cancel', onPress: () => resolve(false) },
        ],
        { cancelable: true, onDismiss: () => resolve(false) }
      );
    });

  // Recipes often run over two pages: keep taking photos until the user
  // says that's all (Groq's vision model reads at most three).
  const scanFromCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t('scan.cameraDenied'));
      return;
    }
    const uris = [];
    while (uris.length < MAX_SCAN_PAGES) {
      const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
      if (result.canceled || !result.assets?.[0]?.uri) break;
      uris.push(result.assets[0].uri);
      if (uris.length >= MAX_SCAN_PAGES || !(await askAnotherPage(uris.length))) break;
    }
    if (uris.length) await runScan(uris);
  };

  const scanFromLibrary = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_SCAN_PAGES,
      orderedSelection: true,
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.length) return;
    await runScan(result.assets.slice(0, MAX_SCAN_PAGES).map((a) => a.uri));
  };

  const onScanSource = (source) => {
    setScanSourceOpen(false);
    // Let the sheet's fade finish before the camera/picker presents on iOS.
    setTimeout(() => (source === 'camera' ? scanFromCamera() : scanFromLibrary()), 350);
  };

  const runScan = async (uris) => {
    setScanning(true);
    try {
      const images = [];
      for (const uri of uris) images.push(await prepareScanImage(uri));
      const res = await scanRecipeImages(images, { locale, inventory: allItemNames });
      if (!res.ok) {
        const msg =
          res.reason === 'notFound'
            ? t('recipeScan.notFoundDesc')
            : res.reason === 'limit'
            ? t('recipeScan.limitReached', { limit: res.limit ?? 10 })
            : t('recipeScan.failedDesc');
        setScanning(false);
        Alert.alert(t('recipeScan.notFoundTitle'), msg);
        return;
      }
      const saved = await saveRecipe(res.recipe);
      setScanning(false);
      if (!saved.success) {
        Alert.alert(t('common.error'), t('recipeScan.saveFailed'));
        return;
      }
      setActiveTab('saved');
      // iOS won't present the recipe sheet while the "Reading…" overlay is
      // still fading out, so open it once that's done.
      setTimeout(() => setScannedOpenId(saved.row.id), 400);
    } catch (e) {
      console.warn('[scan-recipe] runScan failed:', e?.message);
      setScanning(false);
      Alert.alert(t('recipeScan.notFoundTitle'), t('recipeScan.failedDesc'));
    }
  };

  const scannedOpen = useMemo(
    () => (scannedOpenId ? savedAsRecipes.find((r) => r.id === scannedOpenId) || null : null),
    [scannedOpenId, savedAsRecipes]
  );

  const deleteScanned = async () => {
    const id = scannedOpenId;
    setScannedOpenId(null);
    if (id) await unsaveRecipe(id);
  };

  const QUICK_REFINES = [
    t('recipes.refineVegetarian'),
    t('recipes.refineFaster'),
    t('recipes.refineNoOven'),
    t('recipes.refineSpicy'),
    t('recipes.refineKidFriendly'),
  ];

  const twoPane = isExpanded && activeTab === 'discover' && ingredientList.length > 0;

  // Discover-tab blocks, defined once so the same JSX renders either stacked
  // in one scroll (phones, Duo outer screen, Duo inner portrait) or split into
  // two panes on wide windows (Duo inner landscape, iPad): what you cook with
  // on the left, what comes back on the right, each scrolling on its own.
  const familyRowEl = (
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
    </>
  );

  const discoverControls = (
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
    </>
  );

  const discoverResults = (
    <>
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
          <Grid columns={twoPane ? 1 : columns} gap={spacing.md} rowGap={0}>
          {recipes.map((recipe, idx) => {
            const { matched, total, missing, allMatched } = ingredientStats(recipe.ingredients);
            return (
              <TouchableOpacity
                key={idx}
                onPress={() => setSelectedRecipeIdx(idx)}
                style={styles.gridItem}
                activeOpacity={0.85}
              >
                <Card style={[styles.recipeCard, styles.gridItem]} padded={false}>
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
          </Grid>
        </>
      )}

      {/* Two panes: the results pane would otherwise sit empty until the
          first search, so it says what will land there and points left. */}
      {twoPane && !hasSearched && !loading && (
        <EmptyState
          icon="restaurant-outline"
          title={t('recipes.resultsPaneTitle')}
          description={t('recipes.selectIngredientsLeft')}
        />
      )}

      {!twoPane && !hasSearched && selectedIngredients.length === 0 && (
        <View style={styles.centered}>
          <Icon name="hand-left-outline" size={32} color={colors.textMuted} />
          <Text style={styles.subText}>{t('recipes.selectIngredients')}</Text>
        </View>
      )}
    </>
  );

  return (
    <Screen>
      <ScreenHeader
        title={t('recipes.title')}
        // iOS uses the native tab bar, which can't show the BETA chip the
        // Android tab bar has (see AppNavigator), so it lives here instead.
        subtitle={Platform.OS === 'ios' ? 'BETA' : undefined}
        right={
          <IconButton
            name="calendar-outline"
            variant="onHero"
            size={40}
            onPress={() => navigation.navigate('MealPlan')}
            accessibilityLabel={t('mealPlan.title')}
          />
        }
      />

      <View style={frame}>
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
      </View>

      {twoPane ? (
        <View style={[styles.panes, frame]}>
          <ScrollView
            style={styles.paneLeft}
            contentContainerStyle={styles.paneContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {familyRowEl}
            {discoverControls}
          </ScrollView>
          <ScrollView
            style={styles.paneRight}
            contentContainerStyle={styles.paneContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
            }
          >
            {discoverResults}
          </ScrollView>
        </View>
      ) : (
      <ScrollView
        contentContainerStyle={[styles.content, frame]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {activeTab === 'saved' && (
          <TouchableOpacity
            style={styles.scanCard}
            onPress={startScan}
            activeOpacity={0.8}
            accessibilityRole="button"
          >
            <View style={styles.scanIcon}>
              <Icon name="camera-outline" size={22} color={colors.primaryDark} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.scanTitleRow}>
                <Text style={styles.scanTitle}>{t('recipeScan.cta')}</Text>
                {!isPremium && (
                  <View style={styles.proTag}>
                    <Text style={styles.proTagText}>PRO</Text>
                  </View>
                )}
              </View>
              <Text style={styles.scanSub}>{t('recipeScan.ctaDesc')}</Text>
            </View>
            <Icon name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
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
              <Grid columns={twoPane ? 1 : columns} gap={spacing.md} rowGap={0}>
              {savedAsRecipes.map((recipe, idx) => {
                // Re-compute inFridge against the current fridge so badges are
                // accurate even if the recipe was saved a week ago.
                // Scanned recipes use the same check their detail view shows.
                const isScan = recipe.source === 'scan';
                const live = isScan ? null : recipeWithLiveInFridge(recipe);
                const { matched, total, missing } = isScan
                  ? matchStats(matchRecipeToInventory(recipe.ingredients, items, shoppingItems))
                  : ingredientStats(live.ingredients);
                const allMatched = total > 0 && missing === 0;
                return (
                  <TouchableOpacity
                    key={recipe.id || idx}
                    onPress={() => (isScan ? setScannedOpenId(recipe.id) : setSelectedRecipeIdx(idx))}
                    style={styles.gridItem}
                    activeOpacity={0.85}
                  >
                    <Card style={[styles.recipeCard, styles.gridItem]} padded={false}>
                      <LinearGradient
                        colors={gradients.hero}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.recipeArt}
                      >
                        <Icon
                          name={isScan ? 'document-text-outline' : iconForRecipe(recipe.title)}
                          size={32}
                          color={colors.surface}
                        />
                      </LinearGradient>
                      <View style={styles.recipeBody}>
                        <Text style={styles.recipeTitle} numberOfLines={2}>
                          {recipe.title}
                        </Text>
                        <View style={styles.recipeMetaRow}>
                          {isScan ? <Badge tone="primary">{t('recipeScan.scannedBadge')}</Badge> : null}
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
              </Grid>
            </>
          )
        ) : (
        <>
        {familyRowEl}
        {ingredientList.length === 0 ? (
          <EmptyState
            icon="restaurant-outline"
            title={t('recipes.noItems')}
            description={t('recipes.addItemsToDiscover')}
          />
        ) : (
          <>
            {discoverControls}
            {discoverResults}
          </>
        )}
        </>
        )}
        <View style={{ height: spacing.xxxl }} />
      </ScrollView>
      )}

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
                        ) : ing.pantry ? (
                          <Icon name="home-outline" size={14} color={colors.textSubtle} />
                        ) : (
                          <View style={styles.ingBullet} />
                        )}
                      </View>
                      <Text style={[styles.ingText, ing.inFridge && styles.ingInFridge]}>
                        {ing.amount ? <Text style={styles.ingQty}>{formatQty(ing.amount)} </Text> : null}
                        {ing.unit ? <Text style={styles.ingUnit}>{ing.unit} </Text> : null}
                        {ing.name}
                        {ing.pantry && !ing.inFridge ? (
                          <Text style={styles.ingPantry}>{`  ·  ${t('recipes.pantryStaple')}`}</Text>
                        ) : null}
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

      <OptionSheet
        visible={scanSourceOpen}
        title={t('recipeScan.sourceTitle')}
        help={t('recipeScan.sourceHelp')}
        options={[
          {
            value: 'camera',
            label: t('recipeScan.takePhoto'),
            icon: <Icon name="camera-outline" size={20} color={colors.primary} />,
          },
          {
            value: 'library',
            label: t('recipeScan.choosePhotos'),
            hint: t('recipeScan.choosePhotosHint', { count: MAX_SCAN_PAGES }),
            icon: <Icon name="images-outline" size={20} color={colors.primary} />,
          },
        ]}
        onSelect={onScanSource}
        onClose={() => setScanSourceOpen(false)}
      />

      <ScannedRecipeModal
        recipe={scannedOpen}
        visible={!!scannedOpen}
        onClose={() => setScannedOpenId(null)}
        onDelete={deleteScanned}
        onSave={async (changes) => (await updateRecipe(scannedOpenId, changes)).success}
      />

      <PaywallModal visible={paywallVisible} onClose={() => setPaywallVisible(false)} />

      <Modal visible={scanning} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.analyzeOverlay}>
          <View style={styles.analyzeCard}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.analyzeText}>{t('recipeScan.reading')}</Text>
            <Text style={styles.analyzeSub}>{t('recipeScan.readingHint')}</Text>
          </View>
        </View>
      </Modal>
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.lg },
  panes: { flex: 1, flexDirection: 'row' },
  // Controls column: fixed reading width so chips and the prompt don't
  // stretch; results take the rest of the window.
  paneLeft: { width: 380, flexGrow: 0, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: colors.border },
  paneRight: { flex: 1 },
  paneContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxxl },
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
  gridItem: { flexGrow: 1 },
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
  ingPantry: { ...typography.caption, color: colors.textSubtle },
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

  // Scan-a-recipe entry on the Saved tab (same card language as the
  // ingredient picker row; PRO tag as on Add Item's autofill buttons).
  scanCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  scanIcon: {
    width: 42,
    height: 42,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  scanTitle: { ...typography.bodyStrong, color: colors.text },
  scanSub: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  proTag: {
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  proTagText: { color: colors.surface, fontSize: 9, fontWeight: '800', letterSpacing: 0.4 },
  analyzeOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  analyzeCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xxl,
    alignItems: 'center',
    gap: spacing.md,
    maxWidth: 320,
  },
  analyzeText: { ...typography.bodyStrong, color: colors.text },
  analyzeSub: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },

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
