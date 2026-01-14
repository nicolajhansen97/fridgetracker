import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
  Switch,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';

const SettingsScreen = ({ navigation }) => {
  const {
    user,
    biometricAvailable,
    biometricType,
    enableBiometric,
    disableBiometric,
    checkBiometricEnabled,
  } = useAuth();

  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    checkBiometricStatus();
  }, []);

  const checkBiometricStatus = async () => {
    const enabled = await checkBiometricEnabled();
    setBiometricEnabled(enabled);
  };

  const handleToggleBiometric = async () => {
    if (!biometricAvailable) {
      Alert.alert(
        'Not Available',
        `${biometricType} is not available on this device. Please enable it in your device settings.`
      );
      return;
    }

    setIsLoading(true);

    if (biometricEnabled) {
      // Disable biometric
      const result = await disableBiometric();
      if (result.success) {
        setBiometricEnabled(false);
        Alert.alert('Success', `${biometricType} login disabled`);
      } else {
        Alert.alert('Error', result.error || 'Failed to disable biometric login');
      }
    } else {
      // Enable biometric
      const result = await enableBiometric(user?.email);
      if (result.success) {
        setBiometricEnabled(true);
        Alert.alert('Success', `${biometricType} login enabled!`);
      } else {
        Alert.alert('Error', result.error || 'Failed to enable biometric login');
      }
    }

    setIsLoading(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#4facfe', '#00f2fe']} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Settings</Text>
          <View style={styles.placeholder} />
        </View>
      </LinearGradient>

      <ScrollView style={styles.content}>
        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.card}>
            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>Email</Text>
              <Text style={styles.settingValue}>{user?.email}</Text>
            </View>
          </View>
        </View>

        {/* Security Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Security</Text>
          <View style={styles.card}>
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>{biometricType} Login</Text>
                <Text style={styles.settingDescription}>
                  {biometricAvailable
                    ? `Use ${biometricType} for quick and secure login`
                    : `${biometricType} is not available on this device`}
                </Text>
              </View>
              <Switch
                value={biometricEnabled}
                onValueChange={handleToggleBiometric}
                trackColor={{ false: '#ccc', true: '#4facfe' }}
                thumbColor={biometricEnabled ? '#fff' : '#f4f3f4'}
                disabled={!biometricAvailable || isLoading}
              />
            </View>
          </View>
        </View>

        {/* About Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.card}>
            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>App Name</Text>
              <Text style={styles.settingValue}>FridgeTracker</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>Version</Text>
              <Text style={styles.settingValue}>1.0.0</Text>
            </View>
          </View>
        </View>

        {/* Info Card */}
        {biometricAvailable && (
          <View style={styles.infoCard}>
            <Text style={styles.infoIcon}>🔐</Text>
            <Text style={styles.infoTitle}>Secure & Convenient</Text>
            <Text style={styles.infoText}>
              {biometricType} keeps your account secure while providing quick access to your fridge inventory.
            </Text>
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
    paddingHorizontal: 20,
  },
  section: {
    marginTop: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    marginLeft: 5,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  settingInfo: {
    flex: 1,
    marginRight: 15,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  settingValue: {
    fontSize: 15,
    color: '#666',
  },
  divider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 8,
  },
  infoCard: {
    backgroundColor: '#e3f2fd',
    borderRadius: 15,
    padding: 20,
    marginTop: 25,
    marginBottom: 30,
    alignItems: 'center',
  },
  infoIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1976d2',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default SettingsScreen;
