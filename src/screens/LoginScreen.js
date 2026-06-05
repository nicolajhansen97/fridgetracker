import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n';
import { Icon } from '../components/ui';
import { colors, gradients, radii, shadows, spacing, typography } from '../theme';

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [enableBiometricToggle, setEnableBiometricToggle] = useState(false);
  const { t } = useLanguage();
  const {
    login,
    biometricAvailable,
    biometricType,
    loginWithBiometric,
    enableBiometric,
    checkBiometricEnabled,
  } = useAuth();

  useEffect(() => {
    const initBiometric = async () => {
      if (biometricAvailable) {
        const enabled = await checkBiometricEnabled();
        if (enabled) handleBiometricLogin();
      }
    };
    initBiometric();
  }, [biometricAvailable]);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert(t('common.error'), t('login.fillAllFields'));
      return;
    }
    setIsLoading(true);
    const result = await login(email, password);
    setIsLoading(false);
    if (result.success) {
      if (enableBiometricToggle && biometricAvailable) {
        const biometricResult = await enableBiometric(email);
        if (biometricResult.success) {
          Alert.alert(t('common.success'), t('login.biometricEnabled', { type: biometricType }));
        }
      }
    } else {
      Alert.alert(t('login.loginFailed'), result.error || 'Invalid credentials');
    }
  };

  const handleBiometricLogin = async () => {
    setIsLoading(true);
    const result = await loginWithBiometric();
    setIsLoading(false);
    if (!result.success && result.error === 'Session expired. Please login with password again.') {
      Alert.alert(t('login.sessionExpired'), result.error);
    }
  };

  const toggleBiometricOption = () => {
    if (!biometricAvailable) {
      Alert.alert(t('login.notAvailable'), t('login.biometricNotAvailable', { type: biometricType }));
      return;
    }
    setEnableBiometricToggle(!enableBiometricToggle);
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.brandMark}>
              <Icon name="snow" size={26} color={colors.primary} />
            </View>
            <Text style={styles.brand}>Freezely</Text>
            <Text style={styles.title}>{t('login.welcomeBack')}</Text>
            <Text style={styles.subtitle}>{t('login.signInToContinue')}</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>{t('common.email')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('login.enterEmail')}
              placeholderTextColor={colors.textSubtle}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              editable={!isLoading}
            />

            <Text style={[styles.label, { marginTop: spacing.md }]}>{t('login.password')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('login.enterPassword')}
              placeholderTextColor={colors.textSubtle}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
              editable={!isLoading}
            />

            <TouchableOpacity
              onPress={() => navigation.navigate('ForgotPassword')}
              disabled={isLoading}
              hitSlop={6}
              style={styles.forgotRow}
            >
              <Text style={styles.forgotText}>{t('login.forgotPassword')}</Text>
            </TouchableOpacity>

            {biometricAvailable && (
              <View style={styles.bioToggleRow}>
                <Text style={styles.bioToggleText}>
                  {t('login.enableBiometric', { type: biometricType })}
                </Text>
                <Switch
                  value={enableBiometricToggle}
                  onValueChange={toggleBiometricOption}
                  trackColor={{ false: colors.borderStrong, true: colors.primary }}
                  thumbColor={colors.surface}
                  disabled={isLoading}
                />
              </View>
            )}

            <TouchableOpacity
              style={[styles.signInBtn, isLoading && { opacity: 0.7 }]}
              onPress={handleLogin}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={gradients.hero}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.signInGradient}
              >
                {isLoading ? (
                  <ActivityIndicator color={colors.surface} />
                ) : (
                  <Text style={styles.signInText}>{t('login.loginButton')}</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {biometricAvailable && (
              <TouchableOpacity
                style={styles.bioBtn}
                onPress={handleBiometricLogin}
                disabled={isLoading}
                activeOpacity={0.85}
              >
                <Icon name="finger-print-outline" size={18} color={colors.primary} />
                <Text style={styles.bioBtnText}>
                  {t('login.loginWithBiometric', { type: biometricType })}
                </Text>
              </TouchableOpacity>
            )}

            <View style={styles.signupRow}>
              <Text style={styles.signupText}>{t('login.noAccount')} </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Register')} disabled={isLoading} hitSlop={6}>
                <Text style={styles.signupLink}>{t('login.signUp')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },
  header: {
    marginBottom: spacing.xxl,
  },
  brandMark: {
    width: 52,
    height: 52,
    borderRadius: radii.lg,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  brand: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.largeTitle,
    color: colors.text,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textMuted,
  },
  form: {
    width: '100%',
  },
  label: {
    ...typography.label,
    color: colors.textMuted,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.text,
  },
  forgotRow: {
    alignSelf: 'flex-end',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  forgotText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  bioToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: spacing.lg,
  },
  bioToggleText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    marginRight: spacing.sm,
  },
  signInBtn: {
    borderRadius: radii.md,
    overflow: 'hidden',
    ...shadows.button,
  },
  signInGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
  },
  signInText: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  bioBtn: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: spacing.md,
  },
  bioBtnText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  signupRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  signupText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  signupLink: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
});

export default LoginScreen;
