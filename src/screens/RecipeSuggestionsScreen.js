import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Modal,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFridge } from '../context/FridgeContext';
import { useShoppingList } from '../context/ShoppingListContext';
import { useLanguage } from '../i18n';
import { toEnglish } from '../utils/foodTranslations';
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
import { colors, radii, spacing, typography } from '../theme';

const SPOONACULAR_KEY = '43c1a58f7cdd4fd0bcaff787b5d5f8da';
const SPOONACULAR_BASE = 'https://api.spoonacular.com';
const FAMILY_SIZE_KEY = 'freezely_family_size';

const cleanIngredient = (name) => {
  const strip = [
    'frozen', 'fresh', 'cooked', 'raw', 'boneless', 'skinless',
    'sliced', 'diced', 'chopped', 'minced', 'ground', 'whole',
    'dried', 'canned', 'smoked', 'roasted', 'baked',
  ];
  let clean = toEnglish(name);
  strip.forEach((word) => { clean = clean.replace(new RegExp(`\\b${word}\\b`, 'g'), ''); });
  return clean.trim().replace(/\s+/g, ' ');
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

const getDaysUntilExpiry = (expiryDate) => {
  if (!expiryDate) return Infinity;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  return Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
};

const RecipeSuggestionsScreen = ({ navigation }) => {
  const { items, loadItems } = useFridge();
  const { addItem: addToShoppingList } = useShoppingList();
  const { t } = useLanguage();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedIngredients, setSelectedIngredients] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [recipeDetail, setRecipeDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [familySize, setFamilySize] = useState(4);
  const [hasSearched, setHasSearched] = useState(false);

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

  const ingredientList = React.useMemo(() => {
    const map = new Map();
    items.forEach((item) => {
      const existing = map.get(item.name);
      const days = getDaysUntilExpiry(item.expiry_date);
      if (!existing || days < existing.daysUntilExpiry) {
        map.set(item.name, { name: item.name, daysUntilExpiry: days });
      }
    });
    return [...map.values()].sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
  }, [items]);

  const toggleIngredient = (name) => {
    setSelectedIngredients((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  const selectExpiring = () => {
    const expiring = ingredientList.filter((i) => i.daysUntilExpiry <= 7).map((i) => i.name);
    setSelectedIngredients(expiring.length > 0 ? expiring : ingredientList.slice(0, 5).map((i) => i.name));
  };

  const searchRecipes = async () => {
    if (selectedIngredients.length === 0) return;
    setRecipes([]);
    setLoading(true);
    setHasSearched(true);
    const keywords = selectedIngredients.map(cleanIngredient).join(',');
    try {
      const res = await fetch(
        `${SPOONACULAR_BASE}/recipes/findByIngredients?ingredients=${encodeURIComponent(keywords)}&number=20&ranking=2&ignorePantry=true&apiKey=${SPOONACULAR_KEY}`
      );
      const data = await res.json();
      let results = Array.isArray(data) ? data : [];
      results.sort((a, b) => b.usedIngredientCount - a.usedIngredientCount);
      setRecipes(results);
    } catch {
      setRecipes([]);
    } finally {
      setLoading(false);
    }
  };

  const openRecipe = async (recipe) => {
    setSelectedRecipe(recipe);
    setRecipeDetail(null);
    setLoadingDetail(true);
    try {
      const res = await fetch(
        `${SPOONACULAR_BASE}/recipes/${recipe.id}/information?includeNutrition=false&apiKey=${SPOONACULAR_KEY}`
      );
      const data = await res.json();
      setRecipeDetail(data || null);
    } catch {
      setRecipeDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  const scaleFactor = recipeDetail ? familySize / (recipeDetail.servings || 4) : 1;

  const addMissingToShoppingList = async () => {
    if (!recipeDetail) return;
    const fridgeNames = new Set(items.map((i) => cleanIngredient(i.name)));
    const missing = (recipeDetail.extendedIngredients || []).filter((ing) => {
      const cleaned = cleanIngredient(ing.name);
      return ![...fridgeNames].some((f) => f.includes(cleaned) || cleaned.includes(f));
    });
    if (missing.length === 0) {
      Alert.alert(t('recipes.allInStock'), t('recipes.allInStockDesc'));
      return;
    }
    let added = 0;
    for (const ing of missing) {
      const scaledAmt = ing.amount ? ing.amount * scaleFactor : null;
      const qty = scaledAmt ? `${formatQty(scaledAmt)} ${ing.unit || ''}`.trim() : '';
      const result = await addToShoppingList(ing.name, qty);
      if (result.success) added++;
    }
    Alert.alert(t('recipes.addedToList'), t('recipes.addedToListDesc', { count: added }));
  };

  const steps = recipeDetail?.analyzedInstructions?.[0]?.steps || [];

  const fridgeNamesSet = React.useMemo(
    () => new Set(items.map((i) => cleanIngredient(i.name))),
    [items]
  );

  const isInFridge = (ingredientName) => {
    const cleaned = cleanIngredient(ingredientName);
    return [...fridgeNamesSet].some((f) => f.includes(cleaned) || cleaned.includes(f));
  };

  const setFamily = (n) => {
    const clamped = Math.min(20, Math.max(1, n));
    setFamilySize(clamped);
    AsyncStorage.setItem(FAMILY_SIZE_KEY, String(clamped));
  };

  return (
    <Screen>
      <ScreenHeader
        title={t('recipes.title')}
        onBack={() => navigation.goBack()}
        backLabel={t('common.back')}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <Card style={styles.familyCard}>
          <View style={styles.familyLabelRow}>
            <Icon name="people-outline" size={18} color={colors.text} />
            <Text style={styles.familyLabel}>{t('recipes.familySize')}</Text>
          </View>
          <View style={styles.familyStepper}>
            <TouchableOpacity style={styles.stepBtn} onPress={() => setFamily(familySize - 1)}>
              <Text style={styles.stepBtnText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.familyValue}>{familySize}</Text>
            <TouchableOpacity style={styles.stepBtn} onPress={() => setFamily(familySize + 1)}>
              <Text style={styles.stepBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        </Card>

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
              <TouchableOpacity onPress={selectExpiring} hitSlop={8}>
                <Text style={styles.linkText}>{t('recipes.selectExpiring')}</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.pillRow}
            >
              {ingredientList.map(({ name, daysUntilExpiry }) => {
                const isSelected = selectedIngredients.includes(name);
                const isExpiring = daysUntilExpiry <= 7;
                const isExpired = daysUntilExpiry < 0;
                return (
                  <View key={name} style={{ marginRight: 8 }}>
                    <Pill
                      label={name}
                      selected={isSelected}
                      onPress={() => toggleIngredient(name)}
                    />
                    {isExpiring && (
                      <Badge
                        tone={isExpired ? 'danger' : 'warning'}
                        style={{ marginTop: 4, alignSelf: 'center' }}
                      >
                        {isExpired ? t('recipes.expired') : t('recipes.daysLeft', { count: daysUntilExpiry })}
                      </Badge>
                    )}
                  </View>
                );
              })}
            </ScrollView>

            {selectedIngredients.length > 0 && (
              <PrimaryButton
                title={t('recipes.findRecipes', { count: selectedIngredients.length })}
                onPress={searchRecipes}
                style={{ marginTop: spacing.md, marginBottom: spacing.sm }}
              />
            )}

            {loading && (
              <View style={styles.centered}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.subText}>{t('recipes.findingRecipes')}</Text>
              </View>
            )}

            {!loading && hasSearched && recipes.length === 0 && (
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
                {recipes.map((recipe) => (
                  <TouchableOpacity
                    key={recipe.id}
                    onPress={() => openRecipe(recipe)}
                    activeOpacity={0.85}
                  >
                    <Card style={styles.recipeCard} padded={false}>
                      <Image source={{ uri: recipe.image }} style={styles.recipeImage} resizeMode="cover" />
                      <View style={styles.recipeInfo}>
                        <Text style={styles.recipeName} numberOfLines={2}>{recipe.title}</Text>
                        <View style={styles.matchRow}>
                          <Badge tone="success">
                            {t('recipes.ingredientsMatched', { count: recipe.usedIngredientCount })}
                          </Badge>
                          {recipe.missedIngredientCount > 0 && (
                            <Badge tone="warning">
                              +{recipe.missedIngredientCount} {t('recipes.missing')}
                            </Badge>
                          )}
                        </View>
                        <Text style={styles.recipeHint}>{t('recipes.tapToView')} →</Text>
                      </View>
                    </Card>
                  </TouchableOpacity>
                ))}
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
        <View style={{ height: spacing.xxxl }} />
      </ScrollView>

      <Modal
        visible={!!selectedRecipe}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedRecipe(null)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setSelectedRecipe(null)}
              hitSlop={8}
              style={styles.modalCloseRow}
            >
              <Icon name="close" size={20} color={colors.primary} />
              <Text style={styles.modalClose}>{t('recipes.close')}</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {selectedRecipe?.image && (
              <Image source={{ uri: selectedRecipe.image }} style={styles.modalImage} resizeMode="cover" />
            )}

            {loadingDetail ? (
              <View style={styles.centered}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.subText}>{t('recipes.loadingRecipe')}</Text>
              </View>
            ) : recipeDetail ? (
              <View style={styles.modalBody}>
                <Text style={styles.modalTitle}>{recipeDetail.title}</Text>

                <View style={styles.metaRow}>
                  {recipeDetail.readyInMinutes > 0 && (
                    <View style={styles.metaPill}>
                      <Icon name="time-outline" size={13} color="#075985" />
                      <Text style={styles.metaPillText}>{recipeDetail.readyInMinutes} min</Text>
                    </View>
                  )}
                  <View style={[styles.metaPill, styles.metaPillPrimary]}>
                    <Icon name="people-outline" size={13} color="#0F766E" />
                    <Text style={[styles.metaPillText, { color: '#0F766E' }]}>
                      {t('recipes.serves', { from: recipeDetail.servings, to: familySize })}
                      {scaleFactor !== 1 ? `  (×${scaleFactor % 1 === 0 ? scaleFactor : scaleFactor.toFixed(1)})` : ''}
                    </Text>
                  </View>
                </View>

                <PrimaryButton
                  title={t('recipes.addMissingToList')}
                  icon={<Icon name="cart-outline" size={16} color={colors.surface} />}
                  onPress={addMissingToShoppingList}
                  style={{ marginTop: spacing.md }}
                />

                <SectionTitle>{t('recipes.ingredients')}</SectionTitle>
                <Card padded={false}>
                  {(recipeDetail.extendedIngredients || []).map((ing, idx) => {
                    const scaledAmt = ing.amount ? ing.amount * scaleFactor : null;
                    const inFridge = isInFridge(ing.name);
                    return (
                      <View key={idx} style={[styles.ingItem, idx > 0 && styles.ingItemDivider]}>
                        <View style={styles.ingDotWrap}>
                          {inFridge
                            ? <Icon name="checkmark-circle" size={16} color={colors.primary} />
                            : <View style={styles.ingBullet} />}
                        </View>
                        <Text style={[styles.ingText, inFridge && styles.ingInFridge]}>
                          {scaledAmt ? <Text style={styles.ingQty}>{formatQty(scaledAmt)} </Text> : null}
                          {ing.unit ? <Text style={styles.ingUnit}>{ing.unit} </Text> : null}
                          {ing.name}
                        </Text>
                      </View>
                    );
                  })}
                </Card>

                {steps.length > 0 && (
                  <>
                    <SectionTitle>{t('recipes.instructions')}</SectionTitle>
                    <View style={{ gap: spacing.md }}>
                      {steps.map((step) => (
                        <View key={step.number} style={styles.step}>
                          <View style={styles.stepNumberBadge}>
                            <Text style={styles.stepNumber}>{step.number}</Text>
                          </View>
                          <Text style={styles.stepText}>{step.step}</Text>
                        </View>
                      ))}
                    </View>
                  </>
                )}
              </View>
            ) : (
              <EmptyState description={t('recipes.couldNotLoad')} />
            )}
            <View style={{ height: spacing.xxxl }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  familyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  familyLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  familyLabel: {
    ...typography.bodyStrong,
    color: colors.text,
  },
  familyStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  familyValue: {
    ...typography.h3,
    color: colors.primary,
    minWidth: 26,
    textAlign: 'center',
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sectionLabel: {
    ...typography.label,
    color: colors.textMuted,
  },
  linkText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  pillRow: {
    paddingVertical: 4,
    paddingRight: spacing.lg,
  },
  centered: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
  },
  subText: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  recipeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  recipeImage: {
    width: 96,
    height: 96,
  },
  recipeInfo: {
    flex: 1,
    padding: spacing.md,
  },
  recipeName: {
    ...typography.bodyStrong,
    color: colors.text,
    marginBottom: 6,
  },
  matchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  recipeHint: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },

  modalContainer: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  modalHeader: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  modalCloseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modalClose: {
    ...typography.bodyStrong,
    color: colors.primary,
  },
  modalImage: {
    width: '100%',
    height: 220,
  },
  modalBody: {
    padding: spacing.lg,
  },
  modalTitle: {
    ...typography.h2,
    color: colors.text,
    marginBottom: spacing.md,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: spacing.sm,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.infoSoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  metaPillPrimary: {
    backgroundColor: '#CCFBF1',
  },
  metaPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#075985',
  },
  ingItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    gap: 10,
  },
  ingItemDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  ingDotWrap: {
    width: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  ingBullet: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.textSubtle,
  },
  ingText: {
    ...typography.body,
    color: colors.text,
    flex: 1,
    lineHeight: 21,
  },
  ingInFridge: {
    color: colors.textSubtle,
    textDecorationLine: 'line-through',
  },
  ingQty: {
    fontWeight: '700',
    color: colors.text,
  },
  ingUnit: {
    color: colors.textMuted,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
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
  stepNumber: {
    color: colors.surface,
    fontSize: 13,
    fontWeight: '700',
  },
  stepText: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    lineHeight: 22,
  },
});

export default RecipeSuggestionsScreen;
