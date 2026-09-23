import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Pressable,
  Alert,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFridge } from '../context/FridgeContext';
import { useLanguage } from '../i18n';
import { useFridgeExpiry } from '../hooks/useFridgeExpiry';
import {
  Screen,
  ScreenHeader,
  Card,
  Icon,
  Badge,
  IconButton,
  EmptyState,
} from '../components/ui';
import { colors, radii, shadows, spacing, typography } from '../theme';
import ItemActionSheet from '../components/ItemActionSheet';

// The two ways the list can be read: each item's own date, or the freezer
// estimate applied to everything.
const LENS_ICON = { mine: 'calendar-outline', estimate: 'snow-outline' };

const statusTone = (status) => {
  switch (status) {
    case 'expired':
    case 'today':
      return 'danger';
    case 'tomorrow':
    case 'critical':
      return 'warning';
    case 'warning':
      return 'info';
    default:
      return 'default';
  }
};

const ExpiringItemsScreen = ({ navigation }) => {
  const { items, loading, deleteItem, consumeItem, consumePartial, throwItem, loadItems } = useFridge();
  const { getEffectiveExpiry, getFreezerInfo, usesManualExpiry, dateSource } = useFridgeExpiry();
  const { t, formatDate } = useLanguage();
  const [refreshing, setRefreshing] = useState(false);
  const [expiringItems, setExpiringItems] = useState([]);
  const [actionItem, setActionItem] = useState(null);
  // A temporary look at the other date, on this screen only. Starts from the
  // app-wide setting and returns to it when the screen is left, so the header
  // dropdown answers "what would this list say the other way?" without
  // quietly changing what Home and the notifications use.
  const [lens, setLens] = useState(dateSource);
  const [lensMenuOpen, setLensMenuOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const lensLabel = (key) =>
    t(key === 'mine' ? 'expiring.filterMine' : 'expiring.filterEstimate');

  useFocusEffect(
    useCallback(() => {
      setLens(dateSource);
    }, [dateSource])
  );

  useEffect(() => {
    if (!items || items.length === 0) {
      setExpiringItems([]);
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const list = items
      .map((item) => {
        const effectiveExpiry = getEffectiveExpiry(item, lens);
        if (!effectiveExpiry) return null;
        const diffDays = Math.ceil((effectiveExpiry - today) / 86400000);
        const showingEstimate = !usesManualExpiry(item, lens);

        let status = 'good';
        let statusText = '';
        if (diffDays < 0) { status = 'expired';   statusText = t('expiring.expired'); }
        else if (diffDays === 0) { status = 'today'; statusText = t('expiring.expiresToday'); }
        else if (diffDays === 1) { status = 'tomorrow'; statusText = t('expiring.expiresTomorrow'); }
        else if (diffDays <= 3)  { status = 'critical'; statusText = t('expiring.daysLeft', { count: diffDays }); }
        else if (diffDays <= 7)  { status = 'warning';  statusText = t('expiring.daysLeft', { count: diffDays }); }
        else return null;

        return { ...item, effectiveExpiry, daysLeft: diffDays, status, statusText, showingEstimate };
      })
      .filter(Boolean)
      .sort((a, b) => a.daysLeft - b.daysLeft);

    setExpiringItems(list);
  }, [items, lens]);

  // Both views only differ for items that carry a picked date AND a frozen
  // date; with none of those the filter would do nothing visible.
  const hasBothDates = (items || []).some((it) => it.expiry_date && it.frozen_date);

  const onRefresh = async () => {
    setRefreshing(true);
    try { await loadItems(); } catch (e) { console.error('Refresh error:', e); }
    finally { setRefreshing(false); }
  };

  const closeActions = () => setActionItem(null);

  const onUse = async () => {
    const item = actionItem;
    closeActions();
    if (!item) return;
    const result = await consumeItem(item.id);
    if (!result.success) Alert.alert(t('common.error'), result.error);
  };

  const onThrow = async () => {
    const item = actionItem;
    closeActions();
    if (!item) return;
    const result = await throwItem(item.id);
    if (!result.success) Alert.alert(t('common.error'), result.error);
  };

  // remaining <= 0 → used all of it (full consume); otherwise log the used
  // portion as consumed and reduce the quantity.
  const onPartial = async (remaining) => {
    const item = actionItem;
    closeActions();
    if (!item) return;
    const current = Number(item.quantity) || 0;
    const used = current - remaining;
    let result;
    if (remaining <= 0) {
      result = await consumeItem(item.id);
    } else if (used > 0) {
      result = await consumePartial(item.id, used);
    } else {
      return; // nothing actually used
    }
    if (!result.success) Alert.alert(t('common.error'), result.error);
  };

  return (
    <Screen>
      <ScreenHeader
        title={t('expiring.title')}
        subtitle={hasBothDates ? lensLabel(lens) : undefined}
        onBack={() => navigation.goBack()}
        backLabel={t('common.back')}
        right={hasBothDates ? (
          <TouchableOpacity
            onPress={() => setLensMenuOpen(true)}
            style={styles.lensButton}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('addItem.expirySourceLabel')}
          >
            <Icon name={LENS_ICON[lens]} size={15} color={colors.surface} />
            <Icon name="chevron-down" size={13} color={colors.surface} />
          </TouchableOpacity>
        ) : null}
      />

      {/* Which date the list is judged by. Anchored under the header button
          that opens it, so it reads as that control's menu rather than a
          general-purpose sheet. */}
      <Modal
        visible={lensMenuOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setLensMenuOpen(false)}
      >
        <Pressable style={styles.menuBackdrop} onPress={() => setLensMenuOpen(false)}>
          <Pressable style={[styles.menu, { top: insets.top + 56 }]}>
            <Text style={styles.menuTitle}>{t('addItem.expirySourceLabel')}</Text>
            {['mine', 'estimate'].map((key) => (
              <TouchableOpacity
                key={key}
                style={styles.menuRow}
                activeOpacity={0.7}
                onPress={() => { setLens(key); setLensMenuOpen(false); }}
              >
                <Icon
                  name={LENS_ICON[key]}
                  size={18}
                  color={lens === key ? colors.primary : colors.textMuted}
                />
                <Text style={[styles.menuLabel, lens === key && styles.menuLabelOn]} numberOfLines={1}>
                  {lensLabel(key)}
                </Text>
                {lens === key ? <Icon name="checkmark" size={18} color={colors.primary} /> : null}
              </TouchableOpacity>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {loading && expiringItems.length === 0 ? (
          <EmptyState description={t('common.loading')} />
        ) : expiringItems.length === 0 ? (
          <EmptyState
            icon="checkmark-circle-outline"
            title={t('expiring.allGood')}
            description={t('expiring.noItemsExpiring')}
          />
        ) : (
          <>
            <Card style={styles.banner}>
              <Icon name="alert-circle-outline" size={22} color="#92400E" />
              <Text style={styles.bannerText}>
                {t('expiring.itemsExpiring', { count: expiringItems.length })}
              </Text>
            </Card>

            {expiringItems.map((item) => (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.85}
                onPress={() => setActionItem(item)}
              >
              <Card style={styles.itemCard}>
                <View style={styles.itemHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <View style={styles.itemDrawerRow}>
                      <Icon name="cube-outline" size={13} color={colors.textMuted} />
                      <Text style={styles.itemDrawer}>{item.drawer}</Text>
                    </View>
                  </View>
                  <IconButton
                    name="pencil-outline"
                    variant="surface"
                    size={32}
                    onPress={() => navigation.navigate('EditItem', { item })}
                    accessibilityLabel={t('common.edit')}
                  />
                  <IconButton
                    name="checkmark-circle-outline"
                    variant="surface"
                    size={32}
                    onPress={() => setActionItem(item)}
                    accessibilityLabel={item.name}
                  />
                </View>

                <View style={styles.details}>
                  <DetailRow label={t('expiring.expires')} value={formatDate(item.effectiveExpiry)} />
                  {item.frozen_date && item.showingEstimate ? (() => {
                    const info = getFreezerInfo(item.name);
                    const label = info.isCategory
                      ? t(`shopping.cat_${info.labelKey}`)
                      : t(`freezerLabel.${info.labelKey}`);
                    return (
                      <Text style={styles.explainer}>
                        {t('expiring.basedOn', { months: info.months, category: label })}
                      </Text>
                    );
                  })() : null}
                  {item.frozen_date ? (
                    <DetailRow label={t('expiring.frozenOn')} value={formatDate(item.frozen_date)} />
                  ) : null}
                  {item.quantity && item.quantity > 1 ? (
                    <DetailRow label={t('expiring.quantity')} value={`${item.quantity}${item.unit ? ` ${item.unit}` : ''}`} />
                  ) : null}
                  {item.notes ? <DetailRow label={t('expiring.notes')} value={item.notes} /> : null}
                </View>

                <Badge tone={statusTone(item.status)} style={styles.badgeWide}>
                  {item.statusText}
                </Badge>
              </Card>
              </TouchableOpacity>
            ))}
          </>
        )}
        <View style={{ height: spacing.xxl }} />
      </ScrollView>

      <ItemActionSheet
        visible={!!actionItem}
        item={actionItem}
        onClose={closeActions}
        onUse={onUse}
        onThrow={onThrow}
        onPartial={onPartial}
      />
    </Screen>
  );
};

const DetailRow = ({ label, value }) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.warningSoft,
    marginBottom: spacing.lg,
  },
  bannerText: {
    ...typography.bodyStrong,
    color: '#92400E',
    flex: 1,
  },
  itemCard: {
    marginBottom: spacing.md,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  itemName: {
    ...typography.h3,
    color: colors.text,
  },
  itemDrawerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  itemDrawer: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
  details: {
    marginBottom: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    paddingVertical: 2,
  },
  detailLabel: {
    ...typography.bodySmall,
    color: colors.textMuted,
    width: 110,
  },
  detailValue: {
    ...typography.bodySmall,
    color: colors.text,
    flex: 1,
  },
  explainer: {
    ...typography.caption,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginLeft: 110,
    marginTop: 2,
    marginBottom: 4,
  },
  lensButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.whiteAlpha20,
  },
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.30)',
  },
  menu: {
    position: 'absolute',
    right: spacing.lg,
    minWidth: 210,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    ...shadows.cardRaised,
  },
  menuTitle: {
    ...typography.label,
    color: colors.textSubtle,
    paddingHorizontal: spacing.sm,
    paddingTop: 2,
    paddingBottom: 6,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    borderRadius: radii.md,
  },
  menuLabel: {
    ...typography.body,
    color: colors.text,
    flex: 1,
  },
  menuLabelOn: {
    fontWeight: '700',
    color: colors.primary,
  },
  badgeWide: {
    alignSelf: 'stretch',
    paddingVertical: 8,
    alignItems: 'center',
  },
});

export default ExpiringItemsScreen;
