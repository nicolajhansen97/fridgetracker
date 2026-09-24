import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n';
import { Icon, FrostOverlay } from '../components/ui';
import { colors, gradients, radii, shadows, spacing, typography } from '../theme';

// Shown when the user is signed in but has asked for a biometric gate in front
// of the app. The session behind this screen is live and valid — nothing here
// authenticates anything, it only decides whether to reveal what is already
// there. That is what biometrics can actually do on a persisted session, and
// it is what every banking app means by "Face ID login".
const LockScreen = () => {
  const { unlock, logout, biometricType } = useAuth();
  const { t } = useLanguage();
  const [checking, setChecking] = useState(false);
  // StrictMode and re-renders can fire the mount effect twice; a second
  // system prompt on top of the first is jarring and on Android cancels both.
  const promptedRef = useRef(false);

  const attempt = useCallback(async () => {
    if (checking) return;
    setChecking(true);
    const res = await unlock();
    setChecking(false);
    // A cancelled prompt is a normal outcome, not an error worth an alert —
    // the button is right there to try again.
    if (!res.success && res.error && res.error !== 'user_cancel') {
      // Intentionally quiet; the screen stays put and the button retries.
    }
  }, [unlock, checking]);

  // Offer the prompt immediately on arrival, so the common case is open app,
  // glance, done — with no extra tap.
  useEffect(() => {
    if (promptedRef.current) return;
    promptedRef.current = true;
    attempt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signOutInstead = () => {
    Alert.alert(t('lock.signOutTitle'), t('lock.signOutBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('lock.signOutConfirm'), style: 'destructive', onPress: () => logout() },
    ]);
  };

  return (
    <LinearGradient
      colors={gradients.hero}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <FrostOverlay />

      <View style={styles.content}>
        <View style={styles.mark}>
          <Icon name="lock-closed" size={32} color={colors.surface} />
        </View>
        <Text style={styles.brand}>Freezely</Text>
        <Text style={styles.title}>{t('lock.title')}</Text>
        <Text style={styles.subtitle}>{t('lock.subtitle', { type: biometricType })}</Text>

        <TouchableOpacity
          style={[styles.unlockBtn, checking && styles.btnBusy]}
          onPress={attempt}
          disabled={checking}
          activeOpacity={0.85}
        >
          <Icon name="finger-print-outline" size={18} color={colors.primary} />
          <Text style={styles.unlockText}>{t('lock.unlock', { type: biometricType })}</Text>
        </TouchableOpacity>

        {/* The only way past a lock you cannot satisfy — a wet thumb, a new
            face — has to be signing out and using the password. Without it a
            failed sensor is a locked-out user with nothing to tap. */}
        <TouchableOpacity onPress={signOutInstead} style={styles.signOutRow} hitSlop={8}>
          <Text style={styles.signOutText}>{t('lock.usePassword')}</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },

  mark: {
    width: 76,
    height: 76,
    borderRadius: radii.xl,
    backgroundColor: colors.glassMark,
    borderWidth: 1,
    borderColor: colors.glassMarkBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
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
    fontSize: 30,
    fontWeight: '800',
    color: colors.surface,
    letterSpacing: -0.5,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: colors.onHeroMuted,
    textAlign: 'center',
    marginBottom: spacing.xxxl,
  },

  unlockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    alignSelf: 'stretch',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingVertical: 16,
    ...shadows.button,
  },
  btnBusy: { opacity: 0.7 },
  unlockText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },

  signOutRow: { marginTop: spacing.xl },
  signOutText: {
    color: colors.onHeroMuted,
    fontSize: 14,
    fontWeight: '700',
  },
});

export default LockScreen;
