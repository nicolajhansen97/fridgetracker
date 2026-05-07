import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { CHANGELOG, CURRENT_VERSION } from '../changelog';
import { useLanguage } from '../i18n';
import {
  Screen,
  ScreenHeader,
  Card,
  Badge,
} from '../components/ui';
import { colors, spacing, typography } from '../theme';

const ChangelogScreen = ({ navigation }) => {
  const { t } = useLanguage();

  return (
    <Screen>
      <ScreenHeader
        title={t('changelog.title')}
        onBack={() => navigation.goBack()}
        backLabel={t('common.back')}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {CHANGELOG.map((release) => (
          <View key={release.version} style={styles.release}>
            <View style={styles.releaseHeader}>
              <Badge tone="primary">v{release.version}</Badge>
              {release.version === CURRENT_VERSION && (
                <Badge tone="success">{t('changelog.current')}</Badge>
              )}
              <Text style={styles.releaseDate}>{release.date}</Text>
            </View>

            <Card padded={false}>
              {release.features.map((feature, i) => (
                <View
                  key={i}
                  style={[styles.featureRow, i < release.features.length - 1 && styles.featureRowDivider]}
                >
                  <Text style={styles.featureIcon}>{feature.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.featureTitle}>{t(feature.titleKey)}</Text>
                    <Text style={styles.featureDesc}>{t(feature.descKey)}</Text>
                  </View>
                </View>
              ))}
            </Card>
          </View>
        ))}
        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  release: {
    marginBottom: spacing.xl,
  },
  releaseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.md,
  },
  releaseDate: {
    ...typography.caption,
    color: colors.textSubtle,
    marginLeft: 'auto',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: 12,
  },
  featureRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  featureIcon: {
    fontSize: 20,
    width: 28,
    textAlign: 'center',
    marginTop: 1,
  },
  featureTitle: {
    ...typography.bodyStrong,
    color: colors.text,
    marginBottom: 2,
  },
  featureDesc: {
    ...typography.bodySmall,
    color: colors.textMuted,
    lineHeight: 19,
  },
});

export default ChangelogScreen;
