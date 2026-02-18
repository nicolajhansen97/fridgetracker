import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { useFridge } from '../context/FridgeContext';
import { useHousehold } from '../context/HouseholdContext';

const HomeScreen = ({ navigation }) => {
  const { user, logout } = useAuth();
  const { items } = useFridge();
  const { currentHousehold, invitations } = useHousehold();
  const [stats, setStats] = useState({
    totalItems: 0,
    expiringItems: 0,
    drawersUsed: 0,
  });
  const [recentActivity, setRecentActivity] = useState([]);

  useEffect(() => {
    calculateStats();
  }, [items]);

  const calculateStats = () => {
    if (!items || items.length === 0) {
      setStats({ totalItems: 0, expiringItems: 0, drawersUsed: 0 });
      setRecentActivity([]);
      return;
    }

    // Calculate total items
    const totalItems = items.length;

    // Calculate items expiring within 7 days
    const today = new Date();
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(today.getDate() + 7);

    const expiringItems = items.filter(item => {
      if (!item.expiry_date) return false;
      const expiryDate = new Date(item.expiry_date);
      return expiryDate >= today && expiryDate <= sevenDaysFromNow;
    }).length;

    // Calculate unique drawers
    const uniqueDrawers = new Set(items.map(item => item.drawer));
    const drawersUsed = uniqueDrawers.size;

    setStats({ totalItems, expiringItems, drawersUsed });

    // Get recent activity (last 3 items added)
    const sortedItems = [...items]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 3);

    const activity = sortedItems.map(item => ({
      title: `Added ${item.name}`,
      description: `to ${item.drawer}`,
      time: getTimeAgo(item.created_at),
    }));

    setRecentActivity(activity);
  };

  const getTimeAgo = (timestamp) => {
    const now = new Date();
    const past = new Date(timestamp);
    const diffInMinutes = Math.floor((now - past) / (1000 * 60));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes} min ago`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;

    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
  };

  const handleLogout = async () => {
    await logout();
    // Navigation will be handled automatically by AuthContext
    // when isAuthenticated changes to false
  };

  const handleCardPress = (card) => {
    if (card.id === 1) {
      navigation.navigate('FridgeInventory');
    } else if (card.id === 2) {
      navigation.navigate('Settings');
    } else if (card.id === 3) {
      navigation.navigate('ManageDrawers');
    } else if (card.id === 4) {
      navigation.navigate('ManageHousehold');
    } else if (card.id === 5) {
      navigation.navigate('ActivityHistory');
    }
  };

  const cards = [
    { id: 1, title: 'My Freezer', icon: '❄️', color: ['#43e97b', '#38f9d7'], screen: 'FridgeInventory' },
    { id: 4, title: 'Family Sharing', icon: '👨‍👩‍👧', color: ['#FFD93D', '#FFAF37'], screen: 'ManageHousehold' },
    { id: 5, title: 'Activity History', icon: '📊', color: ['#667eea', '#764ba2'], screen: 'ActivityHistory' },
    { id: 3, title: 'Manage Compartments', icon: '📦', color: ['#4facfe', '#00f2fe'], screen: 'ManageDrawers' },
    { id: 2, title: 'Settings', icon: '⚙️', color: ['#f093fb', '#f5576c'], screen: 'Settings' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View style={styles.userInfo}>
            <Text style={styles.greeting}>Hello,</Text>
            <Text style={styles.username}>
              {user?.email || 'User'}
            </Text>
          </View>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Quick Access</Text>

        <View style={styles.cardsContainer}>
          {cards.map((card) => (
            <TouchableOpacity
              key={card.id}
              style={styles.cardWrapper}
              onPress={() => handleCardPress(card)}
            >
              <LinearGradient
                colors={card.color}
                style={styles.card}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.cardIcon}>{card.icon}</Text>
                <Text style={styles.cardTitle}>{card.title}</Text>
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.statsContainer}>
          <Text style={styles.sectionTitle}>Your Fridge Stats</Text>

          <View style={styles.statCard}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.totalItems}</Text>
              <Text style={styles.statLabel}>Total Items</Text>
            </View>
            <View style={styles.statDivider} />
            <TouchableOpacity
              style={styles.statItem}
              onPress={() => navigation.navigate('ExpiringItems')}
              activeOpacity={0.7}
            >
              <Text style={[styles.statValue, stats.expiringItems > 0 && styles.statValueWarning]}>
                {stats.expiringItems}
              </Text>
              <Text style={styles.statLabel}>Expiring Soon</Text>
              {stats.expiringItems > 0 && (
                <Text style={styles.tapHint}>Tap to view</Text>
              )}
            </TouchableOpacity>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.drawersUsed}</Text>
              <Text style={styles.statLabel}>Drawers Used</Text>
            </View>
          </View>
        </View>

        <View style={styles.activityContainer}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>

          {recentActivity.length === 0 ? (
            <View style={styles.emptyActivity}>
              <Text style={styles.emptyActivityIcon}>📋</Text>
              <Text style={styles.emptyActivityText}>No recent activity</Text>
              <Text style={styles.emptyActivitySubtext}>
                Add items to your fridge to see them here
              </Text>
            </View>
          ) : (
            recentActivity.map((activity, index) => (
              <View key={index} style={styles.activityItem}>
                <View style={styles.activityDot} />
                <View style={styles.activityContent}>
                  <Text style={styles.activityTitle}>{activity.title}</Text>
                  <Text style={styles.activityDescription}>{activity.description}</Text>
                  <Text style={styles.activityTime}>{activity.time}</Text>
                </View>
              </View>
            ))
          )}
        </View>
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
    paddingBottom: 30,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userInfo: {
    flex: 1,
    marginRight: 15,
  },
  greeting: {
    fontSize: 16,
    color: '#ffffff',
    opacity: 0.9,
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginTop: 5,
  },
  logoutButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  logoutText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  cardsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  cardWrapper: {
    width: '48%',
    marginBottom: 15,
  },
  card: {
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    height: 120,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  cardIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    textAlign: 'center',
  },
  statsContainer: {
    marginBottom: 30,
  },
  statCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#667eea',
    marginBottom: 5,
  },
  statValueWarning: {
    color: '#ff6b6b',
  },
  statLabel: {
    fontSize: 12,
    color: '#888',
  },
  tapHint: {
    fontSize: 10,
    color: '#ff6b6b',
    marginTop: 4,
    fontWeight: '600',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#e0e0e0',
  },
  activityContainer: {
    marginBottom: 30,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 15,
    borderRadius: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2.22,
    elevation: 3,
  },
  activityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#667eea',
    marginRight: 15,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 3,
  },
  activityDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  activityTime: {
    fontSize: 12,
    color: '#888',
  },
  emptyActivity: {
    backgroundColor: '#ffffff',
    borderRadius: 15,
    padding: 40,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2.22,
    elevation: 3,
  },
  emptyActivityIcon: {
    fontSize: 48,
    marginBottom: 15,
  },
  emptyActivityText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  emptyActivitySubtext: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
});

export default HomeScreen;
