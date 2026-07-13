import React from 'react';
import { Text, TouchableOpacity, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients, radii, typography } from '../../theme';

// A selectable chip / filter pill. When `selected`, fills with the teal->blue
// hero gradient so the choice reads as clearly "on" and stays on-brand with the
// rest of the app (headers, primary buttons) instead of a heavy graphite block.
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
  const content = (
    <>
      {renderIcon(icon, selected)}
      <Text style={[styles.label, selected && styles.labelOn]}>{label}</Text>
    </>
  );

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      style={style}
    >
      {selected ? (
        <LinearGradient
          colors={gradients.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.pill}
        >
          {content}
        </LinearGradient>
      ) : (
        <View style={[styles.pill, styles.pillOff]}>{content}</View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radii.pill,
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
    fontWeight: '700',
  },
});

export default Pill;
