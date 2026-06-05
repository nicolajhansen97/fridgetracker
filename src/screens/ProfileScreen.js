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
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { useHousehold } from '../context/HouseholdContext';
import { useOTAUpdate } from '../context/OTAUpdateContext';
import { usePremium } from '../context/PremiumContext';
import { useLanguage } from '../i18n';
import { CURRENT_VERSION } from '../changelog';
import PaywallModal from '../components/PaywallModal';
import {
  Screen,
  Card,
  Icon,
  Pill,
  SectionTitle,
  SecondaryButton,
} from '../components/ui';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients, radii, shadows, spacing, typography } from '../theme';

const FAMILY_SIZE_KEY = 'freezely_family_size';
const USE_PACKAGE_NUMBERS_KEY = 'freezely_use_package_numbers';

const ProfileScreen = ({ navigation }) => {
  const {
    user,
    logout,
    biometricAvailable,
    biometricType,
    enableBiometric,
    disableBiometric,
    checkBiometricEnabled,
  } = useAuth();
  const { currentHousehold, householdMembers, invitations } = useHousehold();
  const { isPremium, premiumSource, manageSubscription, devPro, setDevPremium } = usePremium();
  const { checking: checkingForUpdate, checkManually } = useOTAUpdate();
  const { t, locale, setLocale, languages, dateFormat, setDateFormat, dateFormats } = useLanguage();
  const insets = useSafeAreaInsets();

  const handleCheckForUpdates = async () => {
    const result = await checkManually();
    if (result.disabled) {
      Alert.alert(t('update.unavailable'), t('update.unavailableBody'));
      return;
    }
    if (result.error) {
      Alert.alert(t('common.error'), result.error);
      return;
    }
    if (!result.isAvailable) {
      Alert.alert(t('update.upToDate'), t('update.upToDateBody'));
    }
    // If isAvailable, the OTAUpdateModal will show automatically via context state.
  };

  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [bioLoading, setBioLoading] = useState(false);
  const [familySize, setFamilySize] = useState(4);
  const [usePackageNumbers, setUsePackageNumbers] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);

  useEffect(() => {
    checkBiometricStatus();
    AsyncStorage.getItem(FAMILY_SIZE_KEY).then((val) => {
      if (val) setFamilySize(parseInt(val));
    });
    AsyncStorage.getItem(USE_PACKAGE_NUMBERS_KEY).then((val) => {
      if (val !== null) setUsePackageNumbers(val === 'true');
    });
  }, []);

  const checkBiometricStatus = async () => {
    const enabled = await checkBiometricEnabled();
    setBiometricEnabled(enabled);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await checkBiometricStatus();
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

  const handleToggleBiometric = async () => {
    if (!biometricAvailable) {
      Alert.alert(t('login.notAvailable'), t('login.biometricNotAvailable', { type: biometricType }));
      return;
    }
    setBioLoading(true);
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
    setBioLoading(false);
  };

  const initials = (user?.email || '?').slice(0, 1).toUpperCase();
  const memberCount = householdMembers?.length || 0;
  const inviteCount = invitations?.length || 0;

  return (
    <Screen>
      <LinearGradient
        colors={gradients.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.identityHeader, { paddingTop: insets.top + spacing.md }]}
      >
        {/* Snowfrost — faint brand texture */}
        <Icon name="snow" size={120} color="rgba(255,255,255,0.10)" style={styles.snowBig} />
        <Icon name="snow" size={54} color="rgba(255,255,255,0.08)" style={styles.snowSmall} />

        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.identityEmail} numberOfLines={1}>{user?.email || 'User'}</Text>
          {currentHousehold ? (
            <View style={styles.identityHouseholdRow}>
              <Icon name="people-outline" size={13} color={colors.whiteAlpha80} />
              <Text style={styles.identityHousehold} numberOfLines={1}>
                {currentHousehold.name}
              </Text>
            </View>
          ) : (
            <Text style={styles.identityHousehold}>{t('settings.appName')}</Text>
          )}
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <SectionTitle>{t('home.familySharing')}</SectionTitle>
        <TouchableOpacity activeOpacity={0.85} onPress={() => navigation.navigate('ManageHousehold')}>
          <Card>
            <View style={styles.linkRow}>
              <View style={{ flex: 1 }}>
                {currentHousehold ? (
                  <>
                    <Text style={styles.linkTitle}>{currentHousehold.name}</Text>
                    <Text style={styles.linkSub}>
                      {t('household.members', { count: memberCount })}
                      {inviteCount > 0 ? `  ·  ${inviteCount} ${t('household.pendingInvitations').toLowerCase()}` : ''}
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.linkTitle}>{t('home.familySharing')}</Text>
                    <Text style={styles.linkSub}>{t('household.allHouseholds')}</Text>
                  </>
                )}
              </View>
              {inviteCount > 0 ? (
                <View style={styles.invitePill}>
                  <Text style={styles.invitePillText}>{inviteCount}</Text>
                </View>
              ) : null}
              <Icon name="chevron-forward" size={18} color={colors.textSubtle} />
            </View>
          </Card>
        </TouchableOpacity>

        <SectionTitle>{t('premium.subscriptionSection')}</SectionTitle>
        <Card padded={false}>
          <View style={styles.subRow}>
            <View style={styles.subIconWrap}>
              <Icon name="sparkles" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.subTitle}>{isPremium ? 'Freezely Pro' : 'Freezely'}</Text>
              <Text style={styles.subStatus}>
                {!isPremium
                  ? t('premium.statusFree')
                  : premiumSource === 'household'
                  ? t('premium.statusProHousehold')
                  : t('premium.statusPro')}
              </Text>
            </View>
            <View style={[styles.planBadge, isPremium ? styles.planBadgePro : styles.planBadgeFree]}>
              <Text style={[styles.planBadgeText, isPremium && styles.planBadgeTextPro]}>
                {isPremium ? t('premium.proBadge') : t('premium.freeBadge')}
              </Text>
            </View>
          </View>
          {premiumSource !== 'household' && (
            <>
              <Divider />
              {premiumSource === 'self' ? (
                <NavRow
                  iconName="card-outline"
                  title={t('premium.manage')}
                  onPress={manageSubscription}
                />
              ) : (
                <NavRow
                  iconName="arrow-up-circle-outline"
                  title={t('premium.upgrade')}
                  onPress={() => setPaywallVisible(true)}
                />
              )}
            </>
          )}
          {__DEV__ ? (
            <>
              <Divider />
              <SettingRow
                label="DEV: Force Pro"
                description="Local testing only — not shown in production"
                right={
                  <Switch
                    value={devPro}
                    onValueChange={setDevPremium}
                    trackColor={{ false: colors.borderStrong, true: colors.primary }}
                    thumbColor={colors.surface}
                  />
                }
              />
            </>
          ) : null}
        </Card>

        <SectionTitle>{t('settings.title')}</SectionTitle>
        <Card padded={false}>
          <NavRow
            iconName="cube-outline"
            title={t('home.manageCompartments')}
            onPress={() => navigation.navigate('ManageDrawers')}
          />
          <Divider />
          <NavRow
            iconName="bar-chart-outline"
            title={t('home.activityHistory')}
            onPress={() => navigation.navigate('ActivityHistory')}
          />
          <Divider />
          <NavRow
            iconName="snow-outline"
            title={t('freezerSettings.profileRow')}
            onPress={() => navigation.navigate('FreezerStorageSettings')}
          />
        </Card>

        <SectionTitle>{t('settings.household')}</SectionTitle>
        <Card>
          <SettingRow
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
          <Divider inset />
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

        <SectionTitle>{t('settings.dateFormat')}</SectionTitle>
        <Card>
          <Text style={[styles.settingDescription, { marginBottom: spacing.sm }]}>
            {t('settings.dateFormatDesc')}
          </Text>
          <View style={styles.langGrid}>
            {dateFormats.map((df) => (
              <Pill
                key={df.code}
                label={`${t(`settings.dateFormat_${df.code}`)} (${df.pattern})`}
                selected={dateFormat === df.code}
                onPress={() => setDateFormat(df.code)}
                style={{ marginBottom: 8, marginRight: 8 }}
              />
            ))}
          </View>
        </Card>

        <SectionTitle>{t('settings.security')}</SectionTitle>
        <Card>
          <SettingRow
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
                disabled={!biometricAvailable || bioLoading}
              />
            }
          />
        </Card>

        <SectionTitle>{t('feedback.support')}</SectionTitle>
        <Card padded={false}>
          <NavRow
            iconName="chatbubble-ellipses-outline"
            title={t('feedback.title')}
            onPress={() => navigation.navigate('Feedback')}
          />
        </Card>

        <SectionTitle>{t('settings.about')}</SectionTitle>
        <Card padded={false}>
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>{t('settings.appName')}</Text>
            <Text style={styles.aboutValue}>Freezely</Text>
          </View>
          <Divider />
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>{t('settings.version')}</Text>
            <Text style={styles.aboutValue}>{CURRENT_VERSION}</Text>
          </View>
          <Divider />
          <NavRow
            iconName="sparkles-outline"
            title={t('settings.whatsNew')}
            onPress={() => navigation.navigate('Changelog')}
          />
          <Divider />
          <NavRow
            iconName="cloud-download-outline"
            title={t('update.checkNow')}
            onPress={handleCheckForUpdates}
            loading={checkingForUpdate}
          />
        </Card>

        <View style={{ height: spacing.lg }} />
        <SecondaryButton
          title={t('home.logout')}
          danger
          onPress={() => {
            Alert.alert(t('home.logout'), null, [
              { text: t('common.cancel'), style: 'cancel' },
              { text: t('home.logout'), style: 'destructive', onPress: logout },
            ]);
          }}
        />
        <View style={{ height: spacing.xxxl }} />
      </ScrollView>

      <PaywallModal visible={paywallVisible} onClose={() => setPaywallVisible(false)} />
    </Screen>
  );
};

