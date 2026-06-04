import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useFridge } from '../context/FridgeContext';
import { useHousehold } from '../context/HouseholdContext';
import { useActivity } from '../context/ActivityContext';
import { useLanguage } from '../i18n';
import { useFridgeExpiry } from '../hooks/useFridgeExpiry';
import WhatsNewModal from '../components/WhatsNewModal';
import {
  Screen,
  Card,
  Icon,
  PrimaryButton,
  SectionTitle,
} from '../components/ui';
import { colors, gradients, radii, spacing, typography } from '../theme';

const HomeScreen = ({ navigation }) => {
  const { user } = useAuth();
  const { items, loadItems } = useFridge();
  const { currentHousehold, loadHouseholds } = useHousehold();
  const { activities, loadActivities } = useActivity();
  const { getEffectiveExpiry, getDaysUntilExpiry, isPastFreezerWindow } = useFridgeExpiry();
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
    navigation.navigate('FreezerTab', { screen: 'AddItem' });
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
        style={[styles.heroHeader, { paddingTop: insets.top + spacing.md }]}
      >
        <Text style={styles.greeting}>{greeting}</Text>
        <Text style={styles.userLine} numberOfLines={1}>
          {currentHousehold ? currentHousehold.name : (user?.email || 'Freezely')}
        </Text>
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

        {/* Quick add */}
        <PrimaryButton
          title={t('home.quickAdd')}
          onPress={goToAdd}
          icon={<Icon name="add" size={18} color={colors.surface} />}
          style={{ marginTop: spacing.md }}
        />

        {/* Expiry calendar entry point */}
        <TouchableOpacity activeOpacity={0.85} onPress={goToCalendar} style={{ marginTop: spacing.md }}>
          <Card style={styles.statsCard}>
            <View style={styles.statsCardIcon}>
              <Icon name="calendar-outline" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.statsCardTitle}>{t('calendar.homeCardTitle')}</Text>
              <Text style={styles.statsCardSub} numberOfLines={1}>
                {t('calendar.homeCardSubtitle')}
              </Text>
            </View>
            <Icon name="chevron-forward" size={18} color={colors.textMuted} />
          </Card>
        </TouchableOpacity>

        {/* Stats entry point */}
        {summary.totalItems > 0 && (
          <TouchableOpacity activeOpacity={0.85} onPress={goToStats} style={{ marginTop: spacing.md }}>
            <Card style={styles.statsCard}>
              <View style={styles.statsCardIcon}>
                <Icon name="bar-chart-outline" size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.statsCardTitle}>{t('home.yourFreezerStats')}</Text>
                <Text style={styles.statsCardSub} numberOfLines={1}>
                  {summary.pastWindowCount > 0
                    ? t('stats.pastWindowSummary', { count: summary.pastWindowCount })
                    : t('stats.cardSubtitle')}
                </Text>
              </View>
              <Icon name="chevron-forward" size={18} color={colors.textMuted} />
            </Card>
          </TouchableOpacity>
        )}

        {/* Expiring soon list */}
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
                  <Icon name="chevron-forward" size={14} color={colors.primary} />
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
                  onPress={() => navigation.navigate('ProfileTab', { screen: 'ActivityHistory' })}
                  hitSlop={6}
                  style={styles.sectionActionBtn}
                >
                  <Text style={styles.sectionAction}>{t('home.viewAll')}</Text>
                  <Icon name="chevron-forward" size={14} color={colors.primary} />
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
  heroHeader: {
    paddingHorizontal: spacing.lg,
    // paddingTop is set inline to include the safe-area inset
    paddingBottom: spacing.xl,
    borderBottomLeftRadius: radii.header,
    borderBottomRightRadius: radii.header,
  },
  greeting: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  userLine: {
    color: colors.surface,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
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
  },
  statLabel: {
    ...typography.label,
    color: colors.textMuted,
  },
  statValue: {
    fontSize: 32,
    fontWeight: '700',
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
    color: colors.primary,
    fontWeight: '700',
    marginRight: 2,
  },
  sectionActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  statsCardIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: '#ECFEFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsCardTitle: {
    ...typography.bodyStrong,
    color: colors.text,
  },
  statsCardSub: {
    ...typography.caption,
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
    color: colors.text,
  },
  expiringMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  expiringMeta: {
    ...typography.caption,
    color: colors.textMuted,
  },
  expiringStatus: {
    fontSize: 12,
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
    backgroundColor: '#ECFEFF',
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
