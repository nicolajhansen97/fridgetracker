import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  RefreshControl,
  TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFridge } from '../context/FridgeContext';
import { useDrawers } from '../context/DrawerContext';
import { useLanguage } from '../i18n';
import { useFridgeExpiry } from '../hooks/useFridgeExpiry';
import {
  Screen,
  ScreenHeader,
  Card,
  Icon,
  IconButton,
  Pill,
  Badge,
  EmptyState,
  PrimaryButton,
} from '../components/ui';
import { colors, gradients, radii, shadows, spacing, typography } from '../theme';
import ItemActionSheet from '../components/ItemActionSheet';

// Dark amber for the "Use first" tag — high contrast on the amber fill.
const USE_FIRST_FG = '#7C2D12';

const FridgeInventoryScreen = ({ navigation }) => {
  const { items, deleteItem, consumeItem, consumePartial, throwItem, loadItems } = useFridge();
  const { drawers: drawerDefs } = useDrawers();
  const { getEffectiveExpiry, isExpiringSoon: isItemExpiringSoon } = useFridgeExpiry();
  const { t, formatDate } = useLanguage();
  const hasDrawers = (drawerDefs?.length || 0) > 0;
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showExpiringSoon, setShowExpiringSoon] = useState(false);
  const [actionItem, setActionItem] = useState(null);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadItems();
    } catch (e) {
      console.error('Refresh error:', e);
    } finally {
      setRefreshing(false);
    }
  };

  const handleDelete = (item) => setActionItem(item);

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

  const filteredItems = items.filter((item) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const nameMatch = item.name.toLowerCase().includes(query);
      const positionMatch = item.position && String(item.position) === searchQuery.trim();
      if (!nameMatch && !positionMatch) return false;
    }
    if (showExpiringSoon && !isItemExpiringSoon(item)) return false;
    return true;
  });

  // When a search is active and turns up more than one match, surface the single
  // item to use first — the one whose effective expiry is soonest — pinned at the
  // top so the user can act on it without scrolling to hunt it down.
  const isSearching = searchQuery.trim().length > 0;
  let useFirstItem = null;
  if (isSearching && filteredItems.length > 1) {
    let soonest = null;
    for (const it of filteredItems) {
      const exp = getEffectiveExpiry(it);
      if (!exp) continue;
      if (!soonest || exp < soonest.exp) soonest = { item: it, exp };
    }
    useFirstItem = soonest ? soonest.item : null;
  }
  const useFirstId = useFirstItem ? useFirstItem.id : null;

  const grouped = filteredItems.reduce((acc, item) => {
    const k = item.drawer || 'Other';
    (acc[k] ||= []).push(item);
    return acc;
  }, {});
  const drawers = Object.keys(grouped).sort();

  return (
    <Screen>
      <ScreenHeader
        title={t('inventory.myFreezer')}
        right={
          <IconButton
            name="cube-outline"
            variant="onHero"
            size={40}
            onPress={() => navigation.navigate('ManageDrawers')}
            accessibilityLabel={t('drawers.title')}
          />
        }
      />

      <View style={styles.searchRow}>
        <View style={styles.searchInputWrapper}>
          <Icon name="search" size={16} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('inventory.searchItems')}
            placeholderTextColor={colors.textSubtle}
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
        </View>
        <Pill
          label={t('inventory.expiring')}
          icon={
            <Icon
              name="time-outline"
              size={14}
              color={showExpiringSoon ? colors.surface : colors.textMuted}
            />
          }
          selected={showExpiringSoon}
          onPress={() => setShowExpiringSoon((v) => !v)}
        />
      </View>

      {/* Pinned above the list so the item to grab first stays visible while
          scrolling — no hunting through results. Tapping opens its actions. */}
      {useFirstItem ? (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => setActionItem(useFirstItem)}
          style={styles.useFirstBanner}
        >
          <View style={styles.useFirstBannerIcon}>
            <Icon name="arrow-up" size={20} color={USE_FIRST_FG} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.useFirstBannerLabel}>{t('home.useFirst')}</Text>
            <Text style={styles.useFirstBannerName} numberOfLines={1}>{useFirstItem.name}</Text>
            <Text style={styles.useFirstBannerMeta} numberOfLines={1}>
              {useFirstItem.drawer}
              {useFirstItem.position ? ` · ${t('inventory.pkg', { position: useFirstItem.position })}` : ''}
              {` · ${t('inventory.exp', { date: formatDate(getEffectiveExpiry(useFirstItem)) })}`}
            </Text>
          </View>
          <Icon name="chevron-forward" size={18} color={USE_FIRST_FG} />
        </TouchableOpacity>
      ) : null}

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {items.length === 0 && !hasDrawers ? (
          <EmptyState
            icon="cube-outline"
            title={t('inventory.noDrawersTitle')}
            description={t('inventory.noDrawersDesc')}
            action={
              <PrimaryButton
                title={t('drawers.addCompartment')}
                onPress={() => navigation.navigate('ManageDrawers')}
              />
            }
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon="snow-outline"
            title={t('inventory.freezerEmpty')}
            description={t('inventory.startAdding')}
            action={
              <PrimaryButton
                title={t('inventory.addFirstItem')}
                onPress={() => navigation.navigate('AddItem')}
              />
            }
          />
        ) : filteredItems.length === 0 ? (
          <EmptyState
            icon="search"
            title={t('inventory.noResults')}
            description={t('inventory.tryDifferentSearch')}
          />
        ) : (
          drawers.map((drawer) => (
            <View key={drawer} style={styles.drawerSection}>
              <View style={styles.drawerTitleRow}>
                <Icon name="cube-outline" size={18} color={colors.textMuted} />
                <Text style={styles.drawerTitle}>{drawer}</Text>
              </View>
              {grouped[drawer].map((item) => {
                const effectiveExpiry = getEffectiveExpiry(item);
                const expiringSoon = isItemExpiringSoon(item);
                const isUseFirst = item.id === useFirstId;
                return (
                  <Card
                    key={item.id}
                    style={[styles.itemCard, isUseFirst && styles.itemCardUseFirst]}
                    padded={false}
                  >
                    <View style={styles.itemRow}>
                      <View style={styles.iconBox}>
                        <Icon name="snow-outline" size={20} color={colors.primary} />
                      </View>
                      <View style={styles.itemContent}>
                        <Text style={styles.itemName}>{item.name}</Text>
                        {item.notes ? (
                          <Text style={styles.itemNotes} numberOfLines={1}>{item.notes}</Text>
                        ) : null}
                        <View style={styles.badges}>
                          {isUseFirst ? (
                            <View style={styles.useFirstBadge}>
                              <Icon name="arrow-up" size={12} color={USE_FIRST_FG} />
                              <Text style={styles.useFirstBadgeText}>{t('home.useFirst')}</Text>
                            </View>
                          ) : null}
                          {item.quantity ? (
                            <Badge tone="primary">
                              {item.quantity}{item.unit ? ` ${item.unit}` : ''}
                            </Badge>
                          ) : null}
                          {item.position ? (
                            <Badge tone="info">
                              {t('inventory.pkg', { position: item.position })}
                            </Badge>
                          ) : null}
                          {effectiveExpiry ? (
                            <Badge tone={expiringSoon ? 'danger' : 'default'}>
                              {t('inventory.exp', { date: formatDate(effectiveExpiry) })}
                            </Badge>
                          ) : null}
                        </View>
                      </View>
                      <View style={styles.actions}>
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
                          onPress={() => handleDelete(item)}
                          accessibilityLabel={item.name}
                        />
                      </View>
                    </View>
                  </Card>
                );
              })}
            </View>
          ))
        )}

        <View style={{ height: 96 }} />
      </ScrollView>

      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => navigation.navigate('AddItem')}
        style={styles.fab}
      >
        <LinearGradient
          colors={gradients.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fabInner}
        >
          <Icon name="add" size={28} color={colors.surface} />
        </LinearGradient>
      </TouchableOpacity>

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

