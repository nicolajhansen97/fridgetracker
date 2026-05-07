import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLanguage } from '../i18n';
import { useOTAUpdate } from '../context/OTAUpdateContext';
import PrimaryButton from './ui/PrimaryButton';
import Icon from './ui/Icon';
import { colors, gradients, radii, shadows, spacing, typography } from '../theme';

const OTAUpdateModal = () => {
  const { t } = useLanguage();
  const { updateAvailable, reloading, updateNow, dismiss } = useOTAUpdate();

  if (!updateAvailable) return null;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <LinearGradient
            colors={gradients.hero}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconWrap}
          >
            <Icon name="cloud-download-outline" size={32} color={colors.surface} />
          </LinearGradient>

          <Text style={styles.title}>{t('update.title')}</Text>
          <Text style={styles.body}>{t('update.body')}</Text>

          <PrimaryButton
            title={t('update.now')}
            onPress={updateNow}
            loading={reloading}
            style={{ marginTop: spacing.lg }}
          />
          <TouchableOpacity
            onPress={dismiss}
            disabled={reloading}
            hitSlop={6}
            style={styles.laterBtn}
          >
            <Text style={[styles.laterText, reloading && { opacity: 0.4 }]}>
              {t('update.later')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.xxl,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    ...shadows.button,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h2,
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  body: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  laterBtn: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    marginTop: 4,
  },
  laterText: {
    ...typography.button,
    color: colors.textMuted,
  },
});

export default OTAUpdateModal;
