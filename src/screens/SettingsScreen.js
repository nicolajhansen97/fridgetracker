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
import {
  Screen,
  ScreenHeader,
  Card,
  Pill,
  SectionTitle,
} from '../components/ui';
import { colors, radii, spacing, typography } from '../theme';

const FAMILY_SIZE_KEY = 'freezely_family_size';
const USE_PACKAGE_NUMBERS_KEY = 'freezely_use_package_numbers';

const SettingsScreen = ({ navigation }) => {
  const {
    user,
    biometricAvailable,
    biometricType,
    enableBiometric,
    disableBiometric,
    checkBiometricEnabled,
  } = useAuth();
  const { t, locale, setLocale, languages } = useLanguage();

  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [familySize, setFamilySize] = useState(4);
  const [usePackageNumbers, setUsePackageNumbers] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    checkBiometricStatus();
    AsyncStorage.getItem(FAMILY_SIZE_KEY).then((val) => {
      if (val) setFamilySize(parseInt(val));
    });
    AsyncStorage.getItem(USE_PACKAGE_NUMBERS_KEY).then((val) => {
      if (val !== null) setUsePackageNumbers(val === 'true');
    });
  }, []);

  const handleTogglePackageNumbers = (value) => {
    setUsePackageNumbers(value);
    AsyncStorage.setItem(USE_PACKAGE_NUMBERS_KEY, String(value));
  };

  const changeFamilySize = (delta) => {
    const n = Math.min(20, Math.max(1, familySize + delta));
    setFamilySize(n);
    AsyncStorage.setItem(FAMILY_SIZE_KEY, String(n));
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await checkBiometricStatus();
      const val = await AsyncStorage.getItem(FAMILY_SIZE_KEY);
      if (val) setFamilySize(parseInt(val));
      const pkgVal = await AsyncStorage.getItem(USE_PACKAGE_NUMBERS_KEY);
      if (pkgVal !== null) setUsePackageNumbers(pkgVal === 'true');
    } catch (e) {
      console.error('Refresh error:', e);
    } finally {
      setRefreshing(false);
    }
  };

  const checkBiometricStatus = async () => {
    const enabled = await checkBiometricEnabled();
    setBiometricEnabled(enabled);
  };

  const handleToggleBiometric = async () => {
    if (!biometricAvailable) {
      Alert.alert(t('login.notAvailable'), t('login.biometricNotAvailable', { type: biometricType }));
      return;
    }
    setIsLoading(true);
    if (biometricEnabled) {
      const result = await disableBiometric();
      if (result.success) {
        setBiometricEnabled(false);
        Alert.alert(t('common.success'), t('settings.biometricDisabled', { type: biometricType }));
      } else {
        Alert.alert(t('common.error'), result.error || t('settings.failedDisable'));
      }
    } else {
      const result = await enableBiometric(user?.email);
      if (result.success) {
        setBiometricEnabled(true);
        Alert.alert(t('common.success'), t('settings.biometricEnabled', { type: biometricType }));
      } else {
        Alert.alert(t('common.error'), result.error || t('settings.failedEnable'));
      }
    }
    setIsLoading(false);
  };

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
        <SectionTitle>{t('settings.account')}</SectionTitle>
        <Card>
          <Row label={t('common.email')} value={user?.email} />
        </Card>

        <SectionTitle>{t('settings.household')}</SectionTitle>
        <Card>
          <Row
            label={t('settings.familySize')}
            description={t('settings.familySizeDesc')}
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
          <Divider />
          <Row
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
        </Card>

        <SectionTitle>{t('settings.language')}</SectionTitle>
        <Card>
          <View style={styles.langGrid}>
            {languages.map((lang) => (
              <Pill
                key={lang.code}
                label={lang.label}
                icon={lang.flag}
                selected={locale === lang.code}
                onPress={() => setLocale(lang.code)}
                style={{ marginBottom: 8, marginRight: 8 }}
              />
            ))}
          </View>
        </Card>

        <SectionTitle>{t('settings.security')}</SectionTitle>
        <Card>
          <Row
            label={t('settings.biometricLogin', { type: biometricType })}
            description={
              biometricAvailable
                ? t('settings.biometricAvailable', { type: biometricType })
                : t('settings.biometricUnavailable', { type: biometricType })
            }
            right={
              <Switch
                value={biometricEnabled}
                onValueChange={handleToggleBiometric}
                trackColor={{ false: colors.borderStrong, true: colors.primary }}
                thumbColor={colors.surface}
                disabled={!biometricAvailable || isLoading}
              />
            }
          />
        </Card>

        <SectionTitle>{t('settings.about')}</SectionTitle>
        <Card>
          <Row label={t('settings.appName')} value="Freezely" />
          <Divider />
          <Row label={t('settings.version')} value="1.0.2" />
          <Divider />
          <TouchableOpacity onPress={() => navigation.navigate('Changelog')} activeOpacity={0.7}>
            <Row label={t('settings.whatsNew')} chevron />
          </TouchableOpacity>
        </Card>

        {biometricAvailable && (
          <Card style={styles.infoCard}>
            <Text style={styles.infoTitle}>{t('settings.secureConvenient')}</Text>
            <Text style={styles.infoText}>{t('settings.biometricInfo', { type: biometricType })}</Text>
          </Card>
        )}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </Screen>
  );
};

const Row = ({ label, description, value, right, chevron }) => (
  <View style={styles.row}>
    <View style={{ flex: 1, marginRight: spacing.md }}>
      <Text style={styles.rowLabel}>{label}</Text>
      {description ? <Text style={styles.rowDescription}>{description}</Text> : null}
    </View>
    {value ? <Text style={styles.rowValue} numberOfLines={1}>{value}</Text> : null}
    {right}
    {chevron ? <Text style={styles.chevron}>›</Text> : null}
  </View>
);

const Divider = () => <View style={styles.divider} />;

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  rowLabel: {
    ...typography.bodyStrong,
    color: colors.text,
  },
  rowDescription: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
    lineHeight: 17,
  },
  rowValue: {
    ...typography.body,
    color: colors.textMuted,
    flexShrink: 1,
    textAlign: 'right',
  },
  chevron: {
    fontSize: 22,
    color: colors.textSubtle,
    marginLeft: spacing.sm,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: -spacing.lg,
  },
  langGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingTop: 4,
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
    minWidth: 28,
    textAlign: 'center',
  },
  infoCard: {
    marginTop: spacing.lg,
    backgroundColor: '#ECFEFF',
  },
  infoTitle: {
    ...typography.h3,
    color: colors.primaryDark,
    marginBottom: 6,
  },
  infoText: {
    ...typography.body,
    color: colors.textMuted,
    lineHeight: 20,
  },
});

export default SettingsScreen;
