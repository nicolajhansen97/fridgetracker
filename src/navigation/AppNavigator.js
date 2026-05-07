import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
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
    <ProfileStack.Screen name="ManageHousehold" component={ManageHouseholdScreen} />
    <ProfileStack.Screen name="ActivityHistory" component={ActivityHistoryScreen} />
    <ProfileStack.Screen name="Changelog" component={ChangelogScreen} />
    <ProfileStack.Screen name="Feedback" component={FeedbackScreen} />
  </ProfileStack.Navigator>
);

const tabIcon = (focusedName, unfocusedName) => ({ focused, color }) => (
  <Ionicons
    name={focused ? focusedName : unfocusedName}
    size={24}
    color={color}
  />
);

const MainTabs = () => {
  const { t } = useLanguage();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: styles.tabBar,
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
          tabBarIcon: tabIcon('restaurant', 'restaurant-outline'),
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
  );
};

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingTop: 6,
    height: Platform.OS === 'ios' ? 84 : 64,
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
});

export default AppNavigator;
