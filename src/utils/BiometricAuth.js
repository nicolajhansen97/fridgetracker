import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const BIOMETRIC_ENABLED_KEY = 'biometric_enabled';
const STORED_EMAIL_KEY = 'stored_email';

export const BiometricAuth = {
  /**
   * Check if device supports biometric authentication
   */
  async isAvailable() {
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      if (!compatible) {
        return { available: false, reason: 'no_hardware' };
      }

      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!enrolled) {
        return { available: false, reason: 'not_enrolled' };
      }

      return { available: true };
    } catch (error) {
      console.error('Biometric availability check failed:', error);
      return { available: false, reason: 'error' };
    }
  },

  /**
   * Get supported authentication types
   */
  async getSupportedTypes() {
    try {
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      return types;
    } catch (error) {
      console.error('Failed to get supported types:', error);
      return [];
    }
  },

  /**
   * Get human-readable name for biometric type
   */
  async getBiometricName() {
    const types = await this.getSupportedTypes();

    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      return 'Face ID';
    }
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      return 'Touch ID';
    }
    if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
      return 'Iris Scan';
    }
    return 'Biometric Authentication';
  },

  /**
   * Authenticate with biometrics
   */
  async authenticate(promptMessage) {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: promptMessage || 'Authenticate to continue',
        fallbackLabel: 'Use password instead',
        disableDeviceFallback: false,
        cancelLabel: 'Cancel',
      });

      return {
        success: result.success,
        error: result.error,
      };
    } catch (error) {
      console.error('Biometric authentication failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  },

  /**
   * Enable biometric login
   */
  async enableBiometric(email) {
    try {
      await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, 'true');
      await SecureStore.setItemAsync(STORED_EMAIL_KEY, email);
      return { success: true };
    } catch (error) {
      console.error('Failed to enable biometric:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Disable biometric login
   */
  async disableBiometric() {
    try {
      await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY);
      await SecureStore.deleteItemAsync(STORED_EMAIL_KEY);
      return { success: true };
    } catch (error) {
      console.error('Failed to disable biometric:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Check if biometric is enabled
   */
  async isBiometricEnabled() {
    try {
      const enabled = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
      return enabled === 'true';
    } catch (error) {
      console.error('Failed to check biometric status:', error);
      return false;
    }
  },

  /**
   * Get stored email for biometric login
   */
  async getStoredEmail() {
    try {
      const email = await SecureStore.getItemAsync(STORED_EMAIL_KEY);
      return email;
    } catch (error) {
      console.error('Failed to get stored email:', error);
      return null;
    }
  },

  /**
   * Complete biometric login flow
   */
  async performBiometricLogin() {
    try {
      // Check if biometric is enabled
      const enabled = await this.isBiometricEnabled();
      if (!enabled) {
        return { success: false, reason: 'not_enabled' };
      }

      // Get stored email
      const email = await this.getStoredEmail();
      if (!email) {
        return { success: false, reason: 'no_email' };
      }

      // Get biometric name
      const biometricName = await this.getBiometricName();

      // Authenticate
      const authResult = await this.authenticate(`Login with ${biometricName}`);

      if (authResult.success) {
        return { success: true, email };
      } else {
        return { success: false, reason: 'auth_failed', error: authResult.error };
      }
    } catch (error) {
      console.error('Biometric login flow failed:', error);
      return { success: false, reason: 'error', error: error.message };
    }
  },
};
