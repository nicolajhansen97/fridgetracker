import React from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, radii, typography } from '../../theme';

const SecondaryButton = ({ title, onPress, disabled, style, danger }) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      style={[
        styles.button,
        danger && styles.danger,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text style={[styles.text, danger && styles.dangerText]}>{title}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: radii.md,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  text: {
    ...typography.button,
    color: colors.text,
  },
  danger: {
    borderColor: colors.danger,
    backgroundColor: 'transparent',
  },
  dangerText: {
    color: colors.danger,
  },
  disabled: {
    opacity: 0.5,
  },
});

export default SecondaryButton;