const NavRow = ({ iconName, title, onPress, loading }) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.7}
    style={styles.navRow}
    disabled={loading}
  >
    {iconName ? (
      <View style={styles.navIconWrap}>
        <Icon name={iconName} size={18} color={colors.primary} />
      </View>
    ) : null}
    <Text style={[styles.navTitle, !iconName && { marginLeft: 0 }]}>{title}</Text>
    {loading ? (
      <ActivityIndicator size="small" color={colors.primary} />
    ) : (
      <Icon name="chevron-forward" size={18} color={colors.textSubtle} />
    )}
  </TouchableOpacity>
);

const SettingRow = ({ label, description, right }) => (
  <View style={styles.settingRow}>
    <View style={{ flex: 1, marginRight: spacing.md }}>
      <Text style={styles.settingLabel}>{label}</Text>
      {description ? <Text style={styles.settingDescription}>{description}</Text> : null}
    </View>
    {right}
  </View>
);

const Divider = ({ inset }) => (
  <View style={[styles.divider, inset && { marginHorizontal: 0 }]} />
);

const styles = StyleSheet.create({
  identityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    // paddingTop is set inline to include the safe-area inset
    paddingBottom: spacing.lg,
    gap: spacing.md,
    borderBottomLeftRadius: radii.lg,
    borderBottomRightRadius: radii.lg,
    overflow: 'hidden',
  },
  snowBig: {
    position: 'absolute',
    right: -16,
    top: -10,
  },
  snowSmall: {
    position: 'absolute',
    right: 70,
    bottom: -12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.whiteAlpha20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.whiteAlpha30,
  },
  avatarText: {
    color: colors.surface,
    fontSize: 24,
    fontWeight: '800',
  },
  identityEmail: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
    color: colors.surface,
  },
  identityHousehold: {
    color: colors.whiteAlpha80,
    fontSize: 13,
    marginTop: 2,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },

  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  linkTitle: {
    ...typography.bodyStrong,
    color: colors.text,
  },
  linkSub: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  invitePill: {
    backgroundColor: colors.danger,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
    minWidth: 22,
    alignItems: 'center',
  },
  invitePillText: {
    color: colors.surface,
    fontSize: 11,
    fontWeight: '700',
  },
  identityHouseholdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  navIconWrap: {
    width: 24,
    alignItems: 'center',
  },

  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  navTitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: '500',
    flex: 1,
  },

  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  settingLabel: {
    ...typography.bodyStrong,
    color: colors.text,
  },
  settingDescription: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
    lineHeight: 17,
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

  langGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingTop: 4,
  },

  aboutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
  },
  aboutLabel: {
    ...typography.body,
    color: colors.text,
  },
  aboutValue: {
    ...typography.body,
    color: colors.textMuted,
  },

  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.lg,
  },

  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  subIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: '#ECFEFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subTitle: {
    ...typography.bodyStrong,
    color: colors.text,
  },
  subStatus: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  planBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  planBadgeFree: {
    backgroundColor: colors.surfaceMuted,
  },
  planBadgePro: {
    backgroundColor: colors.primary,
  },
  planBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: colors.textMuted,
  },
  planBadgeTextPro: {
    color: colors.surface,
  },
});

export default ProfileScreen;
