import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, radii, spacing, typography } from '../../theme';
import Icon from './Icon';
import { useLanguage } from '../../i18n';
import { findCurrency } from '../../utils/currency';

// "What did it cost" control, deliberately optional.
//
// The whole money feature only works if this is cheap to skip: an item with no
// price is not a gap to be filled in, it just doesn't count toward any total.
// So the label says optional, the placeholder is empty rather than "0", and
// there is no validation shouting at anyone who leaves it alone.
//
// `remembered` is the price we pre-filled from the last time this item was
// bought. Showing where it came from (and a one-tap way to take it) is the
// difference between a helpful suggestion and a number that mysteriously
// appears in a field the user did not type in.
const PriceField = ({
  value,
  onChangeText,
  remembered,
  onUseRemembered,
  quantity,
  disabled,
}) => {
  const { t, currency, formatMoney } = useLanguage();
  const cur = findCurrency(currency);

  const showSuggestion =
    remembered !== null && remembered !== undefined && !String(value || '').trim();

  const qty = Number(quantity);
  const showEach = isFinite(qty) && qty > 1;

  return (
    <View>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{t('addItem.price')}</Text>
        <Text style={styles.optional}>{t('common.optional')}</Text>
      </View>

      <View style={styles.inputRow}>
        {cur.position === 'before' ? (
          <Text style={styles.affix}>{cur.symbol}</Text>
        ) : null}
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          keyboardType="decimal-pad"
          editable={!disabled}
          placeholder=""
          placeholderTextColor={colors.textSubtle}
        />
        {cur.position === 'after' ? (
          <Text style={styles.affix}>{cur.symbol}</Text>
        ) : null}
      </View>

      {showSuggestion ? (
        <TouchableOpacity
          style={styles.suggestion}
          onPress={() => onUseRemembered && onUseRemembered(remembered)}
          disabled={disabled}
          activeOpacity={0.7}
        >
          <Icon name="refresh-outline" size={14} color={colors.primary} />
          <Text style={styles.suggestionText}>
            {t('addItem.priceRemembered', { price: formatMoney(remembered) })}
          </Text>
        </TouchableOpacity>
      ) : showEach && Number(value) > 0 ? (
        <Text style={styles.hint}>
          {t('addItem.priceEach', {
            price: formatMoney(Number(value) / qty),
            count: qty,
          })}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  label: {
    ...typography.label,
    color: colors.textMuted,
  },
  optional: {
    ...typography.label,
    color: colors.textSubtle,
    textTransform: 'none',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.bg,
    paddingHorizontal: 14,
    gap: spacing.xs,
  },
  affix: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textMuted,
  },
  input: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    padding: 0,
  },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  suggestionText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  hint: {
    fontSize: 12,
    color: colors.textSubtle,
    marginTop: 8,
  },
});

export default PriceField;
