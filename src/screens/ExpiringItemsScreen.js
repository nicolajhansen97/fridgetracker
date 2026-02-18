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
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useFridge } from '../context/FridgeContext';

const ExpiringItemsScreen = ({ navigation }) => {
  const { items, loading, deleteItem, loadItems } = useFridge();
  const [refreshing, setRefreshing] = useState(false);
  const [expiringItems, setExpiringItems] = useState([]);

  useEffect(() => {
    calculateExpiringItems();
  }, [items]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadItems();
    setRefreshing(false);
  };

  const calculateExpiringItems = () => {
    if (!items || items.length === 0) {
      setExpiringItems([]);
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get items with expiry dates and categorize them
    const itemsWithExpiry = items
      .filter(item => item.expiry_date)
      .map(item => {
        const expiryDate = new Date(item.expiry_date);
        expiryDate.setHours(0, 0, 0, 0);

        const diffTime = expiryDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        let status = 'good';
        let statusText = '';

        if (diffDays < 0) {
          status = 'expired';
          statusText = 'Expired';
        } else if (diffDays === 0) {
          status = 'today';
          statusText = 'Expires today';
        } else if (diffDays === 1) {
          status = 'tomorrow';
          statusText = 'Expires tomorrow';
        } else if (diffDays <= 3) {
          status = 'critical';
          statusText = `${diffDays} days left`;
        } else if (diffDays <= 7) {
          status = 'warning';
          statusText = `${diffDays} days left`;
        } else {
          return null; // Don't show items with more than 7 days
        }

        return {
          ...item,
          daysLeft: diffDays,
          status,
          statusText,
        };
      })
      .filter(item => item !== null)
      .sort((a, b) => a.daysLeft - b.daysLeft);

    setExpiringItems(itemsWithExpiry);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case 'expired':
        return styles.statusExpired;
      case 'today':
        return styles.statusToday;
      case 'tomorrow':
        return styles.statusTomorrow;
      case 'critical':
        return styles.statusCritical;
      case 'warning':
        return styles.statusWarning;
      default:
        return styles.statusGood;
    }
  };

  const handleDelete = (item) => {
    Alert.alert(
      'Delete Item',
      `Are you sure you want to delete "${item.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const result = await deleteItem(item.id);
            if (!result.success) {
              Alert.alert('Error', result.error);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#ff6b6b', '#ee5a6f']} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Expiring Soon</Text>
          <View style={styles.placeholder} />
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {loading && expiringItems.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Loading...</Text>
          </View>
        ) : expiringItems.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>✨</Text>
            <Text style={styles.emptyTitle}>All Good!</Text>
            <Text style={styles.emptyText}>
              No items expiring in the next 7 days
            </Text>
          </View>
        ) : (
          <View style={styles.listContainer}>
            <View style={styles.infoCard}>
              <Text style={styles.infoIcon}>⚠️</Text>
              <Text style={styles.infoText}>
                {expiringItems.length} item{expiringItems.length !== 1 ? 's' : ''} expiring soon
              </Text>
            </View>

            {expiringItems.map((item) => (
              <View key={item.id} style={styles.itemCard}>
                <View style={styles.itemHeader}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemDrawer}>📦 {item.drawer}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDelete(item)}
                  >
                    <Text style={styles.deleteButtonText}>🗑️</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.itemDetails}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Expires:</Text>
                    <Text style={styles.detailValue}>
                      {formatDate(item.expiry_date)}
                    </Text>
                  </View>

                  {item.quantity && item.quantity > 1 && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Quantity:</Text>
                      <Text style={styles.detailValue}>{item.quantity}</Text>
                    </View>
                  )}

                  {item.notes && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Notes:</Text>
                      <Text style={styles.detailValue}>{item.notes}</Text>
                    </View>
                  )}
                </View>

                <View style={[styles.statusBadge, getStatusStyle(item.status)]}>
                  <Text style={styles.statusText}>{item.statusText}</Text>
                </View>
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
    backgroundColor: '#f5f5f5',
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
  infoCard: {
    backgroundColor: '#fff3cd',
    borderRadius: 15,
    padding: 15,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ffc107',
  },
  infoIcon: {
    fontSize: 24,
    marginRight: 10,
  },
  infoText: {
    fontSize: 15,
    color: '#856404',
    fontWeight: '600',
    flex: 1,
  },
  itemCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  itemDrawer: {
    fontSize: 14,
    color: '#666',
  },
  deleteButton: {
    padding: 5,
  },
  deleteButtonText: {
    fontSize: 20,
  },
  itemDetails: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  detailLabel: {
    fontSize: 14,
    color: '#888',
    width: 80,
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  statusBadge: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  statusExpired: {
    backgroundColor: '#ffe0e0',
  },
  statusToday: {
    backgroundColor: '#ffcccc',
  },
  statusTomorrow: {
    backgroundColor: '#ffd9b3',
  },
  statusCritical: {
    backgroundColor: '#ffe6b3',
  },
  statusWarning: {
    backgroundColor: '#fff3cd',
  },
  statusGood: {
    backgroundColor: '#d4edda',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
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
  },
});

export default ExpiringItemsScreen;
