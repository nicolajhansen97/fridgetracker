import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLanguage } from '../i18n';
import { usePremium } from '../context/PremiumContext';
import { useNotifications } from '../context/NotificationContext';
import PaywallModal from '../components/PaywallModal';
import {
  MIN_LEAD_DAYS,
  MAX_LEAD_DAYS,
  dateToTime,
  formatTime,
  sendTestNotification,
  timeToDate,
} from '../utils/notifications';
import { Screen, ScreenHeader, Card, Icon, SectionTitle } from '../components/ui';
import { colors, radii, spacing, typography } from '../theme';

// A row that is either live or locked behind Pro. Locked rows stay visible and
// legible — hiding them would make the Pro tier invisible, and greying them out
// without saying why reads as a bug.
const ProLock = ({ children, locked, onPress }) => {
  if (!locked) return children;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} accessibilityRole="button">
      <View pointerEvents="none" style={styles.locked}>
        {children}
      </View>
    </TouchableOpacity>
  );
};

const RowLabel = ({ title, description, pro }) => (
  <View style={{ flex: 1, minWidth: 0 }}>
    <View style={styles.titleRow}>
      <Text style={styles.rowTitle}>{title}</Text>
      {pro ? (
        <View style={styles.proTag}>
          <Text style={styles.proTagText}>PRO</Text>
        </View>
      ) : null}
    </View>
    {description ? <Text style={styles.rowDesc}>{description}</Text> : null}
  </View>
);

const TimeRow = ({ title, description, value, onChange, pro, t }) => {
  const [picking, setPicking] = useState(false);
  return (
    <>
      <TouchableOpacity
        style={styles.row}
        onPress={() => setPicking(true)}
        activeOpacity={0.7}
        accessibilityRole="button"
      >
        <RowLabel title={title} description={description} pro={pro} />
        <View style={styles.timePill}>
          <Icon name="time-outline" size={14} color={colors.primary} />
          <Text style={styles.timeText}>{formatTime(value)}</Text>
        </View>
      </TouchableOpacity>
      {picking ? (
        <DateTimePicker
          value={timeToDate(value)}
          mode="time"
          is24Hour
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, date) => {
            // Android fires once and dismisses itself; iOS keeps the spinner up
            // until the user leaves the row.
            if (Platform.OS !== 'ios') setPicking(false);
            if (event?.type === 'dismissed') return;
            if (date) onChange(dateToTime(date));
          }}
        />
      ) : null}
      {picking && Platform.OS === 'ios' ? (
        <TouchableOpacity onPress={() => setPicking(false)} style={styles.doneBtn}>
          <Text style={styles.doneText}>{t('common.ok')}</Text>
        </TouchableOpacity>
      ) : null}
    </>
  );
};

const Divider = () => <View style={styles.divider} />;

