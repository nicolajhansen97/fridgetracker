import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { colors, radii, spacing, typography } from '../../theme';
import Icon from './Icon';
import { useLanguage } from '../../i18n';
import { useCustomUnits } from '../../hooks/useCustomUnits';

const UNITS = ['pcs', 'kg', 'g', 'lbs', 'oz', 'portions'];

// Matches the length check on public.custom_units.
const MAX_UNIT_LENGTH = 15;

const sameUnit = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

// "How much" control: a connected -/+ stepper for the quantity paired with a
// tap-to-open unit dropdown, reading as a single "Amount" unit. Replaces the
// old lonely number box + wrapping row of unit pills, which felt loose.
const AmountField = ({ quantity, setQuantity, unit, setUnit, disabled }) => {
  const { t } = useLanguage();
  const [pickerVisible, setPickerVisible] = useState(false);
  const { units: customUnits, addUnit, removeUnit } = useCustomUnits();
  const [adding, setAdding] = useState(false);
  const [newUnit, setNewUnit] = useState('');

  // An item can carry a unit that isn't in the list (it was removed, or set
  // before the list was shared). Still list it so it shows as selected and
  // can be kept.
  const options = [...UNITS, ...customUnits.map((c) => c.name)];
  if (unit && !options.some((u) => sameUnit(u, unit))) options.push(unit);

  const closePicker = () => {
    setPickerVisible(false);
    setAdding(false);
    setNewUnit('');
  };

  const pick = (u) => {
    setUnit(u);
    closePicker();
  };

  const addCustomUnit = () => {
    const u = newUnit.trim().slice(0, MAX_UNIT_LENGTH);
    if (!u) return;
    // Re-adding an existing unit just selects it.
    const existing = options.find((o) => sameUnit(o, u));
    if (!existing) addUnit(u);
    pick(existing || u);
  };

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
        onRequestClose={closePicker}
      >
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.backdrop} onPress={closePicker}>
            <Pressable style={styles.sheet}>
              <Text style={styles.sheetTitle}>{t('addItem.selectUnit')}</Text>
              <ScrollView style={styles.optList} keyboardShouldPersistTaps="handled">
                {options.map((u) => {
                  const on = sameUnit(u, unit || '');
                  const custom = customUnits.find((c) => c.name === u);
                  return (
                    <TouchableOpacity
                      key={u}
                      style={styles.optRow}
                      onPress={() => pick(u)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.optText, on && styles.optTextOn]}>{u}</Text>
                      <View style={styles.optRight}>
                        {on ? <Icon name="checkmark" size={20} color={colors.primary} /> : null}
                        {custom ? (
                          <TouchableOpacity
                            onPress={() => removeUnit(custom)}
                            hitSlop={10}
                            accessibilityLabel={t('addItem.removeUnit', { unit: u })}
                          >
                            <Icon name="close-circle" size={20} color={colors.textSubtle} />
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {adding ? (
                <View style={styles.addRow}>
                  <TextInput
                    style={styles.addInput}
                    value={newUnit}
                    onChangeText={setNewUnit}
                    placeholder={t('addItem.customUnitPlaceholder')}
                    placeholderTextColor={colors.textSubtle}
                    maxLength={MAX_UNIT_LENGTH}
                    autoFocus
                    autoCapitalize="none"
                    returnKeyType="done"
                    onSubmitEditing={addCustomUnit}
                  />
                  <TouchableOpacity
                    style={[styles.addBtn, !newUnit.trim() && styles.addBtnDisabled]}
                    onPress={addCustomUnit}
                    disabled={!newUnit.trim()}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.addBtnText}>{t('addItem.addUnit')}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.addTrigger}
                  onPress={() => setAdding(true)}
                  activeOpacity={0.7}
                >
                  <Icon name="add-circle-outline" size={20} color={colors.primary} />
                  <Text style={styles.addTriggerText}>{t('addItem.addCustomUnit')}</Text>
                </TouchableOpacity>
              )}
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
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
  optText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  optTextOn: {
    color: colors.primary,
  },
  flex: { flex: 1 },
  // Room for ~7 rows; a long custom list scrolls instead of pushing the
  // "add" row off screen.
  optList: { maxHeight: 360 },
  optRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  addTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  addTriggerText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
  addInput: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.bg,
    paddingHorizontal: 14,
    fontSize: 16,
    color: colors.text,
  },
  addBtn: {
    height: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnDisabled: {
    opacity: 0.5,
  },
  addBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.surface,
  },
});

export default AmountField;
