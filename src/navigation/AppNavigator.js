import React from 'react';
import { Platform, StyleSheet, View, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeBottomTabNavigator } from '@react-navigation/bottom-tabs/unstable';
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
import SettingsScreen from '../screens/SettingsScreen';
import FreezerStorageSettingsScreen from '../screens/FreezerStorageSettingsScreen';
import NotificationSettingsScreen from '../screens/NotificationSettingsScreen';
import ActivityHistoryScreen from '../screens/ActivityHistoryScreen';
import ManageHouseholdScreen from '../screens/ManageHouseholdScreen';
import RecipeSuggestionsScreen from '../screens/RecipeSuggestionsScreen';
import MealPlanScreen from '../screens/MealPlanScreen';
import ShoppingListScreen from '../screens/ShoppingListScreen';
import ChangelogScreen from '../screens/ChangelogScreen';
import FeedbackScreen from '../screens/FeedbackScreen';

const AuthStack = createNativeStackNavigator();
const HomeStack = createNativeStackNavigator();
const FreezerStack = createNativeStackNavigator();
const ProfileStack = createNativeStackNavigator();
const RecipesStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const NativeTab = createNativeBottomTabNavigator();

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

// Recipes became a stack when the meal planner landed: the planner is where
// a suggestion turns into a decision, so it belongs one push away from the
// suggestions rather than in a tab of its own.
const RecipesStackNavigator = () => (
  <RecipesStack.Navigator screenOptions={stackScreenOptions}>
    <RecipesStack.Screen name="RecipeSuggestions" component={RecipeSuggestionsScreen} />
    <RecipesStack.Screen name="MealPlan" component={MealPlanScreen} />
  </RecipesStack.Navigator>
);

const ProfileStackNavigator = () => (
  <ProfileStack.Navigator screenOptions={stackScreenOptions}>
    <ProfileStack.Screen name="Profile" component={ProfileScreen} />
    <ProfileStack.Screen name="ManageDrawers" component={ManageDrawersScreen} />
    <ProfileStack.Screen name="ManageHousehold" component={ManageHouseholdScreen} />
    <ProfileStack.Screen name="ActivityHistory" component={ActivityHistoryScreen} />
    <ProfileStack.Screen name="Changelog" component={ChangelogScreen} />
    <ProfileStack.Screen name="Feedback" component={FeedbackScreen} />
    <ProfileStack.Screen name="Settings" component={SettingsScreen} />
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

// The five tabs, defined once and rendered by whichever tab navigator the
// platform uses. `ion` = Ionicons [focused, unfocused] for the JS tab bar,
// `sf` = SF Symbols [focused, unfocused] for the native iOS tab bar.
const TABS = [
  { name: 'HomeTab', component: HomeStackNavigator, titleKey: 'tabs.home', ion: ['home', 'home-outline'], sf: ['house.fill', 'house'] },
  { name: 'FreezerTab', component: FreezerStackNavigator, titleKey: 'tabs.freezer', ion: ['snow', 'snow-outline'], sf: ['snowflake', 'snowflake'] },
  { name: 'ShoppingTab', component: ShoppingListScreen, titleKey: 'tabs.shopping', ion: ['cart', 'cart-outline'], sf: ['cart.fill', 'cart'] },
  { name: 'RecipesTab', component: RecipesStackNavigator, titleKey: 'tabs.recipes', ion: ['restaurant', 'restaurant-outline'], sf: ['fork.knife', 'fork.knife'], beta: true },
  { name: 'ProfileTab', component: ProfileStackNavigator, titleKey: 'tabs.profile', ion: ['person-circle', 'person-circle-outline'], sf: ['person.crop.circle.fill', 'person.crop.circle'] },
];

// iOS: the system tab bar (UITabBarController). Only system-owned bars get
// iOS 27's adaptive placement, so this is what lets the iPhone Duo move the
// tabs into its vertical bar strip on the outer screen and in inner-screen
// landscape, and gives Liquid Glass styling. Each tab keeps a title, which
// the system needs for the overflow menu.
const NativeTabs = () => {
  const { t } = useLanguage();
  return (
    <NativeTab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        // Same as the JS tab bar before it: a tab mounts the first time it is
        // opened, so launch doesn't load all five tabs' data at once.
        lazy: true,
      }}
    >
      {TABS.map((tab) => (
        <NativeTab.Screen
          key={tab.name}
          name={tab.name}
          component={tab.component}
          options={{
            title: t(tab.titleKey),
            tabBarIcon: ({ focused }) => ({ type: 'sfSymbol', name: focused ? tab.sf[0] : tab.sf[1] }),
            // No BETA badge here: the system tab bar colours a badge for only
            // one item state (it flipped between orange and red), and in the
            // iPhone Duo's narrow vertical strip the word sits on the icon.
            // Apple wants symbol-only items there. On iOS the Recipes header
            // carries the BETA marker instead.
          }}
        />
      ))}
    </NativeTab.Navigator>
  );
};

// Android: the JS tab bar as before. Native Material tabs would need a
// bitmap per icon, and the adaptive bar placement this is for is iOS-only.
const JsTabs = () => {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();

  // Tab bar height = a fixed content area + the device's bottom safe-area
  // inset. With gesture nav / 3-button nav this stops the system bar from
  // covering the tabs.
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
      {TABS.map((tab) => (
        <Tab.Screen
          key={tab.name}
          name={tab.name}
          component={tab.component}
          options={{
            title: t(tab.titleKey),
            tabBarIcon: (tab.beta ? tabIconWithBeta : tabIcon)(tab.ion[0], tab.ion[1]),
          }}
        />
      ))}
    </Tab.Navigator>
  );
};

const MainTabs = Platform.OS === 'ios' ? NativeTabs : JsTabs;

const AppNavigator = () => {
  const { isAuthenticated, loading } = useAuth();
  const insets = useSafeAreaInsets();
  if (loading) return null;

  // Light status-bar icons normally: the gradient headers run up behind the
  // status bar. When the window has no top inset, the status bar isn't over a
  // header - on the iPhone Duo it moves into the side strip next to the tab
  // bar, on the light app background - so it needs dark icons. The auth
  // screens are gradient edge to edge, strip included, so they stay light.
  const statusBarStyle = !isAuthenticated || insets.top > 0 ? 'light' : 'dark';

  return (
    <>
      <StatusBar style={statusBarStyle} />
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
