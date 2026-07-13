import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
} from 'react-native';
import { colors, radii, spacing, typography } from '../../theme';
import Icon from './Icon';
import { useLanguage } from '../../i18n';

const UNITS = ['pcs', 'kg', 'g', 'lbs', 'oz', 'portions'];

// "How much" control: a connected -/+ stepper for the quantity paired with a
// tap-to-open unit dropdown, reading as a single "Amount" unit. Replaces the
// old lonely number box + wrapping row of unit pills, which felt loose.
const AmountField = ({ quantity, setQuantity, unit, setUnit, disabled }) => {
  const { t } = useLanguage();
  const [pickerVisible, setPickerVisible] = useState(false);

  // Nudge the quantity with the -/+ buttons, never dropping below 1.
  const adjustQty = (delta) => {
    const next = Math.max(1, (parseInt(quantity, 10) || 1) + delta);
    setQuantity(String(next));
  };

  return (
    <View>
      <Text style={styles.label}>{t('addItem.amount')}</Text>
      <View style={styles.row}>
        <View style={styles.stepGroup}>
          <TouchableOpacity
            style={styles.stepBtn}
            onPress={() => adjustQty(-1)}
            disabled={disabled}
            activeOpacity={0.7}
            accessibilityLabel="Decrease quantity"
          >
            <Icon name="remove-outline" size={22} color={colors.primary} />
          </TouchableOpacity>
          <TextInput
            style={styles.stepVal}
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="number-pad"
            editable={!disabled}
            textAlign="center"
            placeholder="1"
            placeholderTextColor={colors.textSubtle}
          />
          <TouchableOpacity
            style={styles.stepBtn}
            onPress={() => adjustQty(1)}
            disabled={disabled}
            activeOpacity={0.7}
            accessibilityLabel="Increase quantity"
          >
            <Icon name="add-outline" size={22} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.dropdown}
          onPress={() => setPickerVisible(true)}
          disabled={disabled}
          activeOpacity={0.7}
        >
          <Text style={styles.dropdownText}>{unit}</Text>
          <Icon name="chevron-down" size={16} color={colors.textSubtle} />
        </TouchableOpacity>
      </View>

      <Modal
        visible={pickerVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setPickerVisible(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setPickerVisible(false)}>
          <Pressable style={styles.sheet}>
            <Text style={styles.sheetTitle}>{t('addItem.selectUnit')}</Text>
            {UNITS.map((u, i) => {
              const on = u === unit;
              return (
                <TouchableOpacity
                  key={u}
                  style={[styles.optRow, i === UNITS.length - 1 && styles.optRowLast]}
                  onPress={() => {
                    setUnit(u);
                    setPickerVisible(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.optText, on && styles.optTextOn]}>{u}</Text>
                  {on ? <Icon name="checkmark" size={20} color={colors.primary} /> : null}
                </TouchableOpacity>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  label: {
    ...typography.label,
    color: colors.textMuted,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stepGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.bg,
    overflow: 'hidden',
  },
  stepBtn: {
    width: 46,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepVal: {
    width: 52,
    height: 48,
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.border,
    padding: 0,
  },
  dropdown: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.bg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
  },
  dropdownText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
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
  sheetTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  optRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optRowLast: {
    borderBottomWidth: 0,
  },
  optText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  optTextOn: {
    color: colors.primary,
  },
});

export default AmountField;
