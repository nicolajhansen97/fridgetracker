import React from 'react';
import { Platform, StyleSheet, View, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n';
import { colors, shadows } from '../theme';

import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import HomeScreen from '../screens/HomeScreen';
import FridgeInventoryScreen from '../screens/FridgeInventoryScreen';
import AddItemScreen from '../screens/AddItemScreen';
import EditItemScreen from '../screens/EditItemScreen';
import ManageDrawersScreen from '../screens/ManageDrawersScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ExpiringItemsScreen from '../screens/ExpiringItemsScreen';
import ExpiryCalendarScreen from '../screens/ExpiryCalendarScreen';
import FreezerStatsScreen from '../screens/FreezerStatsScreen';
import StockInsightsScreen from '../screens/StockInsightsScreen';
import FreezerStorageSettingsScreen from '../screens/FreezerStorageSettingsScreen';
import NotificationSettingsScreen from '../screens/NotificationSettingsScreen';
import ActivityHistoryScreen from '../screens/ActivityHistoryScreen';
import ManageHouseholdScreen from '../screens/ManageHouseholdScreen';
import RecipeSuggestionsScreen from '../screens/RecipeSuggestionsScreen';
import ShoppingListScreen from '../screens/ShoppingListScreen';
import ChangelogScreen from '../screens/ChangelogScreen';
import FeedbackScreen from '../screens/FeedbackScreen';

const AuthStack = createNativeStackNavigator();
const HomeStack = createNativeStackNavigator();
const FreezerStack = createNativeStackNavigator();
const ProfileStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const stackScreenOptions = { headerShown: false };

const HomeStackNavigator = () => (
  <HomeStack.Navigator screenOptions={stackScreenOptions}>
    <HomeStack.Screen name="Home" component={HomeScreen} />
    <HomeStack.Screen name="ExpiringItems" component={ExpiringItemsScreen} />
    <HomeStack.Screen name="EditItem" component={EditItemScreen} />
    <HomeStack.Screen name="ManageDrawers" component={ManageDrawersScreen} />
    <HomeStack.Screen name="Calendar" component={ExpiryCalendarScreen} />
    <HomeStack.Screen name="FreezerStats" component={FreezerStatsScreen} />
    <HomeStack.Screen name="StockInsights" component={StockInsightsScreen} />
  </HomeStack.Navigator>
);

const FreezerStackNavigator = () => (
  <FreezerStack.Navigator screenOptions={stackScreenOptions}>
    <FreezerStack.Screen name="FridgeInventory" component={FridgeInventoryScreen} />
    <FreezerStack.Screen name="AddItem" component={AddItemScreen} />
    <FreezerStack.Screen name="EditItem" component={EditItemScreen} />
    <FreezerStack.Screen name="ManageDrawers" component={ManageDrawersScreen} />
  </FreezerStack.Navigator>
);

const ProfileStackNavigator = () => (
  <ProfileStack.Navigator screenOptions={stackScreenOptions}>
    <ProfileStack.Screen name="Profile" component={ProfileScreen} />
    <ProfileStack.Screen name="ManageDrawers" component={ManageDrawersScreen} />
    <ProfileStack.Screen name="ManageHousehold" component={ManageHouseholdScreen} />
    <ProfileStack.Screen name="ActivityHistory" component={ActivityHistoryScreen} />
    <ProfileStack.Screen name="Changelog" component={ChangelogScreen} />
    <ProfileStack.Screen name="Feedback" component={FeedbackScreen} />
    <ProfileStack.Screen name="FreezerStorageSettings" component={FreezerStorageSettingsScreen} />
    <ProfileStack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
  </ProfileStack.Navigator>
);

const tabIcon = (focusedName, unfocusedName) => ({ focused, color }) => (
  <Ionicons
    name={focused ? focusedName : unfocusedName}
    size={24}
    color={color}
  />
);

const tabIconWithBeta = (focusedName, unfocusedName) => ({ focused, color }) => (
  <View style={styles.tabIconWrap}>
    <Ionicons
      name={focused ? focusedName : unfocusedName}
      size={24}
      color={color}
    />
    <View style={styles.betaBadge}>
      <Text style={styles.betaText} numberOfLines={1} allowFontScaling={false}>
        BETA
      </Text>
    </View>
  </View>
);

const MainTabs = () => {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();

  // Tab bar height = a fixed content area + the device's bottom safe-area
  // inset. On iPhones with a home indicator this matches the system pill;
  // on Android with gesture nav / 3-button nav this stops the system bar
  // from covering the tabs.
  const tabBarBaseHeight = 56;
  const tabBarStyle = [
    styles.tabBar,
    {
      height: tabBarBaseHeight + insets.bottom,
      paddingBottom: insets.bottom + 4,
    },
  ];

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle,
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: styles.tabItem,
        tabBarHideOnKeyboard: Platform.OS === 'android',
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStackNavigator}
        options={{
          title: t('tabs.home'),
          tabBarIcon: tabIcon('home', 'home-outline'),
        }}
      />
      <Tab.Screen
        name="FreezerTab"
        component={FreezerStackNavigator}
        options={{
          title: t('tabs.freezer'),
          tabBarIcon: tabIcon('snow', 'snow-outline'),
        }}
      />
      <Tab.Screen
        name="ShoppingTab"
        component={ShoppingListScreen}
        options={{
          title: t('tabs.shopping'),
          tabBarIcon: tabIcon('cart', 'cart-outline'),
        }}
      />
      <Tab.Screen
        name="RecipesTab"
        component={RecipeSuggestionsScreen}
        options={{
          title: t('tabs.recipes'),
          tabBarIcon: tabIconWithBeta('restaurant', 'restaurant-outline'),
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStackNavigator}
        options={{
          title: t('tabs.profile'),
          tabBarIcon: tabIcon('person-circle', 'person-circle-outline'),
        }}
      />
    </Tab.Navigator>
  );
};

const AppNavigator = () => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return null;

  return (
    <>
      {/* Light status-bar icons: both the in-app gradient headers and the
          gradient auth screens have dark backgrounds. */}
      <StatusBar style="light" />
      <NavigationContainer>
        {isAuthenticated ? (
          <MainTabs />
        ) : (
          <AuthStack.Navigator screenOptions={stackScreenOptions}>
            <AuthStack.Screen name="Login" component={LoginScreen} />
            <AuthStack.Screen name="Register" component={RegisterScreen} />
            <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          </AuthStack.Navigator>
        )}
      </NavigationContainer>
    </>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingTop: 6,
    // height + paddingBottom are computed in MainTabs from useSafeAreaInsets
    ...shadows.card,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
    letterSpacing: 0.1,
  },
  tabItem: {
    paddingVertical: 4,
  },
  tabIconWrap: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  betaBadge: {
    position: 'absolute',
    top: -7,
    right: -14,
    backgroundColor: '#F97316',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
    minWidth: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  betaText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
    lineHeight: 11,
    includeFontPadding: false,
  },
});

export default AppNavigator;
