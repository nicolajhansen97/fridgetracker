import React from 'react';
import { Text, TextInput } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LanguageProvider } from './src/i18n';
import { AuthProvider } from './src/context/AuthContext';
import { HouseholdProvider } from './src/context/HouseholdContext';
import { FridgeProvider } from './src/context/FridgeContext';
import { DrawerProvider } from './src/context/DrawerContext';
import { ActivityProvider } from './src/context/ActivityContext';
import { ShoppingListProvider } from './src/context/ShoppingListContext';
import { SavedRecipesProvider } from './src/context/SavedRecipesContext';
import { OTAUpdateProvider } from './src/context/OTAUpdateContext';
import AppNavigator from './src/navigation/AppNavigator';
import OTAUpdateModal from './src/components/OTAUpdateModal';
import SessionTracker from './src/components/SessionTracker';

// Disable iOS Dynamic Type scaling to preserve fixed layouts
if (Text.defaultProps == null) Text.defaultProps = {};
Text.defaultProps.allowFontScaling = false;
if (TextInput.defaultProps == null) TextInput.defaultProps = {};
TextInput.defaultProps.allowFontScaling = false;

export default function App() {
  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <AuthProvider>
          <HouseholdProvider>
            <DrawerProvider>
              <FridgeProvider>
                <ActivityProvider>
                  <ShoppingListProvider>
                    <SavedRecipesProvider>
                    <OTAUpdateProvider>
                      <StatusBar style="light" />
                      <AppNavigator />
                      <OTAUpdateModal />
                      <SessionTracker />
                    </OTAUpdateProvider>
                    </SavedRecipesProvider>
                  </ShoppingListProvider>
                </ActivityProvider>
              </FridgeProvider>
            </DrawerProvider>
          </HouseholdProvider>
        </AuthProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}
