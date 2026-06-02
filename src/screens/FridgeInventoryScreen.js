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

const FridgeInventoryScreen = ({ navigation }) => {
  const { items, deleteItem, consumeItem, loadItems } = useFridge();
  const { drawers: drawerDefs } = useDrawers();
  const { getEffectiveExpiry, isExpiringSoon: isItemExpiringSoon } = useFridgeExpiry();
  const { t, formatDate } = useLanguage();
  const hasDrawers = (drawerDefs?.length || 0) > 0;
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showExpiringSoon, setShowExpiringSoon] = useState(false);

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

  const handleDelete = (item) => {
    Alert.alert(item.name, null, [
      {
        text: t('inventory.useItem'),
        onPress: async () => {
          const result = await consumeItem(item.id);
          if (!result.success) Alert.alert(t('common.error'), result.error);
        },
      },
      {
        text: t('inventory.throwAway'),
        style: 'destructive',
        onPress: async () => {
          const result = await deleteItem(item.id);
          if (!result.success) Alert.alert(t('common.error'), result.error);
        },
      },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
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
        onBack={() => navigation.goBack()}
        backLabel={t('common.back')}
        right={
          <IconButton
            name="cube-outline"
            variant="onHero"
            size={36}
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
                return (
                  <Card key={item.id} style={styles.itemCard} padded={false}>
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
                        />
                        <IconButton
                          name="trash-outline"
                          variant="surface"
                          size={32}
                          onPress={() => handleDelete(item)}
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
    backgroundColor: '#ECFEFF',
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