const styles = StyleSheet.create({
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  drawerSection: {
    marginBottom: spacing.xxl,
  },
  drawerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.md,
  },
  drawerTitle: {
    ...typography.h3,
    color: colors.text,
  },
  itemCard: {
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  itemCardUseFirst: {
    borderColor: colors.warning,
    borderWidth: 1.5,
  },
  useFirstBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.warningSoft,
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  useFirstBannerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.warning,
    alignItems: 'center',
    justifyContent: 'center',
  },
  useFirstBannerLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: USE_FIRST_FG,
    textTransform: 'uppercase',
  },
  useFirstBannerName: {
    ...typography.bodyStrong,
    color: colors.text,
    marginTop: 1,
  },
  useFirstBannerMeta: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  useFirstBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.warning,
    borderRadius: radii.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  useFirstBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: USE_FIRST_FG,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemContent: {
    flex: 1,
    minWidth: 0,
  },
  itemName: {
    ...typography.bodyStrong,
    color: colors.text,
  },
  itemNotes: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  actions: {
    flexDirection: 'column',
    gap: 6,
  },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.xl,
    borderRadius: radii.lg + 2,
    ...shadows.fab,
  },
  fabInner: {
    width: 56,
    height: 56,
    borderRadius: radii.lg + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default FridgeInventoryScreen;
