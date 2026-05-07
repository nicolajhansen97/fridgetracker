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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n';
import { colors, gradients, radii, shadows, spacing, typography } from '../theme';

const ForgotPasswordScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { forgotPassword } = useAuth();
  const { t } = useLanguage();

  const handleResetPassword = async () => {
    if (!email) {
      Alert.alert(t('common.error'), t('forgotPassword.enterEmail'));
      return;
    }
    setIsLoading(true);
    const result = await forgotPassword(email);
    setIsLoading(false);
    if (result.success) {
      Alert.alert(t('common.success'), result.message, [
        { text: t('common.ok'), onPress: () => navigation.navigate('Login') },
      ]);
    } else {
      Alert.alert(t('common.error'), result.error);
    }
  };

  return (
    <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('forgotPassword.title')}</Text>
            <Text style={styles.subtitle}>{t('forgotPassword.subtitle')}</Text>
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

            <TouchableOpacity
              style={[styles.resetBtn, isLoading && { opacity: 0.7 }]}
              onPress={handleResetPassword}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Text style={styles.resetText}>{t('forgotPassword.sendResetLink')}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => navigation.navigate('Login')}
              disabled={isLoading}
              hitSlop={8}
              style={styles.backRow}
            >
              <Text style={styles.backText}>{t('forgotPassword.backToLogin')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardView: { flex: 1 },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },
  header: { marginBottom: spacing.xxxl },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.surface,
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 22,
  },
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
    marginBottom: spacing.xl,
  },
  resetBtn: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingVertical: 16,
    alignItems: 'center',
    ...shadows.button,
  },
  resetText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  backRow: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.md,
  },
  backText: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: '600',
  },
});

export default ForgotPasswordScreen;
