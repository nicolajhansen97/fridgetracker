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

const ForgotPasswordScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [focused, setFocused] = useState(false);
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
    <LinearGradient
      colors={gradients.hero}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
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
            {/* A key rather than the snowflake: this screen is the one place in
                the auth flow doing something other than signing in, and the
                mark is what tells you that at a glance. */}
            <View style={styles.brandMark}>
              <Icon name="key-outline" size={28} color={colors.surface} />
            </View>
            <Text style={styles.title}>{t('forgotPassword.title')}</Text>
            <Text style={styles.subtitle}>{t('forgotPassword.subtitle')}</Text>
          </View>

          <View style={styles.glass}>
            <Text style={styles.label}>{t('common.email')}</Text>
            <View style={[styles.field, focused && styles.fieldFocused]}>
              <Icon name="mail-outline" size={18} color={colors.textMuted} />
              <TextInput
                style={styles.input}
                placeholder={t('login.enterEmail')}
                placeholderTextColor={colors.textSubtle}
                value={email}
                onChangeText={setEmail}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                editable={!isLoading}
                returnKeyType="send"
                onSubmitEditing={handleResetPassword}
              />
            </View>

            <TouchableOpacity
              style={[styles.resetBtn, isLoading && styles.btnBusy]}
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
          </View>

          <TouchableOpacity
            onPress={() => navigation.navigate('Login')}
            disabled={isLoading}
            hitSlop={8}
            style={styles.backRow}
          >
            <Icon name="chevron-back" size={16} color={colors.surface} />
            <Text style={styles.backText}>{t('forgotPassword.backToLogin')}</Text>
          </TouchableOpacity>
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
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.surface,
    letterSpacing: -0.5,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    lineHeight: 21,
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

  resetBtn: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: spacing.xl,
    ...shadows.button,
  },
  btnBusy: { opacity: 0.7 },
  resetText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },

  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    marginTop: spacing.xxl,
  },
  backText: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: '700',
  },
});

export default ForgotPasswordScreen;
