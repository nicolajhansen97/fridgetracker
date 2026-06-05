import React from 'react';
import { Text, TouchableOpacity, StyleSheet, View } from 'react-native';
import { colors, radii, typography } from '../../theme';

// A selectable chip / filter pill. When `selected`, fills with a solid graphite
// surface (clean, iOS-style) — neutral so it doesn't compete with the teal
// brand accent reserved for primary actions.
// `icon` may be a string (rendered as <Text>, used for emoji symbols like flags
// or user-customized drawer icons) or any React node (e.g. an <Icon /> element).
const renderIcon = (icon, selected) => {
  if (!icon) return null;
  if (typeof icon === 'string') {
    return (
      <Text style={[styles.iconText, selected && styles.iconTextOn]}>{icon}</Text>
    );
  }
  return <View style={styles.iconWrap}>{icon}</View>;
};

const Pill = ({ label, icon, selected, onPress, style, disabled }) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      style={[styles.pill, selected ? styles.pillOn : styles.pillOff, style]}
    >
      {renderIcon(icon, selected)}
      <Text style={[styles.label, selected && styles.labelOn]}>{label}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radii.pill,
  },
  pillOn: {
    backgroundColor: colors.text,
  },
  pillOff: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconWrap: {
    marginRight: 6,
  },
  iconText: {
    fontSize: 14,
    marginRight: 6,
    color: colors.textMuted,
  },
  iconTextOn: {
    color: colors.surface,
  },
  label: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.textMuted,
  },
  labelOn: {
    color: colors.surface,
  },
});

export default Pill;
