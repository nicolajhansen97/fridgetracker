import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { supabase } from '../config/supabase';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n';
import { CURRENT_VERSION } from '../changelog';
import { getDeviceId, getDeviceModel, getPlatformVersion } from '../utils/deviceInfo';
import {
  Screen,
  ScreenHeader,
  Card,
  Icon,
  PrimaryButton,
} from '../components/ui';
import { colors, radii, spacing, typography } from '../theme';

const APP_VERSION = CURRENT_VERSION;

const CATEGORIES = [
  { key: 'bug',      iconName: 'bug-outline' },
  { key: 'feature',  iconName: 'bulb-outline' },
  { key: 'question', iconName: 'help-circle-outline' },
  { key: 'other',    iconName: 'chatbubble-outline' },
];

const FeedbackScreen = ({ navigation }) => {
  const { user } = useAuth();
  const { t, locale } = useLanguage();

  const [category, setCategory] = useState('bug');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const trimmed = message.trim();
    if (trimmed.length < 5) {
      Alert.alert(t('common.error'), t('feedback.messageRequired'));
      return;
    }

    setSubmitting(true);
    try {
      const deviceId = await getDeviceId();
      const { data, error } = await supabase.rpc('send_feedback_email', {
        p_category: category,
        p_message: trimmed,
        p_app_version: APP_VERSION,
        p_platform: Platform.OS,
        p_platform_version: getPlatformVersion(),
        p_device_model: getDeviceModel(),
        p_device_id: deviceId,
        p_locale: locale,
      });
      if (error) throw error;
      if (data && data.success === false) {
        throw new Error(data.error || 'Failed to send feedback');
      }
      Alert.alert(t('feedback.thanksTitle'), t('feedback.thanksBody'), [
        { text: t('common.ok'), onPress: () => navigation.goBack() },
      ]);
      setMessage('');
    } catch (e) {
      Alert.alert(t('common.error'), e?.message || 'Failed to send feedback');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <ScreenHeader
        title={t('feedback.title')}
        onBack={() => navigation.goBack()}
        backLabel={t('common.back')}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.intro}>{t('feedback.intro')}</Text>

          <Text style={styles.label}>{t('feedback.category')}</Text>
          <View style={styles.categoryGrid}>
            {CATEGORIES.map((c) => {
              const selected = category === c.key;
              return (
                <CategoryTile
                  key={c.key}
                  iconName={c.iconName}
                  label={t(`feedback.cat_${c.key}`)}
                  selected={selected}
                  onPress={() => setCategory(c.key)}
                />
              );
            })}
          </View>

          <Text style={[styles.label, { marginTop: spacing.lg }]}>
            {t('feedback.message')}
          </Text>
          <TextInput
            style={styles.textarea}
            placeholder={t(`feedback.placeholder_${category}`)}
            placeholderTextColor={colors.textSubtle}
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={6}
            editable={!submitting}
            textAlignVertical="top"
          />

          <Text style={styles.metaLabel}>{t('feedback.attached')}</Text>
          <Card style={styles.metaCard}>
            <MetaLine label={t('feedback.account')} value={user?.email || '—'} />
            <MetaLine label={t('feedback.version')} value={APP_VERSION} />
            <MetaLine
              label={t('feedback.platform')}
              value={
                getDeviceModel()
                  ? `${getDeviceModel()} · ${Platform.OS} ${getPlatformVersion()}`
                  : `${Platform.OS} ${getPlatformVersion()}`
              }
            />
            <MetaLine label={t('feedback.language')} value={locale} />
          </Card>

          <PrimaryButton
            title={t('feedback.send')}
            icon={<Icon name="send-outline" size={16} color={colors.surface} />}
            onPress={submit}
            loading={submitting}
            style={{ marginTop: spacing.xl }}
          />
          <View style={{ height: spacing.xxxl }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
};

const CategoryTile = ({ iconName, label, selected, onPress }) => (
  <View style={styles.tileWrap}>
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[styles.tile, selected && styles.tileSelected]}
    >
      <View
        style={[
          styles.tileIconWrap,
          selected && styles.tileIconWrapSelected,
        ]}
      >
        <Icon
          name={iconName}
          size={22}
          color={selected ? colors.surface : colors.primary}
        />
      </View>
      <Text style={[styles.tileLabel, selected && styles.tileLabelSelected]}>
        {label}
      </Text>
    </TouchableOpacity>
  </View>
);

const MetaLine = ({ label, value }) => (
  <View style={styles.metaRow}>
    <Text style={styles.metaKey}>{label}</Text>
    <Text style={styles.metaValue} numberOfLines={1}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  intro: {
    ...typography.body,
    color: colors.textMuted,
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  label: {
    ...typography.label,
    color: colors.textMuted,
    marginBottom: 8,
  },

  // Category tiles — 2x2 grid
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  tileWrap: {
    width: '50%',
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  tile: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 64,
  },
  tileSelected: {
    borderColor: colors.primary,
    backgroundColor: '#ECFEFF',
  },
  tileIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: '#ECFEFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileIconWrapSelected: {
    backgroundColor: colors.primary,
  },
  tileLabel: {
    ...typography.bodyStrong,
    color: colors.text,
    flex: 1,
  },
  tileLabelSelected: {
    color: colors.primaryDark,
  },

  // Textarea
  textarea: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
    minHeight: 140,
  },

  // Meta block
  metaLabel: {
    ...typography.label,
    color: colors.textMuted,
    marginTop: spacing.lg,
    marginBottom: 8,
  },
  metaCard: {
    paddingVertical: 6,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 12,
  },
  metaKey: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
  metaValue: {
    ...typography.bodySmall,
    color: colors.text,
    flexShrink: 1,
  },
});

export default FeedbackScreen;
