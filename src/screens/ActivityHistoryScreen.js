import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useActivity } from '../context/ActivityContext';

const ActivityHistoryScreen = ({ navigation }) => {
  const { activities, loading, loadActivities, getActivityDescription } = useActivity();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadActivities();
    setRefreshing(false);
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const getActionColor = (action) => {
    switch (action) {
      case 'created':
        return '#4caf50';
      case 'updated':
        return '#ff9800';
      case 'deleted':
        return '#f44336';
      default:
        return '#888';
    }
  };

  const getActionIcon = (action) => {
    switch (action) {
      case 'created':
        return '✅';
      case 'updated':
        return '📝';
      case 'deleted':
        return '🗑️';
      default:
        return '📋';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#667eea', '#764ba2']} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Activity History</Text>
          <View style={styles.placeholder} />
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading && activities.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Loading...</Text>
          </View>
        ) : activities.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text style={styles.emptyTitle}>No Activity Yet</Text>
            <Text style={styles.emptyText}>
              Activity will appear here as you add, update, or remove items
            </Text>
          </View>
        ) : (
          <View style={styles.listContainer}>
            {activities.map((activity) => (
              <View key={activity.id} style={styles.activityCard}>
                <View style={styles.activityHeader}>
                  <View style={styles.actionBadge}>
                    <Text style={styles.actionIcon}>{getActionIcon(activity.action)}</Text>
                    <Text
                      style={[
                        styles.actionText,
                        { color: getActionColor(activity.action) },
                      ]}
                    >
                      {activity.action.toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.timestamp}>{formatTimestamp(activity.created_at)}</Text>
                </View>

                <Text style={styles.description}>{getActivityDescription(activity)}</Text>

                <View style={styles.userInfo}>
                  <Text style={styles.userLabel}>By:</Text>
                  <Text style={styles.userEmail}>
                    {activity.user_email}
                  </Text>
                </View>

                {activity.changes && Object.keys(activity.changes).length > 0 && (
                  <View style={styles.changesContainer}>
                    <Text style={styles.changesLabel}>Changes:</Text>
                    {Object.entries(activity.changes)
                      .filter(([field, change]) => {
                        // Skip if change is null or undefined
                        if (!change) return false;

                        // Hide changes where both old and new are null
                        if (change.old === null && change.new === null) return false;

                        // Hide notes and position changes if either value is null/empty
                        if ((field === 'notes' || field === 'position') &&
                            (change.old === null || change.new === null ||
                             change.old === '' || change.new === '')) {
                          return false;
                        }

                        return true;
                      })
                      .map(([field, change]) => {
                        // Make field names more user-friendly
                        const fieldLabels = {
                          position: 'Package #',
                          expiry_date: 'Expiry Date',
                          drawer: 'Compartment',
                          quantity: 'Quantity',
                          name: 'Name',
                          notes: 'Notes',
                        };
                        const fieldLabel = fieldLabels[field] || field;

                        // Format values
                        const formatValue = (val) => {
                          if (val === null || val === undefined || val === '') return '';
                          // Remove quotes from strings for cleaner display
                          const stringVal = JSON.stringify(val);
                          return stringVal.replace(/^"(.*)"$/, '$1');
                        };

                        return (
                          <View key={field} style={styles.changeRow}>
                            <Text style={styles.changeField}>{fieldLabel}:</Text>
                            {change && change.old !== undefined && change.new !== undefined ? (
                              <Text style={styles.changeValue}>
                                {formatValue(change.old) || '(empty)'} → {formatValue(change.new) || '(empty)'}
                              </Text>
                            ) : (
                              <Text style={styles.changeValue}>{formatValue(change)}</Text>
                            )}
                          </View>
                        );
                      })}
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  header: {
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  placeholder: {
    width: 70,
  },
  content: {
    flex: 1,
  },
  listContainer: {
    padding: 20,
  },
  activityCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  actionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionIcon: {
    fontSize: 18,
    marginRight: 6,
  },
  actionText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  timestamp: {
    fontSize: 12,
    color: '#888',
  },
  description: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
    fontWeight: '500',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  userLabel: {
    fontSize: 14,
    color: '#888',
    marginRight: 6,
  },
  userEmail: {
    fontSize: 12,
    color: '#667eea',
    fontWeight: '500',
    flex: 1,
  },
  changesContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  changesLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 6,
    fontWeight: '600',
  },
  changeRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  changeField: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
    width: 100,
  },
  changeValue: {
    fontSize: 12,
    color: '#333',
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 100,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});

export default ActivityHistoryScreen;
