import React from 'react';
import { Text, TextInput } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LanguageProvider } from './src/i18n';
import { AuthProvider } from './src/context/AuthContext';
import { PremiumProvider } from './src/context/PremiumContext';
import { HouseholdProvider } from './src/context/HouseholdContext';
import { FridgeProvider } from './src/context/FridgeContext';
import { DrawerProvider } from './src/context/DrawerContext';
import { ActivityProvider } from './src/context/ActivityContext';
import { ShoppingListProvider } from './src/context/ShoppingListContext';
import { SavedRecipesProvider } from './src/context/SavedRecipesContext';
import { FreezerSettingsProvider } from './src/context/FreezerSettingsContext';
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
          <PremiumProvider>
            <DrawerProvider>
              <FridgeProvider>
                <ActivityProvider>
                  <ShoppingListProvider>
                    <SavedRecipesProvider>
                    <FreezerSettingsProvider>
                    <OTAUpdateProvider>
                      <AppNavigator />
                      <OTAUpdateModal />
                      <SessionTracker />
                    </OTAUpdateProvider>
                    </FreezerSettingsProvider>
                    </SavedRecipesProvider>
                  </ShoppingListProvider>
                </ActivityProvider>
              </FridgeProvider>
            </DrawerProvider>
          </PremiumProvider>
          </HouseholdProvider>
        </AuthProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}
