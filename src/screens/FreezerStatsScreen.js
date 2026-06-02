import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../config/supabase';
import { useFridge } from '../context/FridgeContext';
import { useHousehold } from '../context/HouseholdContext';
import { useSavedRecipes } from '../context/SavedRecipesContext';
import { useLanguage } from '../i18n';
import {
  Screen,
  ScreenHeader,
  Card,
  Icon,
  EmptyState,
  SectionTitle,
} from '../components/ui';
import { colors, gradients, radii, spacing, typography } from '../theme';
import { useFridgeExpiry } from '../hooks/useFridgeExpiry';
import { getCategory } from '../utils/foodCategories';

const MS_PER_DAY = 86400000;
const WINDOW_DAYS = 90;
// We pull a wide slice of activity history client-side so we can compute
// 90-day stats without adding a Postgres RPC. 500 covers a heavy user for
// well over the window; lighter users won't fill it.
const ACTIVITY_LIMIT = 500;
const TREND_WEEKS = 8;   // how many weeks the activity chart spans
const MAX_BAR = 84;      // tallest bar in the weekly chart, px
const MAX_COMPOSITION = 6; // category rows before the rest folds into "other"

// Soft icon-chip palette, paired tint + background.
const CHIP = {
  primary: { tint: colors.primary, soft: '#ECFEFF' },
  info: { tint: colors.info, soft: colors.infoSoft },
  success: { tint: colors.success, soft: colors.successSoft },
  danger: { tint: colors.danger, soft: colors.dangerSoft },
  warning: { tint: colors.warning, soft: colors.warningSoft },
  indigo: { tint: colors.secondary, soft: '#EEF2FF' },
  muted: { tint: colors.textMuted, soft: colors.surfaceMuted },
};

const StatTile = ({ chip, iconName, value, label, valueColor, onPress }) => {
  const inner = (
    <Card style={styles.tile}>
      <View style={[styles.tileIcon, { backgroundColor: chip.soft }]}>
        <Icon name={iconName} size={18} color={chip.tint} />
      </View>
      <Text style={[styles.tileValue, valueColor && { color: valueColor }]}>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </Card>
  );
  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.85} style={styles.tileWrap} onPress={onPress}>
        {inner}
      </TouchableOpacity>
    );
  }
  return <View style={styles.tileWrap}>{inner}</View>;
};

