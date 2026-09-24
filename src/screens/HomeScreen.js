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
    const pastWindowCount = items.filter((i) => isPastFreezerWindow(i)).length;

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
      // 'thrown' arrived with v1.1.2 and never got added here, so binned food
      // showed on Home as a grey generic document while Activity History gave
      // it an orange trash bin. Same icon and colour in both places now.
      case 'thrown': return 'trash-bin-outline';
      case 'deleted': return 'trash-outline';
      default: return 'document-text-outline';
    }
  };

  const actionColor = (action) => {
    switch (action) {
      case 'created': return colors.successText;
      case 'updated': return colors.warningText;
      case 'consumed': return colors.infoText;
      case 'thrown': return colors.thrownText;
      case 'deleted': return colors.dangerText;
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
        {/* Snowfrost — faint brand texture. Layered at three sizes so the
            header reads as frosted glass rather than as a flat gradient with a
            sticker on it; same treatment as the login screen. */}
        <Icon name="snow" size={150} color="rgba(255,255,255,0.13)" style={styles.snowBig} />
        <Icon name="snow" size={64} color="rgba(255,255,255,0.10)" style={styles.snowSmall} />
        <Icon name="snow" size={38} color="rgba(255,255,255,0.09)" style={styles.snowTiny} />

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

        {/* The two headline numbers, as frosted glass on the gradient rather
            than white cards below it. This is the login screen's panel
            treatment carried into the app: it makes the header the dashboard
            instead of a title bar, and the numbers stop competing with the
            cards further down. Living inside the header also means they do not
            scroll away — and sidesteps the ScrollView clipping that an
            overlapping-card layout would need. */}
        <View style={styles.glassRow}>
          <TouchableOpacity activeOpacity={0.85} onPress={goToInventory} style={styles.glassWrap}>
            <View style={styles.glassCard}>
              <View style={styles.glassTopRow}>
                <Icon name="snow-outline" size={16} color={colors.surface} />
                <Text style={styles.glassLabel}>{t('home.totalItems')}</Text>
              </View>
              <Text style={styles.glassValue}>{summary.totalItems}</Text>
              <Text style={styles.glassSub} numberOfLines={1}>
                {summary.drawersUsed} {summary.drawersUsed === 1 ? t('home.drawerSingular') : t('home.drawerPlural')}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => navigation.navigate('ExpiringItems')}
            style={styles.glassWrap}
          >
            {/* Urgency shows as a warmer pane, not a red number: the count is
                already the biggest thing here. */}
            <View style={[styles.glassCard, summary.expiringCount > 0 && styles.glassCardAlert]}>
              <View style={styles.glassTopRow}>
                <Icon
                  name={summary.expiringCount > 0 ? 'time-outline' : 'checkmark-circle-outline'}
                  size={16}
                  color={colors.surface}
                />
                <Text style={styles.glassLabel}>{t('home.expiringSoon')}</Text>
              </View>
              <Text style={styles.glassValue}>{summary.expiringCount}</Text>
              <Text style={styles.glassSub} numberOfLines={1}>
                {summary.expiringCount > 0 ? t('home.tapToView') : t('home.allFresh')}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Quick access — three compact tiles instead of stacked cards */}
        <View style={styles.quickRow}>
          <TouchableOpacity activeOpacity={0.85} onPress={goToCalendar} style={styles.quickTileWrap}>
            <Card style={styles.quickTile}>
              <View style={[styles.quickIcon, { backgroundColor: colors.accentSoft }]}>
                <Icon name="calendar-outline" size={20} color={colors.accent} />
              </View>
              <Text style={styles.quickLabel} numberOfLines={1}>{t('home.calendarShort')}</Text>
            </Card>
          </TouchableOpacity>

          <TouchableOpacity activeOpacity={0.85} onPress={goToStats} style={styles.quickTileWrap}>
            <Card style={styles.quickTile}>
              <View style={[styles.quickIcon, { backgroundColor: colors.primarySoft }]}>
                <Icon name="bar-chart-outline" size={20} color={colors.primary} />
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
              <View style={[styles.quickIcon, { backgroundColor: colors.warningSoft }]}>
                <Icon name="repeat-outline" size={20} color={colors.warning} />
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
                  <View style={[styles.expiringChip, { backgroundColor: expiryTone(item) + '1A' }]}>
                    <Icon name="snow-outline" size={14} color={expiryTone(item)} />
                  </View>
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
    paddingBottom: spacing.lg,
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
  snowTiny: {
    position: 'absolute',
    left: -8,
    bottom: 6,
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
  glassRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  glassWrap: {
    flex: 1,
  },
  glassCard: {
    backgroundColor: colors.glassPanel,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  glassCardAlert: {
    backgroundColor: colors.glassPanelStrong,
    borderColor: colors.glassBorderStrong,
  },
  glassTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  glassLabel: {
    ...typography.label,
    fontSize: 11,
    color: colors.surface,
    opacity: 0.9,
    flexShrink: 1,
  },
  glassValue: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.surface,
    letterSpacing: -0.8,
    marginTop: 4,
  },
  glassSub: {
    fontSize: 12,
    color: colors.onHeroMuted,
    marginTop: 2,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
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
  expiringChip: {
    width: 30,
    height: 30,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
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
