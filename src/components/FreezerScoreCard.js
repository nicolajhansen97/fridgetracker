import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Card, Icon, PrimaryButton, SecondaryButton } from './ui';
import { colors, radii, spacing, typography } from '../theme';
import { useLanguage } from '../i18n';
import { useFreezerScore, scoreGrade } from '../hooks/useFreezerScore';

// The freezer score on Home, and the sheet that explains it.
//
// A bare number invites "why 71?" and gives no way to move it, so tapping it
// always shows the two parts it is made of and what would raise each.

const GRADE_COLORS = {
  great: { ring: colors.success, text: colors.successText, soft: colors.successSoft },
  good: { ring: colors.primary, text: colors.primaryText, soft: colors.primarySoft },
  fair: { ring: colors.warning, text: colors.warningText, soft: colors.warningSoft },
  poor: { ring: colors.danger, text: colors.dangerText, soft: colors.dangerSoft },
};

const Part = ({ label, share, detail }) => (
  <View style={styles.part}>
    <View style={styles.partHead}>
      <Text style={styles.partLabel}>{label}</Text>
      {share !== null ? <Text style={styles.partValue}>{Math.round(share * 100)}%</Text> : null}
    </View>
    {share !== null ? (
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.round(share * 100)}%` }]} />
      </View>
    ) : null}
    <Text style={styles.partDetail}>{detail}</Text>
  </View>
);

const FreezerScoreCard = () => {
  const { t } = useLanguage();
  const navigation = useNavigation();
  const { result } = useFreezerScore();
  const [open, setOpen] = useState(false);

  if (!result) return null;

  const grade = scoreGrade(result.score);
  const tone = GRADE_COLORS[grade];
  const gradeLabel = t(`score.${grade}`);
  const { fresh, eaten } = result;

  // The one thing most worth doing next, in the order it helps the score.
  const reason =
    fresh.past > 0
      ? t('score.pastDate', { count: fresh.past })
      : eaten.threw > 0
        ? t('score.thrownMonth', { count: eaten.threw })
        : t('score.allGood');

  const close = () => setOpen(false);

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${t('score.title')} ${result.score}, ${gradeLabel}. ${reason}`}
      >
        <Card style={styles.card}>
          <View style={[styles.ring, { borderColor: tone.ring, backgroundColor: tone.soft }]}>
            <Text style={[styles.ringValue, { color: tone.text }]}>{result.score}</Text>
          </View>
          <View style={styles.body}>
            <Text style={styles.title} numberOfLines={1}>
              {t('score.title')}
              <Text style={{ color: tone.text }}>{`  ${gradeLabel}`}</Text>
            </Text>
            <Text style={styles.reason} numberOfLines={1}>{reason}</Text>
          </View>
          <Icon name="chevron-forward" size={18} color={colors.textSubtle} />
        </Card>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" statusBarTranslucent onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close}>
          <Pressable style={styles.sheet}>
            <View style={styles.sheetHead}>
              <View style={[styles.ring, styles.ringLarge, { borderColor: tone.ring, backgroundColor: tone.soft }]}>
                <Text style={[styles.ringValue, styles.ringValueLarge, { color: tone.text }]}>
                  {result.score}
                </Text>
              </View>
              <View style={styles.body}>
                <Text style={styles.sheetTitle}>{t('score.title')}</Text>
                <Text style={[styles.sheetGrade, { color: tone.text }]}>{gradeLabel}</Text>
              </View>
            </View>

            <Part
              label={t('score.freshLabel')}
              share={fresh.share}
              detail={
                fresh.share === null
                  ? t('score.freshNone')
                  : t('score.freshDetail', { fresh: fresh.tracked - fresh.past, tracked: fresh.tracked })
              }
            />
            <Part
              label={t('score.eatenLabel')}
              share={eaten.share}
              detail={
                eaten.share === null
                  ? t('score.eatenNone')
                  : t('score.eatenDetail', { ate: eaten.ate, threw: eaten.threw })
              }
            />

            <Text style={styles.how}>{t('score.how')}</Text>

            <View style={styles.actions}>
              <SecondaryButton title={t('score.close')} onPress={close} style={styles.actionBtn} />
              <PrimaryButton
                title={t('home.useFirst')}
                onPress={() => {
                  close();
                  navigation.navigate('ExpiringItems');
                }}
                fullWidth={false}
                style={styles.actionBtn}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  ring: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringLarge: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  ringValue: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  ringValueLarge: {
    fontSize: 22,
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  reason: {
    ...typography.bodySmall,
    color: colors.textMuted,
    marginTop: 2,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  sheetTitle: {
    ...typography.h3,
    color: colors.text,
  },
  sheetGrade: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  part: {
    marginTop: spacing.lg,
  },
  partHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  partLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  partValue: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  track: {
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
    marginTop: 8,
  },
  fill: {
    height: '100%',
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
  },
  partDetail: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 6,
  },
  how: {
    ...typography.caption,
    color: colors.textMuted,
    lineHeight: 18,
    marginTop: spacing.lg,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  actionBtn: {
    flex: 1,
  },
});

export default FreezerScoreCard;
