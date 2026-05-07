import React, { useEffect, useState } from 'react';
import { Modal, View, Text, ScrollView, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { CURRENT_VERSION, CHANGELOG } from '../changelog';
import { useLanguage } from '../i18n';
import PrimaryButton from './ui/PrimaryButton';
import { colors, gradients, radii, spacing, typography } from '../theme';

const SEEN_KEY = 'freezely_seen_changelog';

const WhatsNewModal = () => {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(SEEN_KEY).then((seen) => {
      if (seen !== CURRENT_VERSION) setVisible(true);
    });
  }, []);

  const dismiss = async () => {
    await AsyncStorage.setItem(SEEN_KEY, CURRENT_VERSION);
    setVisible(false);
  };

  const latest = CHANGELOG[0];
  if (!latest) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <LinearGradient
            colors={gradients.hero}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.header}
          >
            <Text style={styles.headerLabel}>{t('changelog.whatsNew')}</Text>
            <Text style={styles.headerVersion}>v{latest.version}</Text>
          </LinearGradient>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {latest.features.map((feature, i) => (
              <View key={i} style={styles.featureRow}>
                <Text style={styles.featureIcon}>{feature.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.featureTitle}>{t(feature.titleKey)}</Text>
                  <Text style={styles.featureDesc}>{t(feature.descKey)}</Text>
                </View>
              </View>
            ))}
          </ScrollView>

          <View style={styles.actions}>
            <PrimaryButton title={t('changelog.letsGo')} onPress={dismiss} />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    maxHeight: '80%',
  },
  header: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
    alignItems: 'center',
  },
  headerLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  headerVersion: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.surface,
    letterSpacing: -0.4,
  },
  body: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  featureIcon: {
    fontSize: 26,
    marginRight: spacing.md,
    marginTop: 1,
  },
  featureTitle: {
    ...typography.bodyStrong,
    color: colors.text,
    marginBottom: 3,
  },
  featureDesc: {
    ...typography.bodySmall,
    color: colors.textMuted,
    lineHeight: 20,
  },
  actions: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl + spacing.lg,
  },
});

export default WhatsNewModal;
