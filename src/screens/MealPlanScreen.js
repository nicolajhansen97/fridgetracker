import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Pressable,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { supabase } from '../config/supabase';
import { useFridge } from '../context/FridgeContext';
import { useMealPlan, ymd } from '../context/MealPlanContext';
import { useSavedRecipes } from '../context/SavedRecipesContext';
import { useShoppingList } from '../context/ShoppingListContext';
import { useLanguage } from '../i18n';
import { useFridgeExpiry } from '../hooks/useFridgeExpiry';
import {
  Screen,
  ScreenHeader,
  Card,
  Icon,
  Badge,
  EmptyState,
  PrimaryButton,
} from '../components/ui';
import { colors, radii, spacing, typography } from '../theme';

// How far ahead an item can expire and still count as "worth planning around".
// A week matches the planner's own horizon: anything later can wait for next
// week's plan.
const EXPIRING_WINDOW_DAYS = 7;

const startOfWeek = (d) => {
  const copy = new Date(d);
  // Monday-first. getDay() is 0=Sunday, so Sunday has to walk back six days
  // rather than zero.
  const dow = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - dow);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const MealPlanScreen = ({ navigation }) => {
  const { t, formatDate, locale } = useLanguage();
  const { items } = useFridge();
  const { byDate, setMeal, clearMeal, loading, reload } = useMealPlan();
  const { savedRecipes, dbRowToRecipe } = useSavedRecipes();
  const { addItem: addShoppingItem } = useShoppingList();
  const { getDaysUntilExpiry } = useFridgeExpiry();

  const [weekOffset, setWeekOffset] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  // The day currently being planned, or null when the sheet is closed.
  const [planningDate, setPlanningDate] = useState(null);
  const [mode, setMode] = useState('choose'); // choose | cookbook | manual | generated
  const [manualTitle, setManualTitle] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState([]);
  const [addingToList, setAddingToList] = useState(false);

  const weekStart = useMemo(() => {
    const base = startOfWeek(new Date());
    base.setDate(base.getDate() + weekOffset * 7);
    return base;
  }, [weekOffset]);

  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        return d;
      }),
    [weekStart]
  );

  const todayKey = ymd(new Date());

  // Items worth cooking soon, soonest first. This is the list the planner
  // exists to work through, so it drives both the banner and what the AI is
  // asked to build meals around.
  const expiringSoon = useMemo(() => {
    return (items || [])
      .map((it) => ({ item: it, days: getDaysUntilExpiry(it) }))
      .filter((x) => x.days != null && isFinite(x.days) && x.days <= EXPIRING_WINDOW_DAYS)
      .sort((a, b) => a.days - b.days);
  }, [items, getDaysUntilExpiry]);

  const weekDayLabel = useCallback(
    (d) => d.toLocaleDateString(locale, { weekday: 'short' }),
    [locale]
  );

  const weekRangeLabel = useMemo(() => {
    const end = new Date(weekStart);
    end.setDate(weekStart.getDate() + 6);
    return `${formatDate(ymd(weekStart))} - ${formatDate(ymd(end))}`;
  }, [weekStart, formatDate]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await reload();
    } finally {
      setRefreshing(false);
    }
  };

  // -- Planning a day --------------------------------------------------

  const openPlanner = (date) => {
    setPlanningDate(date);
    setMode('choose');
    setManualTitle('');
    setGenerated([]);
  };

  const closePlanner = () => {
    setPlanningDate(null);
    setGenerated([]);
    setManualTitle('');
  };

  const commit = async (payload) => {
    const res = await setMeal(planningDate, payload);
    if (!res.success) {
      Alert.alert(t('common.error'), res.error);
      return;
    }
    closePlanner();
  };

  const planFromRecipe = (recipe, source) =>
    commit({
      title: recipe.title,
      recipe,
      source,
      // Record which expiring items this meal was chosen to use up, so the day
      // card can keep crediting it after the AI response is long gone.
      sourceItemIds: expiringSoon
        .filter((x) =>
          (recipe.ingredients || []).some((ing) =>
            (ing.name || '').toLowerCase().includes((x.item.name || '').toLowerCase())
          )
        )
        .map((x) => x.item.id),
    });

  const generateForDay = async () => {
    setGenerating(true);
    setMode('generated');
    try {
      const mustUse = expiringSoon.slice(0, 5).map((x) => x.item.name);
      const others = (items || [])
        .map((i) => i.name)
        .filter((n) => !mustUse.includes(n))
        .slice(0, 40);

      const { data, error } = await supabase.functions.invoke('generate-recipes', {
        body: { mustUseItems: mustUse, otherFridgeItems: others, familySize: 4, locale },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setGenerated(data?.recipes || []);
    } catch (e) {
      // The generator is rate-limited per day and can fail upstream. Say so and
      // drop back to the menu rather than leaving a dead spinner.
      Alert.alert(t('mealPlan.generateFailed'), e?.message || '');
      setMode('choose');
    } finally {
      setGenerating(false);
    }
  };

  // -- Shopping list ---------------------------------------------------

  // Everything this week's meals call for that the AI did not mark as already
  // in the fridge, de-duplicated by name. Nothing is added silently: the user
  // confirms the count first.
  const missingIngredients = useMemo(() => {
    const seen = new Map();
    for (const d of days) {
      const plan = byDate[ymd(d)];
      const ingredients = plan?.recipe?.ingredients || [];
      for (const ing of ingredients) {
        if (ing.inFridge) continue;
        const key = (ing.name || '').trim().toLowerCase();
        if (!key || seen.has(key)) continue;
        seen.set(key, ing);
      }
    }
    return [...seen.values()];
  }, [days, byDate]);

  const addMissingToList = () => {
    if (missingIngredients.length === 0) return;
    Alert.alert(
      t('mealPlan.addMissingTitle'),
      t('mealPlan.addMissingBody', { count: missingIngredients.length }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('mealPlan.addMissingConfirm'),
          onPress: async () => {
            setAddingToList(true);
            try {
              for (const ing of missingIngredients) {
                const qty = [ing.amount, ing.unit].filter(Boolean).join(' ');
                await addShoppingItem(ing.name, qty);
              }
            } finally {
              setAddingToList(false);
            }
          },
        },
      ]
    );
  };

  // -- Render ----------------------------------------------------------

  const cookbook = useMemo(() => savedRecipes.map(dbRowToRecipe), [savedRecipes, dbRowToRecipe]);

  const renderDay = (d) => {
    const key = ymd(d);
    const plan = byDate[key];
    const isToday = key === todayKey;
    const isPast = key < todayKey;

    // Only count source items that are still in the freezer - once they are
    // eaten or thrown, the meal no longer "uses up" anything.
    const stillUses = plan?.source_item_ids
      ? plan.source_item_ids.filter((id) => (items || []).some((it) => it.id === id)).length
      : 0;

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => openPlanner(key)}
        style={[styles.dayRow, isPast && styles.dayPast]}
      >
        <View style={[styles.dayBadge, isToday && styles.dayBadgeToday]}>
          <Text style={[styles.dayName, isToday && styles.dayNameToday]}>{weekDayLabel(d)}</Text>
          <Text style={[styles.dayNum, isToday && styles.dayNumToday]}>{d.getDate()}</Text>
        </View>

        <View style={styles.dayMain}>
          {plan ? (
            <>
              <Text style={styles.mealTitle} numberOfLines={2}>{plan.title}</Text>
              <View style={styles.mealMeta}>
                {plan.recipe?.totalMinutes ? (
                  <Text style={styles.mealMetaText}>
                    {t('mealPlan.minutes', { count: plan.recipe.totalMinutes })}
                  </Text>
                ) : null}
                {stillUses > 0 ? (
                  <Badge tone="warning">{t('mealPlan.usesExpiring', { count: stillUses })}</Badge>
                ) : null}
              </View>
            </>
          ) : (
            <Text style={styles.dayEmpty}>{t('mealPlan.planThisDay')}</Text>
          )}
        </View>

        {plan ? (
          <TouchableOpacity
            hitSlop={10}
            onPress={() => clearMeal(key)}
            style={styles.clearBtn}
            accessibilityRole="button"
            accessibilityLabel={t('mealPlan.clearDay')}
          >
            <Icon name="close" size={18} color={colors.textSubtle} />
          </TouchableOpacity>
        ) : (
          <Icon name="add" size={20} color={colors.primary} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Screen>
      <ScreenHeader
        title={t('mealPlan.title')}
        subtitle={weekRangeLabel}
        onBack={() => navigation.goBack()}
        backLabel={t('common.back')}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Week switcher */}
        <View style={styles.weekNav}>
          <TouchableOpacity
            onPress={() => setWeekOffset((w) => w - 1)}
            hitSlop={12}
            style={styles.weekNavBtn}
            accessibilityRole="button"
            accessibilityLabel={t('mealPlan.prevWeek')}
          >
            <Icon name="chevron-back" size={20} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setWeekOffset(0)} activeOpacity={0.7}>
            <Text style={styles.weekLabel}>
              {weekOffset === 0 ? t('mealPlan.thisWeek') : weekRangeLabel}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setWeekOffset((w) => w + 1)}
            hitSlop={12}
            style={styles.weekNavBtn}
            accessibilityRole="button"
            accessibilityLabel={t('mealPlan.nextWeek')}
          >
            <Icon name="chevron-forward" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* What the week should be built around */}
        {expiringSoon.length > 0 && (
          <Card style={styles.expiringCard}>
            <View style={styles.expiringHead}>
              <Icon name="time-outline" size={18} color={colors.warning} />
              <Text style={styles.expiringTitle}>
                {t('mealPlan.expiringCount', { count: expiringSoon.length })}
              </Text>
            </View>
            <Text style={styles.expiringNames} numberOfLines={2}>
              {expiringSoon.slice(0, 6).map((x) => x.item.name).join('  ·  ')}
            </Text>
          </Card>
        )}

        {loading && !refreshing ? (
          <ActivityIndicator style={styles.loader} color={colors.primary} />
        ) : (
          <Card padded={false} style={styles.weekCard}>
            {days.map((d, i) => (
              <View key={ymd(d)}>
                {i > 0 && <View style={styles.divider} />}
                {renderDay(d)}
              </View>
            ))}
          </Card>
        )}

        {missingIngredients.length > 0 && (
          <PrimaryButton
            title={t('mealPlan.addMissing', { count: missingIngredients.length })}
            onPress={addMissingToList}
            loading={addingToList}
            style={styles.addMissingBtn}
          />
        )}

        {Object.keys(byDate).length === 0 && expiringSoon.length === 0 && (
          <EmptyState
            icon="calendar-outline"
            title={t('mealPlan.emptyTitle')}
            description={t('mealPlan.emptyDesc')}
          />
        )}
      </ScrollView>

      {/* Planner sheet */}
      <Modal
        visible={planningDate !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={closePlanner}
      >
        <Pressable style={styles.backdrop} onPress={closePlanner}>
          <Pressable style={styles.sheet}>
            <Text style={styles.sheetTitle}>{planningDate ? formatDate(planningDate) : ''}</Text>

            {mode === 'choose' && (
              <>
                <TouchableOpacity style={styles.optRow} onPress={generateForDay} activeOpacity={0.7}>
                  <Icon name="sparkles-outline" size={20} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optLabel}>{t('mealPlan.optionGenerate')}</Text>
                    <Text style={styles.optHint}>
                      {expiringSoon.length > 0
                        ? t('mealPlan.optionGenerateHint', { count: expiringSoon.length })
                        : t('mealPlan.optionGenerateHintEmpty')}
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.optRow}
                  onPress={() => setMode('cookbook')}
                  activeOpacity={0.7}
                  disabled={cookbook.length === 0}
                >
                  <Icon
                    name="bookmark-outline"
                    size={20}
                    color={cookbook.length ? colors.primary : colors.textSubtle}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.optLabel, !cookbook.length && styles.optDisabled]}>
                      {t('mealPlan.optionCookbook')}
                    </Text>
                    <Text style={styles.optHint}>
                      {cookbook.length > 0
                        ? t('mealPlan.optionCookbookHint', { count: cookbook.length })
                        : t('mealPlan.optionCookbookEmpty')}
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.optRow}
                  onPress={() => setMode('manual')}
                  activeOpacity={0.7}
                >
                  <Icon name="create-outline" size={20} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optLabel}>{t('mealPlan.optionManual')}</Text>
                    <Text style={styles.optHint}>{t('mealPlan.optionManualHint')}</Text>
                  </View>
                </TouchableOpacity>
              </>
            )}

            {mode === 'manual' && (
              <View>
                <TextInput
                  style={styles.manualInput}
                  value={manualTitle}
                  onChangeText={setManualTitle}
                  placeholder={t('mealPlan.manualPlaceholder')}
                  placeholderTextColor={colors.textSubtle}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={() =>
                    manualTitle.trim() && commit({ title: manualTitle, source: 'manual' })
                  }
                />
                <PrimaryButton
                  title={t('common.save')}
                  onPress={() => commit({ title: manualTitle, source: 'manual' })}
                  disabled={!manualTitle.trim()}
                  style={styles.sheetBtn}
                />
              </View>
            )}

            {mode === 'cookbook' && (
              <ScrollView style={styles.sheetScroll}>
                {cookbook.map((r) => (
                  <TouchableOpacity
                    key={r.id}
                    style={styles.optRow}
                    onPress={() => planFromRecipe(r, 'saved')}
                    activeOpacity={0.7}
                  >
                    <Icon name="restaurant-outline" size={18} color={colors.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.optLabel} numberOfLines={1}>{r.title}</Text>
                      {r.totalMinutes ? (
                        <Text style={styles.optHint}>
                          {t('mealPlan.minutes', { count: r.totalMinutes })}
                        </Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {mode === 'generated' &&
              (generating ? (
                <View style={styles.generating}>
                  <ActivityIndicator color={colors.primary} />
                  <Text style={styles.generatingText}>{t('mealPlan.generating')}</Text>
                </View>
              ) : (
                <ScrollView style={styles.sheetScroll}>
                  {generated.map((r, i) => (
                    <TouchableOpacity
                      key={r.title + i}
                      style={styles.optRow}
                      onPress={() => planFromRecipe(r, 'generated')}
                      activeOpacity={0.7}
                    >
                      <Icon name="sparkles-outline" size={18} color={colors.primary} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.optLabel} numberOfLines={1}>{r.title}</Text>
                        <Text style={styles.optHint} numberOfLines={2}>{r.description}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              ))}

            {mode !== 'choose' && !generating && (
              <TouchableOpacity
                onPress={() => setMode('choose')}
                style={styles.backRow}
                activeOpacity={0.7}
              >
                <Icon name="chevron-back" size={16} color={colors.textMuted} />
                <Text style={styles.backText}>{t('common.back')}</Text>
              </TouchableOpacity>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  weekNavBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  weekLabel: {
    ...typography.bodyStrong,
    color: colors.text,
  },
  expiringCard: {
    marginBottom: spacing.md,
  },
  expiringHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  expiringTitle: {
    ...typography.bodyStrong,
    color: colors.text,
  },
  expiringNames: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 4,
  },
  weekCard: {
    overflow: 'hidden',
  },
  loader: {
    marginTop: spacing.xl,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 72,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  dayPast: {
    opacity: 0.55,
  },
  dayBadge: {
    width: 44,
    paddingVertical: 6,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
  },
  dayBadgeToday: {
    backgroundColor: colors.primary,
  },
  dayName: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  dayNameToday: {
    color: colors.surface,
  },
  dayNum: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  dayNumToday: {
    color: colors.surface,
  },
  dayMain: {
    flex: 1,
    minWidth: 0,
  },
  mealTitle: {
    ...typography.bodyStrong,
    color: colors.text,
  },
  mealMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  mealMetaText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  dayEmpty: {
    ...typography.body,
    color: colors.textSubtle,
  },
  clearBtn: {
    padding: 4,
  },
  addMissingBtn: {
    marginTop: spacing.lg,
  },

  // -- Planner sheet --
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    maxHeight: '80%',
  },
  sheetTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  sheetScroll: {
    maxHeight: 340,
  },
  optRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  optDisabled: {
    color: colors.textSubtle,
  },
  optHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  manualInput: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.bg,
    paddingHorizontal: 14,
    fontSize: 16,
    color: colors.text,
    marginTop: spacing.sm,
  },
  sheetBtn: {
    marginTop: spacing.md,
  },
  generating: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  generatingText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.md,
  },
  backText: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '700',
  },
});

export default MealPlanScreen;
