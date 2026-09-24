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
import { Icon } from '../components/ui';
import { colors, gradients, radii, shadows, spacing, typography } from '../theme';

const RegisterScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [focused, setFocused] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const { register } = useAuth();
  const { t } = useLanguage();

  // Live mismatch feedback. Finding out the passwords disagree only after
  // tapping Sign up is a needless round trip, and it is the most common reason
  // this form fails.
  const mismatch =
    confirmPassword.length > 0 && password.length > 0 && password !== confirmPassword;

  const handleRegister = async () => {
    if (!email || !password || !confirmPassword) {
      Alert.alert(t('common.error'), t('login.fillAllFields'));
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert(t('common.error'), t('register.passwordsDontMatch'));
      return;
    }
    if (password.length < 6) {
      Alert.alert(t('common.error'), t('register.passwordTooShort'));
      return;
    }

    setIsLoading(true);
    const result = await register(email, password);
    setIsLoading(false);

    if (result.success) {
      Alert.alert(t('common.success'), result.message, [
        { text: t('common.ok'), onPress: () => navigation.navigate('Login') },
      ]);
    } else {
      Alert.alert(t('register.registrationFailed'), result.error);
    }
  };

  return (
    <LinearGradient
      colors={gradients.hero}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      {/* Same frost treatment as Login, so the two screens read as one flow. */}
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
            <View style={styles.brandMark}>
              <Icon name="snow" size={30} color={colors.surface} />
            </View>
            <Text style={styles.brand}>Freezely</Text>
            <Text style={styles.title}>{t('register.createAccount')}</Text>
            <Text style={styles.subtitle}>{t('register.signUpToGetStarted')}</Text>
          </View>

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
                placeholder={t('register.createPassword')}
                placeholderTextColor={colors.textSubtle}
                value={password}
                onChangeText={setPassword}
                onFocus={() => setFocused('password')}
                onBlur={() => setFocused(null)}
                secureTextEntry={!showPassword}
                autoComplete="password-new"
                editable={!isLoading}
              />
              {/* One reveal toggle drives both fields: on a sign-up form you are
                  checking the two against each other, so hiding one and showing
                  the other would defeat the point. */}
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

            <Text style={[styles.label, styles.labelSpaced]}>{t('register.confirmPassword')}</Text>
            <View
              style={[
                styles.field,
                focused === 'confirm' && styles.fieldFocused,
                mismatch && styles.fieldError,
              ]}
            >
              <Icon
                name={mismatch ? 'alert-circle-outline' : 'lock-closed-outline'}
                size={18}
                color={mismatch ? colors.danger : colors.textMuted}
              />
              <TextInput
                style={styles.input}
                placeholder={t('register.confirmYourPassword')}
                placeholderTextColor={colors.textSubtle}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                onFocus={() => setFocused('confirm')}
                onBlur={() => setFocused(null)}
                secureTextEntry={!showPassword}
                autoComplete="password-new"
                editable={!isLoading}
              />
            </View>
            {mismatch ? (
              <Text style={styles.errorText}>{t('register.passwordsDontMatch')}</Text>
            ) : null}

            <TouchableOpacity
              style={[styles.signUpBtn, isLoading && styles.btnBusy]}
              onPress={handleRegister}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Text style={styles.signUpText}>{t('register.signUpButton')}</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.loginRow}>
            <Text style={styles.loginText}>{t('register.alreadyHaveAccount')} </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Login')}
              disabled={isLoading}
              hitSlop={6}
            >
              <Text style={styles.loginLink}>{t('register.loginLink')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardView: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxxl,
  },

  frostOne: { position: 'absolute', top: -70, right: -80 },
  frostTwo: { position: 'absolute', bottom: -30, left: -50 },
  frostThree: { position: 'absolute', top: '32%', left: -28 },
  frostFour: { position: 'absolute', top: '12%', left: '38%' },

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
  labelSpaced: { marginTop: spacing.lg },

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
  fieldError: {
    borderColor: colors.danger,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    padding: 0,
  },
  errorText: {
    color: colors.surface,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 8,
  },

  signUpBtn: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: spacing.xl,
    ...shadows.button,
  },
  btnBusy: { opacity: 0.7 },
  signUpText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },

  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xxl,
  },
  loginText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
  },
  loginLink: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: '800',
  },
});

export default RegisterScreen;
