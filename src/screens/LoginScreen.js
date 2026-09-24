import React, { useState } from 'react';
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
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n';
import { Icon, FrostOverlay } from '../components/ui';
import { colors, gradients, radii, shadows, spacing, typography } from '../theme';

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // Which field has focus, so it can light up against the gradient. On a
  // coloured background a plain cursor is easy to lose.
  const [focused, setFocused] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const { t } = useLanguage();
  const { login } = useAuth();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert(t('common.error'), t('login.fillAllFields'));
      return;
    }
    setIsLoading(true);
    const result = await login(email, password);
    setIsLoading(false);
    if (result.success) {
      // Nothing to do: the navigator swaps to the app on the auth state change.
    } else {
      Alert.alert(t('login.loginFailed'), result.error || 'Invalid credentials');
    }
  };

  return (
    <LinearGradient
      colors={gradients.hero}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <FrostOverlay />

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

  // — Header —
  header: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  brandMark: {
    width: 64,
    height: 64,
    borderRadius: radii.xl,
    backgroundColor: colors.glassMark,
    borderWidth: 1,
    borderColor: colors.glassMarkBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  brand: {
    fontSize: 13,
    color: colors.onHeroSubtle,
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
    color: colors.onHeroMuted,
    textAlign: 'center',
  },

  // — Frosted panel —
  glass: {
    backgroundColor: colors.glassPanel,
    borderRadius: radii.header,
    borderWidth: 1,
    borderColor: colors.glassBorder,
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
    backgroundColor: colors.glassField,
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
    color: colors.onHeroMuted,
    fontSize: 13,
    fontWeight: '600',
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
  signupRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xxl,
  },
  signupText: {
    color: colors.onHeroMuted,
    fontSize: 14,
  },
  signupLink: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: '800',
  },
});

export default LoginScreen;
