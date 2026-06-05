import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../i18n';
import Icon from './ui/Icon';
import { colors, radii, spacing, typography } from '../theme';

// Bottom-sheet for acting on a freezer item. Three outcomes:
//   - Used it      → fully consumed (caller removes the item)
//   - Partially used → asks how much is left, then reduces the quantity
//   - Throw away   → wasted (caller removes the item)
// A custom sheet (not Alert) because Android alerts cap at 3 buttons.
const ActionRow = ({ icon, color, label, onPress }) => (
  <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
    <View style={[styles.rowIcon, { backgroundColor: color + '1A' }]}>
      <Icon name={icon} size={20} color={color} />
    </View>
    <Text style={styles.rowLabel}>{label}</Text>
  </TouchableOpacity>
);

const ItemActionSheet = ({ visible, item, onClose, onUse, onThrow, onPartial }) => {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState('actions'); // 'actions' | 'partial'
  const [val, setVal] = useState('');

  useEffect(() => {
    if (visible) {
      setMode('actions');
      setVal(item?.quantity != null ? String(item.quantity) : '');
    }
  }, [visible, item]);

  const current = Number(item?.quantity) || 0;
  const remaining = Math.max(0, Number(String(val).replace(',', '.')) || 0);
  const unitSuffix = item?.unit ? ` ${item.unit}` : '';
  // Only meaningful if they actually used some (new amount is below the old one).
  const canSave = val !== '' && remaining < current;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}
          onPress={() => {}}
        >
          <View style={styles.handle} />
          <Text style={styles.title} numberOfLines={1}>{item?.name}</Text>

          {mode === 'actions' ? (
            <>
              <ActionRow
                icon="checkmark-circle-outline"
                color={colors.success}
                label={t('inventory.useItem')}
                onPress={onUse}
              />
              <ActionRow
                icon="pie-chart-outline"
                color={colors.primary}
                label={t('inventory.partiallyUsed')}
                onPress={() => setMode('partial')}
              />
              <ActionRow
                icon="trash-outline"
                color={colors.danger}
                label={t('inventory.throwAway')}
                onPress={onThrow}
              />
              <TouchableOpacity style={styles.cancel} onPress={onClose} activeOpacity={0.7}>
                <Text style={styles.cancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.prompt}>{t('inventory.howMuchLeft')}</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  value={val}
                  onChangeText={setVal}
                  keyboardType="numeric"
                  autoFocus
                  selectTextOnFocus
                  placeholder="0"
                  placeholderTextColor={colors.textSubtle}
                />
                {item?.unit ? <Text style={styles.unit}>{item.unit}</Text> : null}
              </View>
              {current > 0 ? (
                <Text style={styles.hint}>
                  {canSave
                    ? t('inventory.wasUsed', {
                        was: `${current}${unitSuffix}`,
                        used: `${current - remaining}${unitSuffix}`,
                      })
                    : t('inventory.wasAmount', { amount: `${current}${unitSuffix}` })}
                </Text>
              ) : null}
              <View style={styles.btnRow}>
                <TouchableOpacity style={styles.secondary} onPress={() => setMode('actions')} activeOpacity={0.7}>
                  <Text style={styles.secondaryText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.primary, !canSave && styles.primaryDisabled]}
                  disabled={!canSave}
                  onPress={() => onPartial?.(remaining)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.primaryText}>{t('common.save')}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </Pressable>
      </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 14,
  },
  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    ...typography.bodyStrong,
    fontSize: 17,
    color: colors.text,
  },
  cancel: {
    marginTop: spacing.sm,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  cancelText: {
    ...typography.button,
    color: colors.textMuted,
  },
  prompt: {
    ...typography.body,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
  },
  input: {
    flex: 1,
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    paddingVertical: 14,
  },
  unit: {
    ...typography.bodyStrong,
    color: colors.textMuted,
  },
  hint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  btnRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  secondary: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
  },
  secondaryText: {
    ...typography.button,
    color: colors.text,
  },
  primary: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  primaryDisabled: {
    opacity: 0.4,
  },
  primaryText: {
    ...typography.button,
    color: colors.surface,
  },
});

export default ItemActionSheet;
