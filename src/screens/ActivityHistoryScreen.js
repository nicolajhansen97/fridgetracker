import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useActivity } from '../context/ActivityContext';
import { useLanguage } from '../i18n';
import {
  Screen,
  ScreenHeader,
  Card,
  Icon,
  EmptyState,
} from '../components/ui';
import { colors, spacing, typography } from '../theme';

const actionIconName = (action) => {
  switch (action) {
    case 'created': return 'add-circle-outline';
    case 'updated': return 'create-outline';
    case 'consumed': return 'restaurant-outline';
    case 'deleted': return 'trash-outline';
    default: return 'document-text-outline';
  }
};

const actionColorMap = {
  created: '#065F46',
  updated: '#92400E',
  consumed: '#075985',
  deleted: '#991B1B',
};

const ActivityHistoryScreen = ({ navigation }) => {
  const { activities, loading, loadActivities, getActivityDescription } = useActivity();
  const { t, formatDate } = useLanguage();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try { await loadActivities(); } catch (e) { console.error('Refresh error:', e); }
    finally { setRefreshing(false); }
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return t('activity.justNow');
    if (diffMins < 60) return t('activity.minAgo', { count: diffMins });
    if (diffHours < 24) return t('activity.hourAgo', { count: diffHours });
    if (diffDays < 7) return t('activity.dayAgo', { count: diffDays });
    return formatDate(timestamp);
  };

  const fieldLabels = {
    position: t('activity.fieldPackage'),
    expiry_date: t('activity.fieldExpiry'),
    drawer: t('activity.fieldCompartment'),
    quantity: t('activity.fieldQuantity'),
    name: t('activity.fieldName'),
    notes: t('activity.fieldNotes'),
  };

  const formatValue = (val) => {
    if (val === null || val === undefined || val === '') return '';
    return JSON.stringify(val).replace(/^"(.*)"$/, '$1');
  };

  return (
    <Screen>
      <ScreenHeader
        title={t('activity.title')}
        onBack={() => navigation.goBack()}
        backLabel={t('common.back')}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {loading && activities.length === 0 ? (
          <EmptyState description={t('common.loading')} />
        ) : activities.length === 0 ? (
          <EmptyState
            icon="bar-chart-outline"
            title={t('activity.noActivity')}
            description={t('activity.noActivityDesc')}
          />
        ) : (
          activities.map((activity) => {
            const changes = activity.changes
              ? Object.entries(activity.changes).filter(([field, change]) => {
                  if (!change) return false;
                  if (change.old === null && change.new === null) return false;
                  if ((field === 'notes' || field === 'position') &&
                      (change.old == null || change.new == null || change.old === '' || change.new === '')) {
                    return false;
                  }
                  return true;
                })
              : [];

            return (
              <Card key={activity.id} style={styles.card}>
                <View style={styles.headerRow}>
                  <View style={styles.actionPill}>
                    <Icon
                      name={actionIconName(activity.action)}
                      size={14}
                      color={actionColorMap[activity.action] || colors.textMuted}
                    />
                    <Text style={[styles.actionPillText, { color: actionColorMap[activity.action] || colors.textMuted }]}>
                      {t(`activity.${activity.action}`)}
                    </Text>
                  </View>
                  <Text style={styles.timestamp}>{formatTimestamp(activity.created_at)}</Text>
                </View>

                <Text style={styles.description}>{getActivityDescription(activity)}</Text>

                <View style={styles.userRow}>
                  <Text style={styles.userLabel}>{t('activity.by')}</Text>
                  <Text style={styles.userEmail} numberOfLines={1}>{activity.user_email}</Text>
                </View>

                {changes.length > 0 && (
                  <View style={styles.changes}>
                    <Text style={styles.changesLabel}>{t('activity.changes')}</Text>
                    {changes.map(([field, change]) => (
                      <View key={field} style={styles.changeRow}>
                        <Text style={styles.changeField}>{fieldLabels[field] || field}</Text>
                        {change && change.old !== undefined && change.new !== undefined ? (
                          <Text style={styles.changeValue}>
                            {formatValue(change.old) || t('activity.empty')} → {formatValue(change.new) || t('activity.empty')}
                          </Text>
                        ) : (
                          <Text style={styles.changeValue}>{formatValue(change)}</Text>
                        )}
                      </View>
                    ))}
                  </View>
                )}
              </Card>
            );
          })
        )}
        <View style={{ height: spacing.xxl }} />
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
  card: {
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  actionPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  timestamp: {
    ...typography.caption,
    color: colors.textSubtle,
  },
  description: {
    ...typography.bodyStrong,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  userLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginRight: 6,
  },
  userEmail: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
    flex: 1,
  },
  changes: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  changesLabel: {
    ...typography.label,
    color: colors.textMuted,
    marginBottom: 6,
  },
  changeRow: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  changeField: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '600',
    width: 100,
  },
  changeValue: {
    ...typography.caption,
    color: colors.text,
    flex: 1,
  },
});

export default ActivityHistoryScreen;
