import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Switch,
  RefreshControl,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n';
import { formatMoneyWith } from '../utils/currency';
import { useFreezerSettings } from '../context/FreezerSettingsContext';
import { useNotifications } from '../context/NotificationContext';
import {
  Screen,
  ScreenHeader,
  Card,
  Icon,
  OptionSheet,
  SectionTitle,
} from '../components/ui';
import { colors, radii, spacing, typography } from '../theme';

const FAMILY_SIZE_KEY = 'freezely_family_size';
const USE_PACKAGE_NUMBERS_KEY = 'freezely_use_package_numbers';

// Every app preference in one place, as one row per setting with its current
// value on the right — so the whole configuration reads down the right edge
// without opening anything. Choices with more than two options open a sheet
// rather than spreading chips across the screen; switches stay inline.
//
// Profile keeps what is about *you* (account, household, subscription) and
// links here. Storage times and reminders are big enough to keep their own
// screens, but appear here as ordinary rows showing their current state.
const SettingsScreen = ({ navigation }) => {
  const { user } = useAuth();
  const {
    t, locale, setLocale, languages,
    dateFormat, setDateFormat, dateFormats,
    currency, setCurrency, currencies, formatMoney,
  } = useLanguage();
  const { dateSource, setDateSource, overrides } = useFreezerSettings();
  const { resolved: notifPrefs } = useNotifications();

  const [familySize, setFamilySize] = useState(4);
  const [usePackageNumbers, setUsePackageNumbers] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // Which picker sheet is open, if any: 'dateSource' | 'language' | 'dateFormat' | 'currency'.
  const [sheet, setSheet] = useState(null);

  useEffect(() => {
    AsyncStorage.getItem(FAMILY_SIZE_KEY).then((val) => {
      if (val) setFamilySize(parseInt(val));
    });
    AsyncStorage.getItem(USE_PACKAGE_NUMBERS_KEY).then((val) => {
      if (val !== null) setUsePackageNumbers(val === 'true');
    });
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const v = await AsyncStorage.getItem(FAMILY_SIZE_KEY);
      if (v) setFamilySize(parseInt(v));
      const p = await AsyncStorage.getItem(USE_PACKAGE_NUMBERS_KEY);
      if (p !== null) setUsePackageNumbers(p === 'true');
    } catch (e) {
      console.error('Refresh error:', e);
    } finally {
      setRefreshing(false);
    }
  };

  const changeFamilySize = (delta) => {
    const n = Math.min(20, Math.max(1, familySize + delta));
    setFamilySize(n);
    AsyncStorage.setItem(FAMILY_SIZE_KEY, String(n));
  };

  const handleTogglePackageNumbers = (value) => {
    setUsePackageNumbers(value);
    AsyncStorage.setItem(USE_PACKAGE_NUMBERS_KEY, String(value));
  };

  // Right-hand summaries for the rows that open another screen. Both say what
  // the user would otherwise have to open the screen to find out.
  const storageSummary = Object.keys(overrides || {}).length > 0
    ? t('settings.storageCustom')
    : t('settings.storageDefault');
  const reminderSummary = notifPrefs?.enabled
    ? t('settings.remindersLead', { count: notifPrefs.leadDays })
    : t('settings.remindersOff');

  const languageOptions = languages.map((l) => ({ value: l.code, label: l.label, icon: l.flag }));
  const dateFormatOptions = dateFormats.map((f) => ({
    value: f.code,
    label: t(`settings.dateFormat_${f.code}`),
    hint: f.pattern,
  }));
  const dateSourceOptions = [
    { value: 'estimate', label: t('expiring.filterEstimate'), hint: t('settings.dateSourceEstimateHint') },
    { value: 'mine', label: t('expiring.filterMine'), hint: t('settings.dateSourceMineHint') },
  ];

  // Each option previews itself, so the difference between kr, € and £ is
  // visible in the list rather than something you pick and then go check.
  const currencyOptions = currencies.map((c) => ({
    value: c.code,
    label: c.code,
    hint: formatMoneyWith(24.5, c.code),
  }));

  const currentLanguage = languages.find((l) => l.code === locale)?.label || locale;
  const currentDateFormat = dateFormats.find((f) => f.code === dateFormat)?.pattern || '';

  return (
    <Screen>
      <ScreenHeader
        title={t('settings.title')}
        onBack={() => navigation.goBack()}
        backLabel={t('common.back')}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <SectionTitle>{t('settings.groupFreezer')}</SectionTitle>
        <Card padded={false}>
          <ValueRow
            label={t('settings.dateSource')}
            value={dateSource === 'mine' ? t('expiring.filterMine') : t('expiring.filterEstimate')}
            onPress={() => setSheet('dateSource')}
          />
          <Divider />
          <ValueRow
            label={t('freezerSettings.profileRow')}
            value={storageSummary}
            onPress={() => navigation.navigate('FreezerStorageSettings')}
          />
          <Divider />
          <ValueRow
            label={t('notif.profileRow')}
            value={reminderSummary}
            onPress={() => navigation.navigate('NotificationSettings')}
          />
          <Divider />
          <SettingRow
            label={t('settings.usePackageNumbers')}
            description={t('settings.usePackageNumbersDesc')}
            right={
              <Switch
                value={usePackageNumbers}
                onValueChange={handleTogglePackageNumbers}
                trackColor={{ false: colors.borderStrong, true: colors.primary }}
                thumbColor={colors.surface}
              />
            }
          />
          <Divider />
          <SettingRow
            label={t('settings.familySize')}
            right={
              <View style={styles.stepper}>
                <TouchableOpacity style={styles.stepBtn} onPress={() => changeFamilySize(-1)}>
                  <Text style={styles.stepBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.stepValue}>{familySize}</Text>
                <TouchableOpacity style={styles.stepBtn} onPress={() => changeFamilySize(1)}>
                  <Text style={styles.stepBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            }
          />
        </Card>

        <SectionTitle>{t('settings.groupApp')}</SectionTitle>
        <Card padded={false}>
          <ValueRow
            label={t('settings.language')}
            value={currentLanguage}
            onPress={() => setSheet('language')}
          />
          <Divider />
          <ValueRow
            label={t('settings.dateFormat')}
            value={currentDateFormat}
            onPress={() => setSheet('dateFormat')}
          />
          <Divider />
          <ValueRow
            label={t('settings.currency')}
            value={formatMoney(24.5)}
            onPress={() => setSheet('currency')}
          />
        </Card>
      </ScrollView>

      <OptionSheet
        visible={sheet === 'dateSource'}
        title={t('settings.dateSource')}
        help={t('settings.dateSourceDesc')}
        options={dateSourceOptions}
        value={dateSource}
        onSelect={(v) => { setDateSource(v); setSheet(null); }}
        onClose={() => setSheet(null)}
      />
      <OptionSheet
        visible={sheet === 'language'}
        title={t('settings.language')}
        help={t('settings.languageHelp')}
        options={languageOptions}
        value={locale}
        onSelect={(v) => { setLocale(v); setSheet(null); }}
        onClose={() => setSheet(null)}
      />
      <OptionSheet
        visible={sheet === 'currency'}
        title={t('settings.currency')}
        help={t('settings.currencyDesc')}
        options={currencyOptions}
        value={currency}
        onSelect={(v) => { setCurrency(v); setSheet(null); }}
        onClose={() => setSheet(null)}
      />
      <OptionSheet
        visible={sheet === 'dateFormat'}
        title={t('settings.dateFormat')}
        help={t('settings.dateFormatDesc')}
        options={dateFormatOptions}
        value={dateFormat}
        onSelect={(v) => { setDateFormat(v); setSheet(null); }}
        onClose={() => setSheet(null)}
      />
    </Screen>
  );
};

// The workhorse row: label on the left, current value plus chevron on the
// right. A value here always means "tapping opens something".
const ValueRow = ({ label, value, onPress }) => (
  <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={styles.rowValue} numberOfLines={1}>{value}</Text>
    <Icon name="chevron-forward" size={18} color={colors.textSubtle} />
  </TouchableOpacity>
);

// Rows that change in place: a switch or a stepper, no chevron.
const SettingRow = ({ label, description, right }) => (
  <View style={styles.row}>
    <View style={{ flex: 1, marginRight: spacing.md }}>
      <Text style={styles.rowLabel}>{label}</Text>
      {description ? <Text style={styles.rowDescription}>{description}</Text> : null}
    </View>
    {right}
  </View>
);

const Divider = () => <View style={styles.divider} />;

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 52,
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
  },
  rowLabel: {
    ...typography.body,
    color: colors.text,
    fontWeight: '500',
    flex: 1,
  },
  rowValue: {
    ...typography.body,
    color: colors.textMuted,
    flexShrink: 1,
    textAlign: 'right',
  },
  rowDescription: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
    lineHeight: 17,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.lg,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: {
    fontSize: 18,
    color: colors.text,
    fontWeight: '700',
  },
  stepValue: {
    ...typography.h3,
    color: colors.text,
    minWidth: 26,
    textAlign: 'center',
  },
});

export default SettingsScreen;
