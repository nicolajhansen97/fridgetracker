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
import { useAuth } from '../context/AuthContext';
import { useFridge } from '../context/FridgeContext';
import { useHousehold } from '../context/HouseholdContext';
import { useLanguage } from '../i18n';
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
  const { t } = useLanguage();
  const [refreshing, setRefreshing] = useState(false);

  // Compute summary
  const summary = useMemo(() => {
    if (!items || items.length === 0) {
      return { totalItems: 0, expiringCount: 0, drawersUsed: 0, expiringList: [], recent: [] };
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sevenDays = new Date(today);
    sevenDays.setDate(today.getDate() + 7);

    const expiringList = items
      .filter((i) => i.expiry_date)
      .map((i) => ({ ...i, _exp: new Date(i.expiry_date) }))
      .filter((i) => i._exp <= sevenDays)
      .sort((a, b) => a._exp - b._exp);

    const drawersUsed = new Set(items.map((i) => i.drawer)).size;
    const recent = [...items]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 4);

    return {
      totalItems: items.length,
      expiringCount: expiringList.length,
      drawersUsed,
      expiringList: expiringList.slice(0, 3),
      recent,
    };
  }, [items]);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return t('home.morning');
    if (h < 18) return t('home.afternoon');
    return t('home.evening');
  }, [t]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadItems(), loadHouseholds()]);
    } catch (e) {
      console.error('Refresh error:', e);
    } finally {
      setRefreshing(false);
    }
  };

  const formatExpiry = (isoDate) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const exp = new Date(isoDate);
    exp.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((exp - today) / 86400000);
    if (diffDays < 0) return t('expiring.expired');
    if (diffDays === 0) return t('expiring.expiresToday');
    if (diffDays === 1) return t('expiring.expiresTomorrow');
    return t('expiring.daysLeft', { count: diffDays });
  };

  const expiryTone = (isoDate) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const exp = new Date(isoDate);
    exp.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((exp - today) / 86400000);
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

  return (
    <Screen>
      <LinearGradient
        colors={gradients.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroHeader}
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
                  <View style={[styles.expiringDot, { backgroundColor: expiryTone(item.expiry_date) }]} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.expiringName} numberOfLines={1}>{item.name}</Text>
                    <View style={styles.expiringMetaRow}>
                      <Icon name="cube-outline" size={12} color={colors.textMuted} />
                      <Text style={styles.expiringMeta}>{item.drawer}</Text>
                    </View>
                  </View>
                  <Text style={[styles.expiringStatus, { color: expiryTone(item.expiry_date) }]}>
                    {formatExpiry(item.expiry_date)}
                  </Text>
                </View>
              ))}
            </Card>
          </>
        )}

        {/* Recent activity */}
        {summary.recent.length > 0 && (
          <>
            <SectionTitle>{t('home.recentActivity')}</SectionTitle>
            <Card padded={false}>
              {summary.recent.map((item, idx) => (
                <View
                  key={item.id}
                  style={[styles.activityRow, idx < summary.recent.length - 1 && styles.activityDivider]}
                >
                  <View style={styles.activityDot} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.activityTitle} numberOfLines={1}>{item.name}</Text>
                    <View style={styles.activityMetaRow}>
                      <Icon name="cube-outline" size={12} color={colors.textMuted} />
                      <Text style={styles.activityMeta}>{item.drawer} · {getTimeAgo(item.created_at)}</Text>
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
    paddingTop: spacing.md,
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
  activityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
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
