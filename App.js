import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/context/AuthContext';
import { HouseholdProvider } from './src/context/HouseholdContext';
import { FridgeProvider } from './src/context/FridgeContext';
import { DrawerProvider } from './src/context/DrawerContext';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    <AuthProvider>
      <HouseholdProvider>
        <DrawerProvider>
          <FridgeProvider>
            <StatusBar style="light" />
            <AppNavigator />
          </FridgeProvider>
        </DrawerProvider>
      </HouseholdProvider>
    </AuthProvider>
  );
}
