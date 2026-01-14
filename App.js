import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/context/AuthContext';
import { FridgeProvider } from './src/context/FridgeContext';
import { DrawerProvider } from './src/context/DrawerContext';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    <AuthProvider>
      <DrawerProvider>
        <FridgeProvider>
          <StatusBar style="light" />
          <AppNavigator />
        </FridgeProvider>
      </DrawerProvider>
    </AuthProvider>
  );
}
