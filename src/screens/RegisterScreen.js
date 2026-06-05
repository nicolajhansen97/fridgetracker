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
import { colors, gradients, radii, shadows, spacing, typography } from '../theme';

const RegisterScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { register } = useAuth();
  const { t } = useLanguage();

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
    <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            <View style={styles.header}>
              <Text style={styles.brand}>Freezely</Text>
              <Text style={styles.title}>{t('register.createAccount')}</Text>
              <Text style={styles.subtitle}>{t('register.signUpToGetStarted')}</Text>
            </View>

            <View style={styles.form}>
              <Text style={styles.label}>{t('common.email')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('login.enterEmail')}
                placeholderTextColor="#94A3B8"
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
                placeholder={t('register.createPassword')}
                placeholderTextColor="#94A3B8"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="password-new"
                editable={!isLoading}
              />

              <Text style={[styles.label, { marginTop: spacing.md }]}>{t('register.confirmPassword')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('register.confirmYourPassword')}
                placeholderTextColor="#94A3B8"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoComplete="password-new"
                editable={!isLoading}
              />

              <TouchableOpacity
                style={[styles.signUpBtn, isLoading && { opacity: 0.7 }]}
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

              <View style={styles.loginRow}>
                <Text style={styles.loginText}>{t('register.alreadyHaveAccount')} </Text>
                <TouchableOpacity onPress={() => navigation.navigate('Login')} disabled={isLoading} hitSlop={6}>
                  <Text style={styles.loginLink}>{t('register.loginLink')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardView: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center' },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.xxxl,
  },
  header: { marginBottom: spacing.xxxl },
  brand: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.surface,
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  subtitle: { fontSize: 16, color: 'rgba(255,255,255,0.85)' },
  form: { width: '100%' },
  label: {
    ...typography.label,
    color: colors.surface,
    opacity: 0.9,
    marginBottom: 6,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.text,
  },
  signUpBtn: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: spacing.xl,
    ...shadows.button,
  },
  signUpText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  loginText: { color: 'rgba(255,255,255,0.85)', fontSize: 14 },
  loginLink: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});

export default RegisterScreen;
