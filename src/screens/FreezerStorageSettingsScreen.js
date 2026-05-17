import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { useFreezerSettings } from '../context/FreezerSettingsContext';
import { useLanguage } from '../i18n';
import {
  EDITABLE_SUB_BUCKETS,
  EDITABLE_CATEGORIES,
} from '../utils/freezerStorage';
import {
  Screen,
  ScreenHeader,
  Card,
  Icon,
  SectionTitle,
  SecondaryButton,
} from '../components/ui';
import { colors, radii, spacing, typography } from '../theme';

// Renders a single editable row: label, default-value hint, numeric input,
// optional reset arrow when the value differs from the default. Save-on-blur
// keeps the wire chatty-but-honest — each commit either succeeds or rolls
// back, no pending-state to manage.
const Row = ({ labelKey, isCategory, defaultMonths, currentMonths, onCommit, onReset, t }) => {
  const label = isCategory
    ? t(`shopping.cat_${labelKey}`)
    : t(`freezerLabel.${labelKey}`);
  const [draft, setDraft] = useState(String(currentMonths));
  const changed = currentMonths !== defaultMonths;

  // Re-sync the local draft if the persisted value changes underneath us
  // (e.g. another device wrote, or reset-all was triggered).
  React.useEffect(() => {
    setDraft(String(currentMonths));
  }, [currentMonths]);

  const commit = () => {
    const n = parseInt(draft, 10);
    if (!Number.isFinite(n) || n <= 0 || n > 60) {
      // Invalid → snap back to the persisted value.
      setDraft(String(currentMonths));
      return;
    }
    if (n === currentMonths) return; // no-op
    onCommit(n);
  };

  return (
    <View style={styles.row}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.defaultHint}>
          {t('freezerSettings.defaultHint', { count: defaultMonths })}
        </Text>
      </View>
      <View style={styles.inputCluster}>
        <TextInput
          style={[styles.input, changed && styles.inputChanged]}
          keyboardType="number-pad"
          value={draft}
          onChangeText={setDraft}
          onBlur={commit}
          maxLength={2}
          selectTextOnFocus
          returnKeyType="done"
        />
        <Text style={styles.unit}>{t('freezerSettings.monthsAbbrev')}</Text>
        {changed ? (
          <TouchableOpacity onPress={onReset} hitSlop={8} style={styles.resetBtn}>
            <Icon name="refresh-outline" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        ) : (
          <View style={styles.resetBtn} />
        )}
      </View>
    </View>
  );
};

const FreezerStorageSettingsScreen = ({ navigation }) => {
  const { overrides, setOverride, resetAll } = useFreezerSettings();
  const { t } = useLanguage();

  const handleCommit = async (key, months) => {
    const result = await setOverride(key, months);
    if (!result.success) {
      Alert.alert(t('common.error'), result.error || t('common.error'));
    }
  };

  const handleResetKey = (key) => setOverride(key, null);

  const handleResetAll = () => {
    Alert.alert(
      t('freezerSettings.resetTitle'),
      t('freezerSettings.resetConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('freezerSettings.reset'),
          style: 'destructive',
          onPress: async () => {
            const r = await resetAll();
            if (!r.success) Alert.alert(t('common.error'), r.error || '');
          },
        },
      ]
    );
  };

  const currentMonths = (key, fallback) =>
    typeof overrides[key] === 'number' && overrides[key] > 0
      ? overrides[key]
      : fallback;

  const hasAnyOverride = Object.keys(overrides).length > 0;

  return (
    <Screen>
      <ScreenHeader
        title={t('freezerSettings.title')}
        subtitle={t('freezerSettings.subtitle')}
        onBack={() => navigation.goBack()}
        backLabel={t('common.back')}
      />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card style={styles.intro}>
          <Icon name="information-circle-outline" size={20} color={colors.primary} />
          <Text style={styles.introText}>{t('freezerSettings.intro')}</Text>
        </Card>

        <SectionTitle
          icon={<Icon name="restaurant-outline" size={14} color={colors.textMuted} />}
        >
          {t('freezerSettings.subBucketsSection')}
        </SectionTitle>
        <Card padded={false}>
          {EDITABLE_SUB_BUCKETS.map((sub, idx) => (
            <View
              key={sub.key}
              style={[idx < EDITABLE_SUB_BUCKETS.length - 1 && styles.divider]}
            >
              <Row
                labelKey={sub.key}
                isCategory={sub.isCategory}
                defaultMonths={sub.defaultMonths}
                currentMonths={currentMonths(sub.key, sub.defaultMonths)}
                onCommit={(n) => handleCommit(sub.key, n)}
                onReset={() => handleResetKey(sub.key)}
                t={t}
              />
            </View>
          ))}
        </Card>

        <SectionTitle
          icon={<Icon name="cube-outline" size={14} color={colors.textMuted} />}
        >
          {t('freezerSettings.categoriesSection')}
        </SectionTitle>
        <Card padded={false}>
          {EDITABLE_CATEGORIES.map((cat, idx) => (
            <View
              key={cat.key}
              style={[idx < EDITABLE_CATEGORIES.length - 1 && styles.divider]}
            >
              <Row
                labelKey={cat.key}
                isCategory={cat.isCategory}
                defaultMonths={cat.defaultMonths}
                currentMonths={currentMonths(cat.key, cat.defaultMonths)}
                onCommit={(n) => handleCommit(cat.key, n)}
                onReset={() => handleResetKey(cat.key)}
                t={t}
              />
            </View>
          ))}
        </Card>

        {hasAnyOverride && (
          <SecondaryButton
            title={t('freezerSettings.resetAll')}
            onPress={handleResetAll}
            danger
            style={styles.resetAllBtn}
          />
        )}

        <Text style={styles.footnote}>{t('freezerSettings.footnote')}</Text>

        <View style={{ height: spacing.xxxl }} />
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  intro: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    backgroundColor: '#ECFEFF',
    marginBottom: spacing.sm,
  },
  introText: {
    ...typography.bodySmall,
    color: colors.text,
    flex: 1,
    lineHeight: 18,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  label: {
    ...typography.bodyStrong,
    color: colors.text,
  },
  defaultHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },

  inputCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  input: {
    width: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
    backgroundColor: colors.surface,
  },
  inputChanged: {
    borderColor: colors.primary,
    color: colors.primary,
  },
  unit: {
    ...typography.caption,
    color: colors.textMuted,
  },
  resetBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },

  resetAllBtn: {
    marginTop: spacing.xl,
  },

  footnote: {
    ...typography.caption,
    color: colors.textSubtle,
    marginTop: spacing.xl,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
    lineHeight: 16,
  },
});

export default FreezerStorageSettingsScreen;
