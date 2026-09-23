import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable } from 'react-native';
import { colors, radii, spacing, typography } from '../../theme';
import Icon from './Icon';

// Bottom-sheet picker for a single choice out of a short list. Settings rows
// show only their current value and open this on tap, which keeps a five-option
// setting one line tall instead of five chips wide.
//
// `options`: [{ value, label, hint, icon }]. As with Pill, `icon` may be a
// string (rendered as text, for emoji like flags) or any React node such as an
// <Icon />; `hint` is optional secondary text.
const OptionSheet = ({ visible, title, help, options = [], value, onSelect, onClose }) => (
  <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
    <Pressable style={styles.backdrop} onPress={onClose}>
      <Pressable style={styles.sheet}>
        {title ? <Text style={styles.title}>{title}</Text> : null}
        {help ? <Text style={styles.help}>{help}</Text> : null}
        {options.map((opt, i) => {
          const selected = opt.value === value;
          return (
            <TouchableOpacity
              key={opt.value}
              style={[styles.row, i > 0 && styles.rowDivided]}
              activeOpacity={0.7}
              onPress={() => onSelect(opt.value)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              {opt.icon ? (
                <View style={styles.iconWrap}>
                  {typeof opt.icon === 'string' ? <Text style={styles.emoji}>{opt.icon}</Text> : opt.icon}
                </View>
              ) : null}
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, selected && styles.labelOn]} numberOfLines={1}>{opt.label}</Text>
                {opt.hint ? <Text style={styles.hint} numberOfLines={1}>{opt.hint}</Text> : null}
              </View>
              {selected ? <Icon name="checkmark" size={20} color={colors.primary} /> : null}
            </TouchableOpacity>
          );
        })}
      </Pressable>
    </Pressable>
  </Modal>
);

const styles = StyleSheet.create({
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
  title: {
    ...typography.h3,
    color: colors.text,
  },
  help: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 12,
  },
  rowDivided: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  iconWrap: {
    width: 22,
    alignItems: 'center',
  },
  emoji: {
    fontSize: 17,
  },
  label: {
    ...typography.body,
    color: colors.text,
  },
  labelOn: {
    color: colors.primary,
    fontWeight: '700',
  },
  hint: {
    ...typography.caption,
    color: colors.textSubtle,
    marginTop: 1,
  },
});

export default OptionSheet;
