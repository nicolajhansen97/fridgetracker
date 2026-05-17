import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  RefreshControl,
} from 'react-native';
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
import { colors, spacing, typography } from '../theme';

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
  const { items, loading, deleteItem, loadItems } = useFridge();
  const { getEffectiveExpiry, getDaysUntilExpiry, getFreezerInfo } = useFridgeExpiry();
  const { t } = useLanguage();
  const [refreshing, setRefreshing] = useState(false);
  const [expiringItems, setExpiringItems] = useState([]);

  useEffect(() => {
    if (!items || items.length === 0) {
      setExpiringItems([]);
      return;
    }

    const list = items
      .map((item) => {
        const effectiveExpiry = getEffectiveExpiry(item);
        if (!effectiveExpiry) return null;
        const diffDays = getDaysUntilExpiry(item);

        let status = 'good';
        let statusText = '';
        if (diffDays < 0) { status = 'expired';   statusText = t('expiring.expired'); }
        else if (diffDays === 0) { status = 'today'; statusText = t('expiring.expiresToday'); }
        else if (diffDays === 1) { status = 'tomorrow'; statusText = t('expiring.expiresTomorrow'); }
        else if (diffDays <= 3)  { status = 'critical'; statusText = t('expiring.daysLeft', { count: diffDays }); }
        else if (diffDays <= 7)  { status = 'warning';  statusText = t('expiring.daysLeft', { count: diffDays }); }
        else return null;

        return { ...item, effectiveExpiry, daysLeft: diffDays, status, statusText };
      })
      .filter(Boolean)
      .sort((a, b) => a.daysLeft - b.daysLeft);

    setExpiringItems(list);
  }, [items]);

  const onRefresh = async () => {
    setRefreshing(true);
    try { await loadItems(); } catch (e) { console.error('Refresh error:', e); }
    finally { setRefreshing(false); }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const d = new Date(dateString);
    return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
  };

  const handleDelete = (item) => {
    Alert.alert(t('inventory.deleteItem'), t('inventory.confirmDelete', { name: item.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          const result = await deleteItem(item.id);
          if (!result.success) Alert.alert(t('common.error'), result.error);
        },
      },
    ]);
  };

  return (
    <Screen>
      <ScreenHeader
        title={t('expiring.title')}
        onBack={() => navigation.goBack()}
        backLabel={t('common.back')}
      />

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
              <Card key={item.id} style={styles.itemCard}>
                <View style={styles.itemHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <View style={styles.itemDrawerRow}>
                      <Icon name="cube-outline" size={13} color={colors.textMuted} />
                      <Text style={styles.itemDrawer}>{item.drawer}</Text>
                    </View>
                  </View>
                  <IconButton name="trash-outline" variant="surface" size={32} onPress={() => handleDelete(item)} />
                </View>

                <View style={styles.details}>
                  <DetailRow label={t('expiring.expires')} value={formatDate(item.effectiveExpiry)} />
                  {item.frozen_date ? (() => {
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
                    <DetailRow label={t('expiring.quantity')} value={item.quantity} />
                  ) : null}
                  {item.notes ? <DetailRow label={t('expiring.notes')} value={item.notes} /> : null}
                </View>

                <Badge tone={statusTone(item.status)} style={styles.badgeWide}>
                  {item.statusText}
                </Badge>
              </Card>
            ))}
          </>
        )}
        <View style={{ height: spacing.xxl }} />
      </ScrollView>
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
    width: 84,
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
    marginLeft: 84,
    marginTop: 2,
    marginBottom: 4,
  },
  badgeWide: {
    alignSelf: 'stretch',
    paddingVertical: 8,
    alignItems: 'center',
  },
});

export default ExpiringItemsScreen;
