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
  ScrollView,
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
  // Which field has focus, so it can light up against the gradient. On a
  // coloured background a plain cursor is easy to lose.
  const [focused, setFocused] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
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
    <LinearGradient
      colors={gradients.hero}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      {/* Frost texture. Same device the in-app ScreenHeader uses, scaled up for
          a full screen: a few oversized snowflakes at very low opacity, placed
          off-centre and partly bled off the edges so they read as atmosphere
          rather than as decoration sitting on top of the form. */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Icon name="snow" size={260} color="rgba(255,255,255,0.09)" style={styles.frostOne} />
        <Icon name="snow" size={150} color="rgba(255,255,255,0.07)" style={styles.frostTwo} />
        <Icon name="snow" size={90} color="rgba(255,255,255,0.08)" style={styles.frostThree} />
        <Icon name="snow" size={58} color="rgba(255,255,255,0.06)" style={styles.frostFour} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            {/* Frosted brand mark rather than the solid white chip: a translucent
                disc keeps the gradient reading through it, matching the
                translucent header buttons used elsewhere in the app. */}
            <View style={styles.brandMark}>
              <Icon name="snow" size={30} color={colors.surface} />
            </View>
            <Text style={styles.brand}>Freezely</Text>
            <Text style={styles.title}>{t('login.welcomeBack')}</Text>
            <Text style={styles.subtitle}>{t('login.signInToContinue')}</Text>
          </View>

          {/* Frosted panel. The form used to float loose on the gradient; giving
              it a pane of ice to sit on is what makes the screen feel built
              rather than layered, and it is the main "freezer" cue. */}
          <View style={styles.glass}>
            <Text style={styles.label}>{t('common.email')}</Text>
            <View style={[styles.field, focused === 'email' && styles.fieldFocused]}>
              <Icon name="mail-outline" size={18} color={colors.textMuted} />
              <TextInput
                style={styles.input}
                placeholder={t('login.enterEmail')}
                placeholderTextColor={colors.textSubtle}
                value={email}
                onChangeText={setEmail}
                onFocus={() => setFocused('email')}
                onBlur={() => setFocused(null)}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                editable={!isLoading}
              />
            </View>

            <Text style={[styles.label, styles.labelSpaced]}>{t('login.password')}</Text>
            <View style={[styles.field, focused === 'password' && styles.fieldFocused]}>
              <Icon name="lock-closed-outline" size={18} color={colors.textMuted} />
              <TextInput
                style={styles.input}
                placeholder={t('login.enterPassword')}
                placeholderTextColor={colors.textSubtle}
                value={password}
                onChangeText={setPassword}
                onFocus={() => setFocused('password')}
                onBlur={() => setFocused(null)}
                secureTextEntry={!showPassword}
                autoComplete="password"
                editable={!isLoading}
              />
              {/* Reveal toggle: typing a password blind on a phone keyboard is
                  the single most common reason a correct password "fails". */}
              <TouchableOpacity
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={10}
                disabled={isLoading}
                accessibilityRole="button"
                accessibilityLabel={t('login.password')}
              >
                <Icon
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color={colors.textMuted}
                />
              </TouchableOpacity>
            </View>

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
                <Icon name="finger-print-outline" size={18} color={colors.primary} />
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
              style={[styles.signInBtn, isLoading && styles.btnBusy]}
              onPress={handleLogin}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Text style={styles.signInText}>{t('login.loginButton')}</Text>
              )}
            </TouchableOpacity>

            {biometricAvailable && (
              <TouchableOpacity
                style={styles.bioBtn}
                onPress={handleBiometricLogin}
                disabled={isLoading}
                activeOpacity={0.85}
              >
                <Icon name="finger-print-outline" size={18} color={colors.surface} />
                <Text style={styles.bioBtnText}>
                  {t('login.loginWithBiometric', { type: biometricType })}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.signupRow}>
            <Text style={styles.signupText}>{t('login.noAccount')} </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Register')}
              disabled={isLoading}
              hitSlop={6}
            >
              <Text style={styles.signupLink}>{t('login.signUp')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxxl,
  },

  // — Frost texture —
  frostOne: {
    position: 'absolute',
    top: -70,
    right: -80,
  },
  frostTwo: {
    position: 'absolute',
    bottom: -30,
    left: -50,
  },
  frostThree: {
    position: 'absolute',
    top: '32%',
    left: -28,
  },
  frostFour: {
    position: 'absolute',
    top: '12%',
    left: '38%',
  },

  // — Header —
  header: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  brandMark: {
    width: 64,
    height: 64,
    borderRadius: radii.xl,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  brand: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '700',
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    color: colors.surface,
    letterSpacing: -0.6,
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
  },

  // — Frosted panel —
  glass: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: radii.header,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    padding: spacing.xl,
  },
  label: {
    ...typography.label,
    color: colors.surface,
    opacity: 0.9,
    marginBottom: 8,
  },
  labelSpaced: {
    marginTop: spacing.lg,
  },

  // Fields stay near-opaque on purpose. A fully frosted input looks better in a
  // mockup and reads badly in daylight - what you type has to stay dark text on
  // a light surface.
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: 'transparent',
    paddingHorizontal: 14,
    height: 52,
  },
  fieldFocused: {
    borderColor: colors.surface,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    padding: 0,
  },

  forgotRow: {
    alignSelf: 'flex-end',
    marginTop: spacing.md,
  },
  forgotText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    fontWeight: '600',
  },

  bioToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: spacing.lg,
  },
  bioToggleText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },

  signInBtn: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: spacing.lg,
    ...shadows.button,
  },
  btnBusy: {
    opacity: 0.7,
  },
  signInText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  bioBtn: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: spacing.md,
  },
  bioBtnText: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: '700',
  },

  signupRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xxl,
  },
  signupText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
  },
  signupLink: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: '800',
  },
});

export default LoginScreen;
