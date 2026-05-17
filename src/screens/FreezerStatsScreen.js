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

const MS_PER_DAY = 86400000;
const WINDOW_DAYS = 90;
// We pull a wide slice of activity history client-side so we can compute
// 90-day stats without adding a Postgres RPC. 500 covers a heavy user for
// well over the window; lighter users won't fill it.
const ACTIVITY_LIMIT = 500;

const FreezerStatsScreen = ({ navigation }) => {
  const { items } = useFridge();
  const { currentHousehold } = useHousehold();
  const { savedRecipes } = useSavedRecipes();
  const { isPastFreezerWindow } = useFridgeExpiry();
  const { t } = useLanguage();

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
      const t = new Date(a.created_at).getTime();
      return t >= prevWindowStart && t < windowStart;
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

    // Items currently past their effective freezer window — what was
    // misleadingly hidden before we built effectiveExpiry.
    const pastWindowCount = items.filter(isPastFreezerWindow).length;

    return {
      eatenPct,
      eatenDelta,
      window,
      topThrown,
      avgDaysFrozen,
      pastWindowCount,
      totalItems: items.length,
      pairCount,
      hasAnyActivity: inWindow.length > 0,
    };
  }, [activities, items, isPastFreezerWindow]);

  const goToInventory = () => {
    navigation.navigate('FreezerTab', { screen: 'FridgeInventory' });
  };

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

            {/* Quick numbers row */}
            <View style={styles.statsRow}>
              <Card style={styles.statCard}>
                <Icon name="snow-outline" size={18} color={colors.primary} />
                <Text style={styles.statValue}>{stats.totalItems}</Text>
                <Text style={styles.statLabel}>{t('stats.inFreezerNow')}</Text>
              </Card>
              <TouchableOpacity
                activeOpacity={0.85}
                style={{ flex: 1 }}
                onPress={stats.pastWindowCount > 0 ? goToInventory : undefined}
              >
                <Card style={styles.statCard}>
                  <Icon
                    name="alert-circle-outline"
                    size={18}
                    color={stats.pastWindowCount > 0 ? colors.danger : colors.textMuted}
                  />
                  <Text
                    style={[
                      styles.statValue,
                      stats.pastWindowCount > 0 && { color: colors.danger },
                    ]}
                  >
                    {stats.pastWindowCount}
                  </Text>
                  <Text style={styles.statLabel}>{t('stats.pastSafeWindow')}</Text>
                </Card>
              </TouchableOpacity>
            </View>

            <View style={styles.statsRow}>
              <Card style={styles.statCard}>
                <Icon name="restaurant-outline" size={18} color="#075985" />
                <Text style={styles.statValue}>{stats.window.consumed}</Text>
                <Text style={styles.statLabel}>{t('stats.usedThisWindow')}</Text>
              </Card>
              <Card style={styles.statCard}>
                <Icon name="trash-outline" size={18} color={colors.danger} />
                <Text style={styles.statValue}>{stats.window.deleted}</Text>
                <Text style={styles.statLabel}>{t('stats.thrownThisWindow')}</Text>
              </Card>
            </View>

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
                    <View style={styles.avgIconWrap}>
                      <Icon name="snow-outline" size={22} color={colors.primary} />
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
              <View style={styles.cookbookRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cookbookValue}>{savedRecipes.length}</Text>
                  <Text style={styles.cookbookSub}>
                    {savedRecipes.length === 1
                      ? t('stats.cookbookSingular')
                      : t('stats.cookbookPlural')}
                  </Text>
                </View>
                <View style={styles.cookbookIconWrap}>
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
  heroSub: {
    color: colors.whiteAlpha80,
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
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

  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  statCard: {
    flex: 1,
    paddingVertical: spacing.lg,
    alignItems: 'flex-start',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.5,
    marginTop: 8,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
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
    backgroundColor: '#ECFEFF',
    alignItems: 'center',
    justifyContent: 'center',
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

  cookbookRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cookbookValue: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.3,
  },
  cookbookSub: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  cookbookIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
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
