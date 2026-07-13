import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useFridge } from '../context/FridgeContext';
import { useHousehold } from '../context/HouseholdContext';
import { useActivity } from '../context/ActivityContext';
import { useLanguage } from '../i18n';
import { useFridgeExpiry } from '../hooks/useFridgeExpiry';
import { useStockInsights } from '../hooks/useStockInsights';
import { usePremium } from '../context/PremiumContext';
import WhatsNewModal from '../components/WhatsNewModal';
import {
  Screen,
  Card,
  Icon,
  SectionTitle,
} from '../components/ui';
import { colors, gradients, radii, spacing, typography } from '../theme';

const HomeScreen = ({ navigation }) => {
  const { user } = useAuth();
  const { items, loadItems } = useFridge();
  const { currentHousehold, loadHouseholds } = useHousehold();
  const { activities, loadActivities } = useActivity();
  const { getEffectiveExpiry, getDaysUntilExpiry, isPastFreezerWindow } = useFridgeExpiry();
  const { restock, lowBasic } = useStockInsights();
  const { isPremium } = usePremium();
  // Badge reflects whichever "running low" list this user actually sees.
  const lowCount = isPremium ? restock.length : lowBasic.length;
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);

  // Compute summary
  const summary = useMemo(() => {
    if (!items || items.length === 0) {
      return { totalItems: 0, expiringCount: 0, pastWindowCount: 0, drawersUsed: 0, expiringList: [] };
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sevenDays = new Date(today);
    sevenDays.setDate(today.getDate() + 7);

    const expiringList = items
      .map((i) => {
        const exp = getEffectiveExpiry(i);
        return exp ? { ...i, _exp: exp } : null;
      })
      .filter((i) => i && i._exp <= sevenDays)
      .sort((a, b) => a._exp - b._exp);

    const drawersUsed = new Set(items.map((i) => i.drawer)).size;
    const pastWindowCount = items.filter(isPastFreezerWindow).length;

    return {
      totalItems: items.length,
      expiringCount: expiringList.length,
      pastWindowCount,
      drawersUsed,
      expiringList: expiringList.slice(0, 3),
    };
  }, [items, getEffectiveExpiry, isPastFreezerWindow]);

  // Recent activity is sourced from the activity log, not the items table,
  // so we surface every action (added, used, removed, updated) — not just
  // newly-created items.
  const recentActivities = useMemo(
    () => (activities || []).slice(0, 4),
    [activities]
  );

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return t('home.morning');
    if (h < 18) return t('home.afternoon');
    return t('home.evening');
  }, [t]);

  // Re-fetch the activity log every time Home comes into focus. The log is
  // written server-side (by DB triggers), so adding/using/removing an item
  // elsewhere won't reflect here until we reload — this keeps the "recent
  // activity" list current after returning from Add Item and other flows.
  useFocusEffect(
    useCallback(() => {
      loadActivities();
    }, [loadActivities])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadItems(), loadHouseholds(), loadActivities()]);
    } catch (e) {
      console.error('Refresh error:', e);
    } finally {
      setRefreshing(false);
    }
  };

  const formatExpiry = (item) => {
    const diffDays = getDaysUntilExpiry(item);
    if (diffDays === null) return '';
    if (diffDays < 0) return t('expiring.expired');
    if (diffDays === 0) return t('expiring.expiresToday');
    if (diffDays === 1) return t('expiring.expiresTomorrow');
    return t('expiring.daysLeft', { count: diffDays });
  };

  const expiryTone = (item) => {
    const diffDays = getDaysUntilExpiry(item);
    if (diffDays === null) return colors.primary;
    if (diffDays <= 1) return colors.danger;
    if (diffDays <= 3) return colors.warning;
    return colors.primary;
  };

  const getTimeAgo = (timestamp) => {
    const diff = (Date.now() - new Date(timestamp).getTime()) / 60000;
    if (diff < 1) return t('home.justNow');
    if (diff < 60) return t('home.minAgo', { count: Math.floor(diff) });
    const hours = Math.floor(diff / 60);
    if (hours < 24) {
      return hours === 1 ? t('home.hourAgo', { count: hours }) : t('home.hoursAgo', { count: hours });
    }
    const days = Math.floor(hours / 24);
    return days === 1 ? t('home.dayAgo', { count: days }) : t('home.daysAgo', { count: days });
  };

  const goToAdd = () => {
    // initial: false renders FridgeInventory beneath AddItem so the Freezer tab
    // isn't left stranded on the form. The `from: 'home'` param tells AddItem to
    // return the user here to Home once they save or cancel.
    navigation.navigate('FreezerTab', {
      screen: 'AddItem',
      initial: false,
      params: { from: 'home' },
    });
  };

  const goToInventory = () => {
    navigation.navigate('FreezerTab', { screen: 'FridgeInventory' });
  };

  const goToStats = () => {
    navigation.navigate('FreezerStats');
  };

  const goToCalendar = () => {
    navigation.navigate('Calendar');
  };

  const goToRestock = () => {
    navigation.navigate('StockInsights');
  };

  const actionIconName = (action) => {
    switch (action) {
      case 'created': return 'add-circle-outline';
      case 'updated': return 'create-outline';
      case 'consumed': return 'restaurant-outline';
      case 'deleted': return 'trash-outline';
      default: return 'document-text-outline';
    }
  };

  const actionColor = (action) => {
    switch (action) {
      case 'created': return '#065F46';
      case 'updated': return '#92400E';
      case 'consumed': return '#075985';
      case 'deleted': return colors.danger;
      default: return colors.textMuted;
    }
  };

  return (
    <Screen>
      <LinearGradient
        colors={gradients.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + spacing.sm }]}
      >
        {/* Snowfrost — faint brand texture */}
        <Icon name="snow" size={140} color="rgba(255,255,255,0.12)" style={styles.snowBig} />
        <Icon name="snow" size={64} color="rgba(255,255,255,0.10)" style={styles.snowSmall} />

        <View style={styles.headerTopRow}>
          <View style={styles.headerLeft}>
            <View style={styles.greetingRow}>
              <Icon name="snow" size={14} color={colors.whiteAlpha80} />
              <Text style={styles.greeting}>{greeting}</Text>
            </View>
            <Text style={styles.userLine} numberOfLines={1}>
              {currentHousehold ? currentHousehold.name : (user?.email || 'Freezely')}
            </Text>
          </View>
          <TouchableOpacity activeOpacity={0.85} onPress={goToAdd} style={styles.addPill}>
            <Icon name="add" size={16} color={colors.primary} />
            <Text style={styles.addPillText}>{t('home.quickAdd')}</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Stats row */}
        <View style={styles.statsRow}>
          <TouchableOpacity activeOpacity={0.85} onPress={goToInventory} style={{ flex: 1 }}>
            <Card style={styles.statCard}>
              <Icon name="snow" size={56} color="rgba(148,163,184,0.12)" style={styles.statSnow} />
              <Text style={styles.statLabel}>{t('home.totalItems')}</Text>
              <Text style={styles.statValue}>{summary.totalItems}</Text>
              <Text style={styles.statSub}>
                {summary.drawersUsed} {summary.drawersUsed === 1 ? t('home.drawerSingular') : t('home.drawerPlural')}
              </Text>
            </Card>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => navigation.navigate('ExpiringItems')}
            style={{ flex: 1 }}
          >
            <Card style={styles.statCard}>
              <Icon name="snow" size={56} color="rgba(148,163,184,0.12)" style={styles.statSnow} />
              <Text style={styles.statLabel}>{t('home.expiringSoon')}</Text>
              <Text style={[styles.statValue, summary.expiringCount > 0 && { color: colors.danger }]}>
                {summary.expiringCount}
              </Text>
              <Text style={styles.statSub}>
                {summary.expiringCount > 0 ? t('home.tapToView') : t('home.allFresh')}
              </Text>
            </Card>
          </TouchableOpacity>
        </View>

        {/* Quick access — three compact tiles instead of stacked cards */}
        <View style={styles.quickRow}>
          <TouchableOpacity activeOpacity={0.85} onPress={goToCalendar} style={styles.quickTileWrap}>
            <Card style={styles.quickTile}>
              <View style={styles.quickIcon}>
                <Icon name="calendar-outline" size={20} color={colors.accent} />
              </View>
              <Text style={styles.quickLabel} numberOfLines={1}>{t('home.calendarShort')}</Text>
            </Card>
          </TouchableOpacity>

          <TouchableOpacity activeOpacity={0.85} onPress={goToStats} style={styles.quickTileWrap}>
            <Card style={styles.quickTile}>
              <View style={styles.quickIcon}>
                <Icon name="bar-chart-outline" size={20} color={colors.accent} />
                {summary.pastWindowCount > 0 && (
                  <View style={styles.quickBadge}>
                    <Text style={styles.quickBadgeText}>{summary.pastWindowCount}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.quickLabel} numberOfLines={1}>{t('home.statsShort')}</Text>
            </Card>
          </TouchableOpacity>

          <TouchableOpacity activeOpacity={0.85} onPress={goToRestock} style={styles.quickTileWrap}>
            <Card style={styles.quickTile}>
              <View style={styles.quickIcon}>
                <Icon name="repeat-outline" size={20} color={colors.accent} />
                {lowCount > 0 && (
                  <View style={[styles.quickBadge, styles.quickBadgeWarn]}>
                    <Text style={styles.quickBadgeText}>{lowCount}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.quickLabel} numberOfLines={1}>{t('restock.title')}</Text>
            </Card>
          </TouchableOpacity>
        </View>

        {/* Expiring soon list — "use first" */}
        {summary.expiringList.length > 0 && (
          <>
            <SectionTitle
              icon={<Icon name="time-outline" size={14} color={colors.textMuted} />}
              action={
                <TouchableOpacity
                  onPress={() => navigation.navigate('ExpiringItems')}
                  hitSlop={6}
                  style={styles.sectionActionBtn}
                >
                  <Text style={styles.sectionAction}>{t('home.viewAll')}</Text>
                  <Icon name="chevron-forward" size={14} color={colors.accent} />
                </TouchableOpacity>
              }
            >
              {t('home.useFirst')}
            </SectionTitle>
            <Card padded={false}>
              {summary.expiringList.map((item, idx) => (
                <View
                  key={item.id}
                  style={[styles.expiringRow, idx < summary.expiringList.length - 1 && styles.expiringDivider]}
                >
                  <View style={[styles.expiringDot, { backgroundColor: expiryTone(item) }]} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.expiringName} numberOfLines={1}>{item.name}</Text>
                    <View style={styles.expiringMetaRow}>
                      <Icon name="cube-outline" size={12} color={colors.textMuted} />
                      <Text style={styles.expiringMeta}>{item.drawer}</Text>
                    </View>
                  </View>
                  <Text style={[styles.expiringStatus, { color: expiryTone(item) }]}>
                    {formatExpiry(item)}
                  </Text>
                </View>
              ))}
            </Card>
          </>
        )}

        {/* Recent activity */}
        {recentActivities.length > 0 && (
          <>
            <SectionTitle
              action={
                <TouchableOpacity
                  onPress={() => navigation.navigate('ProfileTab', { screen: 'ActivityHistory', initial: false })}
                  hitSlop={6}
                  style={styles.sectionActionBtn}
                >
                  <Text style={styles.sectionAction}>{t('home.viewAll')}</Text>
                  <Icon name="chevron-forward" size={14} color={colors.accent} />
                </TouchableOpacity>
              }
            >
              {t('home.recentActivity')}
            </SectionTitle>
            <Card padded={false}>
              {recentActivities.map((activity, idx) => (
                <View
                  key={activity.id}
                  style={[styles.activityRow, idx < recentActivities.length - 1 && styles.activityDivider]}
                >
                  <View style={[styles.activityIconWrap, { backgroundColor: actionColor(activity.action) + '1A' }]}>
                    <Icon
                      name={actionIconName(activity.action)}
                      size={14}
                      color={actionColor(activity.action)}
                    />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.activityTitle} numberOfLines={1}>{activity.item_name}</Text>
                    <View style={styles.activityMetaRow}>
                      <Text style={[styles.activityAction, { color: actionColor(activity.action) }]}>
                        {t(`home.action_${activity.action}`)}
                      </Text>
                      <Text style={styles.activityMeta}>· {getTimeAgo(activity.created_at)}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </Card>
          </>
        )}

        {/* Empty state when fully empty */}
        {summary.totalItems === 0 && (
          <Card style={styles.emptyHero}>
            <View style={styles.emptyIconWrap}>
              <Icon name="snow-outline" size={40} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>{t('inventory.freezerEmpty')}</Text>
            <Text style={styles.emptySub}>{t('inventory.startAdding')}</Text>
          </Card>
        )}

        <View style={{ height: spacing.xxxl }} />
      </ScrollView>
      <WhatsNewModal />
    </Screen>
  );
};

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    // paddingTop is set inline to include the safe-area inset
    paddingBottom: spacing.md,
    borderBottomLeftRadius: radii.header,
    borderBottomRightRadius: radii.header,
    overflow: 'hidden',
  },
  snowBig: {
    position: 'absolute',
    right: -26,
    top: -14,
  },
  snowSmall: {
    position: 'absolute',
    right: 58,
    bottom: -10,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flex: 1,
    minWidth: 0,
    marginRight: spacing.sm,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  greeting: {
    color: colors.whiteAlpha80,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  addPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surface,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: radii.pill,
  },
  addPillText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  userLine: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
    color: colors.surface,
    marginTop: 2,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  statCard: {
    paddingVertical: spacing.lg,
    overflow: 'hidden',
  },
  statSnow: {
    position: 'absolute',
    right: -8,
    bottom: -8,
  },
  statLabel: {
    ...typography.label,
    color: colors.textMuted,
  },
  statValue: {
    fontSize: 34,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.6,
    marginTop: 6,
  },
  statSub: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 4,
  },
  sectionAction: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: '700',
    marginRight: 2,
  },
  sectionActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  quickRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  quickTileWrap: {
    flex: 1,
  },
  quickTile: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: 8,
  },
  quickIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickBadge: {
    position: 'absolute',
    top: -5,
    right: -7,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  quickBadgeWarn: {
    backgroundColor: colors.warning,
  },
  quickBadgeText: {
    color: colors.surface,
    fontSize: 10,
    fontWeight: '800',
  },
  quickLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },

  entryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  entryCardIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryCardTitle: {
    ...typography.bodyStrong,
    fontSize: 16,
    color: colors.text,
  },
  entryCardSub: {
    ...typography.caption,
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },

  expiringRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    gap: 12,
  },
  expiringDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  expiringDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  expiringName: {
    ...typography.bodyStrong,
    fontSize: 16,
    color: colors.text,
  },
  expiringMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  expiringMeta: {
    ...typography.caption,
    color: colors.textMuted,
  },
  expiringStatus: {
    fontSize: 13,
    fontWeight: '700',
  },

  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    gap: 12,
  },
  activityDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  activityIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityTitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: '500',
  },
  activityMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  activityAction: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  activityMeta: {
    ...typography.caption,
    color: colors.textMuted,
  },

  emptyHero: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
    marginTop: spacing.lg,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySub: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
});

export default HomeScreen;
