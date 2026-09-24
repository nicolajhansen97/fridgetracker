import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radii } from '../../theme';

// Small inline badge for metadata (quantity, position, expiry).
// Tone variants: 'default', 'primary', 'warning', 'danger', 'success', 'info'.
const tones = {
  default: { bg: colors.surfaceMuted, fg: colors.textMuted },
  primary: { bg: colors.primaryTint, fg: colors.primaryText },
  warning: { bg: colors.warningSoft, fg: colors.warningText },
  danger:  { bg: colors.dangerSoft, fg: colors.dangerText },
  success: { bg: colors.successSoft, fg: colors.successText },
  info:    { bg: colors.infoSoft, fg: colors.infoText },
};

const Badge = ({ children, tone = 'default', style }) => {
  const t = tones[tone] || tones.default;
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }, style]}>
      <Text style={[styles.text, { color: t.fg }]}>{children}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.sm,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 11,
    fontWeight: '600',
  },
});

export default Badge;