const FreezerStatsScreen = ({ navigation }) => {
  const { items } = useFridge();
  const { currentHousehold } = useHousehold();
  const { savedRecipes } = useSavedRecipes();
  const { isPastFreezerWindow, getExpiryStatus } = useFridgeExpiry();
  const { t, formatDate } = useLanguage();

  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_activity_log', {
        p_household_id: currentHousehold?.id || null,
        p_limit: ACTIVITY_LIMIT,
        p_offset: 0,
      });
      if (error) throw error;
      setActivities(data || []);
    } catch (e) {
      console.error('Error loading stats activities:', e);
      setActivities([]);
    }
  }, [currentHousehold?.id]);

  useEffect(() => {
    setLoading(true);
    loadStats().finally(() => setLoading(false));
  }, [loadStats]);

  const onRefresh = async () => {
    setRefreshing(true);
    try { await loadStats(); }
    finally { setRefreshing(false); }
  };

  const stats = useMemo(() => {
    const now = Date.now();
    const windowStart = now - WINDOW_DAYS * MS_PER_DAY;
    const prevWindowStart = now - 2 * WINDOW_DAYS * MS_PER_DAY;

    const inWindow = activities.filter(
      (a) => new Date(a.created_at).getTime() >= windowStart
    );
    const inPrevWindow = activities.filter((a) => {
      const ts = new Date(a.created_at).getTime();
      return ts >= prevWindowStart && ts < windowStart;
    });

    const countByAction = (list) =>
      list.reduce(
        (acc, a) => {
          if (a.action === 'created') acc.created += 1;
          else if (a.action === 'consumed') acc.consumed += 1;
          else if (a.action === 'deleted') acc.deleted += 1;
          return acc;
        },
        { created: 0, consumed: 0, deleted: 0 }
      );

    const window = countByAction(inWindow);
    const prev = countByAction(inPrevWindow);

    // Waste ratio: of items that left the freezer (used + thrown), how many
    // were actually eaten? This is the headline metric.
    const wasteDenom = window.consumed + window.deleted;
    const eatenPct = wasteDenom > 0
      ? Math.round((window.consumed / wasteDenom) * 100)
      : null;
    const prevWasteDenom = prev.consumed + prev.deleted;
    const prevEatenPct = prevWasteDenom > 0
      ? Math.round((prev.consumed / prevWasteDenom) * 100)
      : null;
    const eatenDelta =
      eatenPct !== null && prevEatenPct !== null
        ? eatenPct - prevEatenPct
        : null;

    // Top 3 thrown-out items in window.
    const deletedCounts = new Map();
    inWindow.forEach((a) => {
      if (a.action !== 'deleted') return;
      const key = (a.item_name || '').trim().toLowerCase();
      if (!key) return;
      const cur = deletedCounts.get(key) || { name: a.item_name, count: 0 };
      cur.count += 1;
      deletedCounts.set(key, cur);
    });
    const topThrown = [...deletedCounts.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    // Average freezer time before consumed: pair each "consumed" event with
    // the earliest "created" event for the same item_id. If we don't have
    // both events in our window, the item is skipped — this approximates
    // the rolling average rather than a perfect lifetime stat.
    const firstCreatedByItem = new Map();
    activities.forEach((a) => {
      if (a.action !== 'created' || !a.item_id) return;
      const existing = firstCreatedByItem.get(a.item_id);
      const ts = new Date(a.created_at).getTime();
      if (!existing || ts < existing) firstCreatedByItem.set(a.item_id, ts);
    });
    let totalDays = 0;
    let pairCount = 0;
    inWindow.forEach((a) => {
      if (a.action !== 'consumed' || !a.item_id) return;
      const createdTs = firstCreatedByItem.get(a.item_id);
      if (!createdTs) return;
      const consumedTs = new Date(a.created_at).getTime();
      const days = Math.max(0, Math.round((consumedTs - createdTs) / MS_PER_DAY));
      totalDays += days;
      pairCount += 1;
    });
    const avgDaysFrozen = pairCount > 0 ? Math.round(totalDays / pairCount) : null;

    // --- Current-inventory derived stats ---

    // Items past / approaching their effective freezer window.
    const pastWindowCount = items.filter(isPastFreezerWindow).length;
    let expiringSoonCount = 0;
    items.forEach((it) => {
      const s = getExpiryStatus(it);
      if (s === 'soon' || s === 'critical') expiringSoonCount += 1;
    });

    // Composition: how the current inventory splits across food categories.
    const catCounts = new Map();
    items.forEach((it) => {
      const cat = getCategory(it.name || '') || 'other';
      catCounts.set(cat, (catCounts.get(cat) || 0) + 1);
    });
    let composition = [...catCounts.entries()]
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count);
    if (composition.length > MAX_COMPOSITION) {
      const head = composition.slice(0, MAX_COMPOSITION - 1);
      const rest = composition
        .slice(MAX_COMPOSITION - 1)
        .reduce((s, c) => s + c.count, 0);
      // The kept slice may already contain "other"; merge into it rather than
      // adding a second entry (which would collide on the React key).
      const existingOther = head.find((c) => c.key === 'other');
      if (existingOther) {
        existingOther.count += rest;
      } else {
        head.push({ key: 'other', count: rest });
      }
      composition = head.sort((a, b) => b.count - a.count);
    }
    const compositionMax = Math.max(1, ...composition.map((c) => c.count));

    // Oldest item still in the freezer.
    let oldest = null;
    items.forEach((it) => {
      if (!it.frozen_date) return;
      const ts = new Date(it.frozen_date).getTime();
      if (isNaN(ts)) return;
      const days = Math.floor((now - ts) / MS_PER_DAY);
      if (!oldest || days > oldest.days) {
        oldest = { name: it.name, days, frozenDate: it.frozen_date };
      }
    });
    if (oldest && oldest.days < 1) oldest = null;

    // Weekly added-vs-used trend, oldest week first.
    const weekMs = 7 * MS_PER_DAY;
    const weekly = Array.from({ length: TREND_WEEKS }, () => ({ added: 0, used: 0 }));
    activities.forEach((a) => {
      const ts = new Date(a.created_at).getTime();
      const ageWeeks = Math.floor((now - ts) / weekMs);
      if (ageWeeks < 0 || ageWeeks >= TREND_WEEKS) return;
      const idx = TREND_WEEKS - 1 - ageWeeks;
      if (a.action === 'created') weekly[idx].added += 1;
      else if (a.action === 'consumed') weekly[idx].used += 1;
    });
    const weeklyMax = Math.max(1, ...weekly.flatMap((w) => [w.added, w.used]));
    const weeklyHasData = weekly.some((w) => w.added > 0 || w.used > 0);

    return {
      eatenPct,
      eatenDelta,
      window,
      topThrown,
      avgDaysFrozen,
      pastWindowCount,
      expiringSoonCount,
      composition,
      compositionMax,
      oldest,
      weekly,
      weeklyMax,
      weeklyHasData,
      totalItems: items.length,
      pairCount,
      hasAnyActivity: inWindow.length > 0,
    };
  }, [activities, items, isPastFreezerWindow, getExpiryStatus]);

  const goToInventory = () => {
    navigation.navigate('FreezerTab', { screen: 'FridgeInventory' });
  };
  const goToExpiring = () => navigation.navigate('ExpiringItems');

  const renderDelta = () => {
    if (stats.eatenDelta === null) return null;
    const up = stats.eatenDelta > 0;
    const flat = stats.eatenDelta === 0;
    const color = flat
      ? colors.whiteAlpha80
      : up
        ? '#A7F3D0'  // emerald-200
        : '#FECACA'; // red-200
    const sign = stats.eatenDelta > 0 ? '+' : '';
    return (
      <Text style={[styles.heroDelta, { color }]}>
        {flat
          ? t('stats.deltaFlat')
          : t('stats.deltaVsPrev', { delta: `${sign}${stats.eatenDelta}` })}
      </Text>
    );
  };

  if (loading && activities.length === 0) {
    return (
      <Screen>
        <ScreenHeader
          title={t('stats.title')}
          onBack={() => navigation.goBack()}
          backLabel={t('common.back')}
        />
        <EmptyState description={t('common.loading')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader
        title={t('stats.title')}
        subtitle={t('stats.subtitle')}
        onBack={() => navigation.goBack()}
        backLabel={t('common.back')}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {!stats.hasAnyActivity && stats.totalItems === 0 ? (
          <EmptyState
            icon="bar-chart-outline"
            title={t('stats.emptyTitle')}
            description={t('stats.emptyDesc')}
          />
        ) : (
          <>
            {/* Hero: eaten ratio */}
            <LinearGradient
              colors={gradients.hero}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.hero}
            >
              <Text style={styles.heroLabel}>{t('stats.eatenLast90')}</Text>
              {stats.eatenPct !== null ? (
                <>
                  <Text style={styles.heroValue}>{stats.eatenPct}%</Text>
                  <View style={styles.heroBarTrack}>
                    <View style={[styles.heroBarFill, { width: `${stats.eatenPct}%` }]} />
                  </View>
                  <Text style={styles.heroSub}>
                    {t('stats.eatenSub', {
                      used: stats.window.consumed,
                      total: stats.window.consumed + stats.window.deleted,
                    })}
                  </Text>
                  {renderDelta()}
                </>
              ) : (
                <Text style={styles.heroEmpty}>{t('stats.eatenNoData')}</Text>
              )}
            </LinearGradient>

            {/* Quick numbers */}
            <View style={styles.grid}>
              <View style={styles.gridRow}>
                <StatTile
                  chip={CHIP.primary}
                  iconName="snow-outline"
                  value={stats.totalItems}
                  label={t('stats.inFreezerNow')}
                />
                <StatTile
                  chip={CHIP.warning}
                  iconName="time-outline"
                  value={stats.expiringSoonCount}
                  label={t('stats.expiringSoonTitle')}
                  valueColor={stats.expiringSoonCount > 0 ? colors.warning : undefined}
                  onPress={stats.expiringSoonCount > 0 ? goToExpiring : undefined}
                />
              </View>
              <View style={styles.gridRow}>
                <StatTile
                  chip={CHIP.info}
                  iconName="add-circle-outline"
                  value={stats.window.created}
                  label={t('stats.addedWindow')}
                />
                <StatTile
                  chip={CHIP.success}
                  iconName="restaurant-outline"
                  value={stats.window.consumed}
                  label={t('stats.usedThisWindow')}
                />
              </View>
              <View style={styles.gridRow}>
                <StatTile
                  chip={CHIP.danger}
                  iconName="trash-outline"
                  value={stats.window.deleted}
                  label={t('stats.thrownThisWindow')}
                />
                <StatTile
                  chip={stats.pastWindowCount > 0 ? CHIP.danger : CHIP.muted}
                  iconName="alert-circle-outline"
                  value={stats.pastWindowCount}
                  label={t('stats.pastSafeWindow')}
                  valueColor={stats.pastWindowCount > 0 ? colors.danger : undefined}
                  onPress={stats.pastWindowCount > 0 ? goToInventory : undefined}
                />
              </View>
            </View>

            {/* Freezer composition */}
            {stats.composition.length > 0 && (
              <>
                <SectionTitle
                  icon={<Icon name="pie-chart-outline" size={14} color={colors.textMuted} />}
                >
                  {t('stats.compositionSection')}
                </SectionTitle>
                <Card>
                  {stats.composition.map((c, idx) => (
                    <View key={c.key} style={[styles.compItem, idx > 0 && { marginTop: spacing.md }]}>
                      <View style={styles.compHeader}>
                        <Text style={styles.compLabel} numberOfLines={1}>
                          {t(`shopping.cat_${c.key}`)}
                        </Text>
                        <Text style={styles.compCount}>{c.count}</Text>
                      </View>
                      <View style={styles.compTrack}>
                        <View
                          style={[
                            styles.compFill,
                            { width: `${Math.round((c.count / stats.compositionMax) * 100)}%` },
                          ]}
                        />
                      </View>
                    </View>
                  ))}
                </Card>
              </>
            )}

            {/* Weekly activity trend */}
            {stats.weeklyHasData && (
              <>
                <SectionTitle
                  icon={<Icon name="trending-up-outline" size={14} color={colors.textMuted} />}
                >
                  {t('stats.weeklySection')}
                </SectionTitle>
                <Card>
                  <View style={styles.chart}>
                    {stats.weekly.map((w, i) => (
                      <View key={i} style={styles.chartCol}>
                        <View style={styles.chartBarWrap}>
                          <View
                            style={[
                              styles.chartBar,
                              {
                                height: Math.max(3, (w.added / stats.weeklyMax) * MAX_BAR),
                                backgroundColor: colors.primary,
                              },
                            ]}
                          />
                          <View
                            style={[
                              styles.chartBar,
                              styles.chartBarRight,
                              {
                                height: Math.max(3, (w.used / stats.weeklyMax) * MAX_BAR),
                                backgroundColor: colors.secondary,
                              },
                            ]}
                          />
                        </View>
                      </View>
                    ))}
                  </View>
                  <View style={styles.legend}>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
                      <Text style={styles.legendText}>{t('stats.legendAdded')}</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: colors.secondary }]} />
                      <Text style={styles.legendText}>{t('stats.legendUsed')}</Text>
                    </View>
                  </View>
                </Card>
              </>
            )}

            {/* Avg freezer time */}
            {stats.avgDaysFrozen !== null && (
              <>
                <SectionTitle
                  icon={<Icon name="time-outline" size={14} color={colors.textMuted} />}
                >
                  {t('stats.avgFreezerTimeSection')}
                </SectionTitle>
                <Card>
                  <View style={styles.avgRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.avgValue}>
                        {t('stats.avgDays', { count: stats.avgDaysFrozen })}
                      </Text>
                      <Text style={styles.avgSub}>
                        {t('stats.avgFreezerTimeDesc', { count: stats.pairCount })}
                      </Text>
                    </View>
                    <View style={[styles.avgIconWrap, { backgroundColor: '#ECFEFF' }]}>
                      <Icon name="snow-outline" size={22} color={colors.primary} />
                    </View>
                  </View>
                </Card>
              </>
            )}

            {/* Oldest item in the freezer */}
            {stats.oldest && (
              <>
                <SectionTitle
                  icon={<Icon name="hourglass-outline" size={14} color={colors.textMuted} />}
                >
                  {t('stats.oldestSection')}
                </SectionTitle>
                <Card>
                  <View style={styles.avgRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.avgValue} numberOfLines={1}>{stats.oldest.name}</Text>
                      <Text style={styles.avgSub}>
                        {t('stats.avgDays', { count: stats.oldest.days })}
                        {'  ·  '}
                        {t('stats.oldestFrozen', { date: formatDate(stats.oldest.frozenDate) })}
                      </Text>
                    </View>
                    <View style={[styles.avgIconWrap, { backgroundColor: colors.warningSoft }]}>
                      <Icon name="hourglass-outline" size={22} color={colors.warning} />
                    </View>
                  </View>
                </Card>
              </>
            )}

            {/* Top thrown out */}
            {stats.topThrown.length > 0 && (
              <>
                <SectionTitle
                  icon={<Icon name="trash-outline" size={14} color={colors.textMuted} />}
                >
                  {t('stats.topThrownTitle')}
                </SectionTitle>
                <Card padded={false}>
                  {stats.topThrown.map((row, idx) => (
                    <View
                      key={row.name + idx}
                      style={[
                        styles.thrownRow,
                        idx < stats.topThrown.length - 1 && styles.thrownDivider,
                      ]}
                    >
                      <View style={styles.thrownRank}>
                        <Text style={styles.thrownRankText}>{idx + 1}</Text>
                      </View>
                      <Text style={styles.thrownName} numberOfLines={1}>{row.name}</Text>
                      <Text style={styles.thrownCount}>
                        {t('stats.timesThrown', { count: row.count })}
                      </Text>
                    </View>
                  ))}
                </Card>
                <Text style={styles.tipText}>{t('stats.topThrownHint')}</Text>
              </>
            )}

            {/* Cookbook */}
            <SectionTitle
              icon={<Icon name="bookmark-outline" size={14} color={colors.textMuted} />}
            >
              {t('stats.cookbookSection')}
            </SectionTitle>
            <Card>
              <View style={styles.avgRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.avgValue}>{savedRecipes.length}</Text>
                  <Text style={styles.avgSub}>
                    {savedRecipes.length === 1
                      ? t('stats.cookbookSingular')
                      : t('stats.cookbookPlural')}
                  </Text>
                </View>
                <View style={[styles.avgIconWrap, { backgroundColor: '#EEF2FF' }]}>
                  <Icon name="restaurant-outline" size={22} color="#6366F1" />
                </View>
              </View>
            </Card>

            <Text style={styles.footnote}>{t('stats.footnote')}</Text>
          </>
        )}

        <View style={{ height: spacing.xxxl }} />
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  hero: {
    borderRadius: radii.lg,
    padding: spacing.xl,
    marginBottom: spacing.md,
  },
  heroLabel: {
    color: colors.whiteAlpha80,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  heroValue: {
    color: colors.surface,
    fontSize: 56,
    fontWeight: '800',
    letterSpacing: -2,
    marginTop: 4,
  },
  heroBarTrack: {
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.whiteAlpha30,
    overflow: 'hidden',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  heroBarFill: {
    height: '100%',
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
  },
  heroSub: {
    color: colors.whiteAlpha80,
    fontSize: 13,
    fontWeight: '500',
  },
  heroDelta: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: spacing.sm,
  },
  heroEmpty: {
    color: colors.whiteAlpha80,
    fontSize: 14,
    marginTop: spacing.sm,
  },

  grid: {},
  gridRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  tileWrap: {
    flex: 1,
  },
  tile: {
    flex: 1,
    paddingVertical: spacing.lg,
    alignItems: 'flex-start',
  },
  tileIcon: {
    width: 34,
    height: 34,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileValue: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.5,
    marginTop: 10,
  },
  tileLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },

  // Composition bars
  compItem: {},
  compHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  compLabel: {
    ...typography.bodyStrong,
    color: colors.text,
    flex: 1,
    marginRight: spacing.sm,
    textTransform: 'capitalize',
  },
  compCount: {
    ...typography.bodyStrong,
    color: colors.textMuted,
  },
  compTrack: {
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
  },
  compFill: {
    height: '100%',
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
  },

  // Weekly chart
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: MAX_BAR,
  },
  chartCol: {
    flex: 1,
    alignItems: 'center',
  },
  chartBarWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  chartBar: {
    width: 7,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  chartBarRight: {
    marginLeft: 3,
  },
  legend: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    ...typography.caption,
    color: colors.textMuted,
  },

  avgRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avgValue: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.3,
  },
  avgSub: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  avgIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.md,
  },

  thrownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    gap: 12,
  },
  thrownDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  thrownRank: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thrownRankText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
  thrownName: {
    ...typography.bodyStrong,
    color: colors.text,
    flex: 1,
  },
  thrownCount: {
    ...typography.caption,
    color: colors.danger,
    fontWeight: '700',
  },
  tipText: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
    paddingHorizontal: 2,
    fontStyle: 'italic',
  },

  footnote: {
    ...typography.caption,
    color: colors.textSubtle,
    marginTop: spacing.xl,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
});

export default FreezerStatsScreen;