const NotificationSettingsScreen = ({ navigation }) => {
  const { t, locale } = useLanguage();
  const { isPremium } = usePremium();
  const {
    prefs,
    resolved,
    permission,
    scheduledCount,
    enable,
    disable,
    updatePrefs,
  } = useNotifications();

  const [paywallVisible, setPaywallVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  const blocked = permission === 'denied';

  const handleToggle = async (value) => {
    if (busy) return;
    setBusy(true);
    try {
      if (!value) {
        await disable();
        return;
      }
      const res = await enable();
      if (!res.success) {
        Alert.alert(t('notif.permissionDenied'), t('notif.permissionDeniedDesc'), [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('notif.openSettings'), onPress: () => Linking.openSettings() },
        ]);
      }
    } finally {
      setBusy(false);
    }
  };

  const changeLead = (delta) => {
    const next = Math.min(MAX_LEAD_DAYS, Math.max(MIN_LEAD_DAYS, resolved.leadDays + delta));
    if (next !== resolved.leadDays) updatePrefs({ leadDays: next });
  };

  const handleTest = async () => {
    const ok = await sendTestNotification({
      title: t('notif.testTitle'),
      body: t('notif.testBody'),
    });
    Alert.alert(ok ? t('notif.testSent') : t('common.error'), ok ? t('notif.testSentDesc') : '');
  };

  // Weekday names come from the platform rather than 35 translation strings.
  const weekdays = React.useMemo(() => {
    const out = [];
    for (let i = 0; i < 7; i++) {
      // 2024-01-07 was a Sunday, so +i lands on weekday i.
      const d = new Date(2024, 0, 7 + i);
      let label;
      try {
        label = d.toLocaleDateString(locale, { weekday: 'short' });
      } catch {
        label = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][i];
      }
      out.push(label);
    }
    return out;
  }, [locale]);

  const openPaywall = () => setPaywallVisible(true);
  const on = prefs.enabled && permission === 'granted';

  return (
    <Screen>
      <ScreenHeader
        title={t('notif.title')}
        subtitle={t('notif.subtitle')}
        onBack={() => navigation.goBack()}
        backLabel={t('common.back')}
      />

      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.intro}>
          <Icon name="notifications-outline" size={20} color={colors.primary} />
          <Text style={styles.introText}>{t('notif.intro')}</Text>
        </Card>

        {blocked ? (
          <TouchableOpacity onPress={() => Linking.openSettings()} activeOpacity={0.8}>
            <Card style={styles.warn}>
              <Icon name="warning-outline" size={20} color={colors.warning} />
              <Text style={styles.warnText}>{t('notif.blocked')}</Text>
            </Card>
          </TouchableOpacity>
        ) : null}

        <SectionTitle>{t('notif.sectionBasics')}</SectionTitle>
        <Card padded={false}>
          <View style={styles.row}>
            <RowLabel title={t('notif.enable')} description={t('notif.enableDesc')} />
            <Switch
              value={on}
              onValueChange={handleToggle}
              disabled={busy}
              trackColor={{ true: colors.primary }}
            />
          </View>

          {on ? (
            <>
              <Divider />
              <TimeRow
                title={t('notif.dailyTime')}
                description={t('notif.dailyTimeDesc')}
                value={prefs.dailyTime}
                onChange={(v) => updatePrefs({ dailyTime: v })}
                t={t}
              />
              <Divider />
              <View style={styles.row}>
                <RowLabel
                  title={t('notif.leadDays')}
                  description={
                    isPremium ? t('notif.leadDaysDesc') : t('notif.leadDaysDescFree')
                  }
                  pro={!isPremium}
                />
                {isPremium ? (
                  <View style={styles.stepper}>
                    <TouchableOpacity
                      onPress={() => changeLead(-1)}
                      style={styles.stepBtn}
                      hitSlop={6}
                    >
                      <Icon name="remove" size={18} color={colors.primary} />
                    </TouchableOpacity>
                    <Text style={styles.stepValue}>{resolved.leadDays}</Text>
                    <TouchableOpacity
                      onPress={() => changeLead(1)}
                      style={styles.stepBtn}
                      hitSlop={6}
                    >
                      <Icon name="add" size={18} color={colors.primary} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity onPress={openPaywall} style={styles.lockedValue} hitSlop={6}>
                    <Text style={styles.lockedValueText}>{resolved.leadDays}</Text>
                    <Icon name="lock-closed" size={13} color={colors.textSubtle} />
                  </TouchableOpacity>
                )}
              </View>
            </>
          ) : null}
        </Card>

        {on ? (
          <>
            <SectionTitle>{t('notif.sectionSmart')}</SectionTitle>
            <Card padded={false}>
              <ProLock locked={!isPremium} onPress={openPaywall}>
                <View style={styles.row}>
                  <RowLabel
                    title={t('notif.eveningNudge')}
                    description={t('notif.eveningNudgeDesc')}
                    pro={!isPremium}
                  />
                  <Switch
                    value={resolved.eveningNudge}
                    onValueChange={(v) => updatePrefs({ eveningNudge: v })}
                    trackColor={{ true: colors.primary }}
                  />
                </View>
              </ProLock>

              {isPremium && resolved.eveningNudge ? (
                <>
                  <Divider />
                  <TimeRow
                    title={t('notif.eveningTime')}
                    value={prefs.eveningTime}
                    onChange={(v) => updatePrefs({ eveningTime: v })}
                    t={t}
                  />
                </>
              ) : null}

              <Divider />

              <ProLock locked={!isPremium} onPress={openPaywall}>
                <View style={styles.row}>
                  <RowLabel
                    title={t('notif.weeklySummary')}
                    description={t('notif.weeklySummaryDesc')}
                    pro={!isPremium}
                  />
                  <Switch
                    value={resolved.weeklySummary}
                    onValueChange={(v) => updatePrefs({ weeklySummary: v })}
                    trackColor={{ true: colors.primary }}
                  />
                </View>
              </ProLock>

              {isPremium && resolved.weeklySummary ? (
                <>
                  <Divider />
                  <View style={styles.weekdayRow}>
                    {weekdays.map((label, i) => {
                      const active = Number(prefs.weeklyDay) === i;
                      return (
                        <TouchableOpacity
                          key={label + i}
                          onPress={() => updatePrefs({ weeklyDay: i })}
                          style={[styles.weekday, active && styles.weekdayActive]}
                        >
                          <Text
                            style={[styles.weekdayText, active && styles.weekdayTextActive]}
                            numberOfLines={1}
                          >
                            {label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <Divider />
                  <TimeRow
                    title={t('notif.weeklyTime')}
                    value={prefs.weeklyTime}
                    onChange={(v) => updatePrefs({ weeklyTime: v })}
                    t={t}
                  />
                </>
              ) : null}
            </Card>
          </>
        ) : null}

        {on ? (
          <>
            <SectionTitle>{t('notif.sectionCheck')}</SectionTitle>
            <Card padded={false}>
              <View style={styles.row}>
                <RowLabel
                  title={t('notif.scheduled')}
                  description={t('notif.scheduledDesc')}
                />
                <Text style={styles.count}>{scheduledCount}</Text>
              </View>
              <Divider />
              <TouchableOpacity style={styles.row} onPress={handleTest} activeOpacity={0.7}>
                <RowLabel title={t('notif.test')} description={t('notif.testDesc')} />
                <Icon name="chevron-forward" size={18} color={colors.textSubtle} />
              </TouchableOpacity>
            </Card>
          </>
        ) : null}

        <Text style={styles.footnote}>{t('notif.footnote')}</Text>
      </ScrollView>

      <PaywallModal visible={paywallVisible} onClose={() => setPaywallVisible(false)} />
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  intro: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  introText: {
    ...typography.caption,
    color: colors.textMuted,
    flex: 1,
    lineHeight: 18,
  },
  warn: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  warnText: {
    ...typography.caption,
    color: colors.text,
    flex: 1,
    lineHeight: 18,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  rowTitle: {
    ...typography.bodyStrong,
    color: colors.text,
  },
  rowDesc: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
    lineHeight: 17,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: spacing.lg,
  },
  locked: {
    opacity: 0.55,
  },
  proTag: {
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginLeft: 2,
  },
  proTagText: {
    color: colors.surface,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  timePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.primarySoft,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  timeText: {
    ...typography.bodyStrong,
    color: colors.primary,
  },
  doneBtn: {
    alignSelf: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  doneText: {
    ...typography.button,
    color: colors.primary,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stepBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValue: {
    ...typography.bodyStrong,
    color: colors.text,
    minWidth: 22,
    textAlign: 'center',
  },
  lockedValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  lockedValueText: {
    ...typography.bodyStrong,
    color: colors.textSubtle,
  },
  weekdayRow: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  weekday: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
  },
  weekdayActive: {
    backgroundColor: colors.primary,
  },
  weekdayText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
  },
  weekdayTextActive: {
    color: colors.surface,
  },
  count: {
    ...typography.bodyStrong,
    color: colors.primary,
  },
  footnote: {
    ...typography.caption,
    color: colors.textSubtle,
    textAlign: 'center',
    marginTop: spacing.lg,
    lineHeight: 17,
  },
});

export default NotificationSettingsScreen;
