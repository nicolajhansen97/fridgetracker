import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors, radii, shadows, spacing } from '../../theme';

const Card = ({ children, style, padded = true, ...rest }) => {
  return (
    <View style={[styles.card, padded && styles.padded, style]} {...rest}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  padded: {
    padding: spacing.lg,
  },
});

export default Card;
