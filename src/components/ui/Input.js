import React, { forwardRef } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { colors, radii, typography } from '../../theme';

// Form input with optional label and helper text. Pass `multiline` for textarea behavior.
const Input = forwardRef(({ label, helper, error, style, inputStyle, ...inputProps }, ref) => {
  return (
    <View style={style}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        ref={ref}
        placeholderTextColor={colors.textSubtle}
        style={[
          styles.input,
          inputProps.multiline && styles.multiline,
          error && styles.inputError,
          inputStyle,
        ]}
        {...inputProps}
      />
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : helper ? (
        <Text style={styles.helper}>{helper}</Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  label: {
    ...typography.label,
    color: colors.textMuted,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    color: colors.text,
  },
  multiline: {
    minHeight: 96,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: colors.danger,
  },
  helper: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 6,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
    marginTop: 6,
  },
});

export default Input;
