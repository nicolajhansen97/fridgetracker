import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLanguage } from '../i18n';
import { usePremium } from '../context/PremiumContext';
import Icon from './ui/Icon';
import { colors, gradients, radii, shadows, spacing, typography } from '../theme';

// Required by App Review (Guideline 3.1.2) for auto-renewable subscriptions:
// the paywall must link to a Terms of Use (EULA) and a Privacy Policy. We use
// Apple's standard EULA for terms and the hosted Freezely privacy policy.
const TERMS_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
const PRIVACY_URL = 'https://nicolajhansen97.github.io/pages/privacy-policy.html';

// Controlled paywall: pass `visible` + `onClose`. Any screen can trigger it.
// Offers two plans — individual ($0.99) and household ($1.49, covers everyone
// in the buyer's household).
const Benefit = ({ text }) => (
  <View style={styles.benefitRow}>
    <Icon name="checkmark-circle" size={18} color={colors.primary} />
    <Text style={styles.benefitText}>{text}</Text>
  </View>
);

const PlanCard = ({ title, desc, price, recommended, badge, onPress, loading, disabled }) => (
  <TouchableOpacity
    style={[styles.plan, recommended && styles.planRecommended]}
    onPress={onPress}
    disabled={disabled}
    activeOpacity={0.85}
  >
    <View style={{ flex: 1, minWidth: 0 }}>
      <View style={styles.planTitleRow}>
        <Text style={styles.planTitle}>{title}</Text>
        {badge ? (
          <View style={styles.planBadge}>
            <Text style={styles.planBadgeText}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.planDesc}>{desc}</Text>
    </View>
    <View style={styles.planRight}>
      {loading ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.planPrice}>{price}</Text>}
    </View>
  </TouchableOpacity>
);

const PaywallModal = ({ visible, onClose }) => {
  const { t } = useLanguage();
  const {
    purchaseIndividual,
    purchaseHousehold,
    restore,
    individualPrice,
    householdPrice,
    trialDays,
    canPurchase,
  } = usePremium();
  const [busy, setBusy] = useState(null); // 'individual' | 'household' | 'restore' | null

  const householdLine = householdPrice
    ? t('premium.perMonthPrice', { price: householdPrice })
    : t('premium.planHouseholdPrice');
  const individualLine = individualPrice
    ? t('premium.perMonthPrice', { price: individualPrice })
    : t('premium.planIndividualPrice');

  // Trial copy reflects the store's actual intro offer; if the store reports
  // none we make no trial claim (just "cancel anytime").
  const trialLine = trialDays
    ? t('premium.trialNoteDynamic', { days: trialDays })
    : t('premium.cancelAnytime');

  const runPurchase = async (which, fn) => {
    setBusy(which);
    const res = await fn();
    setBusy(null);
    if (res.success) {
      onClose?.();
      return;
    }
    if (res.cancelled) return; // user dismissed the native sheet
    Alert.alert(t('common.error'), t('premium.purchaseFailed'));
  };

  const handleRestore = async () => {
    setBusy('restore');
    const res = await restore();
    setBusy(null);
    if (res.success && res.isPremium) {
      Alert.alert(t('premium.restored'), '', [{ text: t('common.ok'), onPress: onClose }]);
    } else if (res.success) {
      Alert.alert(t('premium.nothingToRestore'));
    } else {
      Alert.alert(t('common.error'), t('premium.purchaseFailed'));
    }
  };

  const anyBusy = busy !== null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>
            <LinearGradient
              colors={gradients.hero}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.iconWrap}
            >
              <Icon name="sparkles" size={28} color={colors.surface} />
            </LinearGradient>

            <Text style={styles.title}>{t('premium.upgradeTitle')}</Text>
            <Text style={styles.subtitle}>{t('premium.upgradeSubtitle')}</Text>

            <View style={styles.benefits}>
              <Benefit text={t('premium.benefitScan')} />
              <Benefit text={t('premium.benefitCalendar')} />
              <Benefit text={t('premium.benefitExpiry')} />
              <Benefit text={t('premium.benefitSupport')} />
            </View>

            <Text style={styles.chooseLabel}>{t('premium.choosePlan')}</Text>

            <PlanCard
              title={t('premium.planHouseholdTitle')}
              desc={t('premium.planHouseholdDesc')}
              price={householdLine}
              badge={t('premium.planHouseholdBadge')}
              recommended
              onPress={() => runPurchase('household', purchaseHousehold)}
              loading={busy === 'household'}
              disabled={anyBusy}
            />
            <PlanCard
              title={t('premium.planIndividualTitle')}
              desc={t('premium.planIndividualDesc')}
              price={individualLine}
              onPress={() => runPurchase('individual', purchaseIndividual)}
              loading={busy === 'individual'}
              disabled={anyBusy}
            />

            <Text style={styles.trialNote}>{trialLine}</Text>

            <TouchableOpacity onPress={handleRestore} disabled={anyBusy} hitSlop={6} style={styles.secondaryBtn}>
              <Text style={styles.restoreText}>{t('premium.restore')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} disabled={anyBusy} hitSlop={6} style={styles.laterBtn}>
              <Text style={styles.laterText}>{t('premium.maybeLater')}</Text>
            </TouchableOpacity>

            <Text style={styles.disclosure}>{t('premium.autoRenewDisclosure')}</Text>
            <View style={styles.linksRow}>
              <TouchableOpacity onPress={() => Linking.openURL(TERMS_URL)} hitSlop={8}>
                <Text style={styles.linkText}>{t('premium.termsOfUse')}</Text>
              </TouchableOpacity>
              <Text style={styles.linkSep}>·</Text>
              <TouchableOpacity onPress={() => Linking.openURL(PRIVACY_URL)} hitSlop={8}>
                <Text style={styles.linkText}>{t('premium.privacyPolicy')}</Text>
              </TouchableOpacity>
            </View>

            {!canPurchase ? <Text style={styles.devNote}>{t('premium.unavailableNote')}</Text> : null}
          </ScrollView>
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
    width: '100%',
    maxWidth: 400,
    maxHeight: '88%',
    ...shadows.button,
  },
  scrollBody: {
    padding: spacing.xxl,
    alignItems: 'center',
  },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h2,
    color: colors.text,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: spacing.lg,
  },
  benefits: {
    alignSelf: 'stretch',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  benefitText: {
    ...typography.body,
    color: colors.text,
    flex: 1,
  },
  chooseLabel: {
    ...typography.label,
    color: colors.textMuted,
    alignSelf: 'stretch',
    marginBottom: spacing.sm,
  },
  plan: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  planRecommended: {
    borderColor: colors.primary,
    backgroundColor: '#F0FDFA',
  },
  planTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  planTitle: {
    ...typography.bodyStrong,
    color: colors.text,
  },
  planBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  planBadgeText: {
    color: colors.surface,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  planDesc: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 3,
  },
  planRight: {
    minWidth: 92,
    alignItems: 'flex-end',
  },
  planPrice: {
    ...typography.bodyStrong,
    color: colors.primary,
    textAlign: 'right',
  },
  trialNote: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  secondaryBtn: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.sm,
  },
  restoreText: {
    ...typography.button,
    color: colors.primary,
  },
  laterBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  laterText: {
    ...typography.button,
    color: colors.textMuted,
  },
  disclosure: {
    fontSize: 11,
    lineHeight: 16,
    color: colors.textSubtle,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  linksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: spacing.sm,
  },
  linkText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },
  linkSep: {
    fontSize: 12,
    color: colors.textSubtle,
  },
  devNote: {
    ...typography.caption,
    color: colors.textSubtle,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});

export default PaywallModal;
