import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radii } from '../../theme';

// Small inline badge for metadata (quantity, position, expiry).
// Tone variants: 'default', 'primary', 'warning', 'danger', 'success', 'info'.
const tones = {
  default: { bg: colors.surfaceMuted, fg: colors.textMuted },
  primary: { bg: '#CCFBF1', fg: '#0F766E' },     // teal-100 / teal-700
  warning: { bg: colors.warningSoft, fg: '#92400E' },
  danger:  { bg: colors.dangerSoft, fg: '#991B1B' },
  success: { bg: colors.successSoft, fg: '#065F46' },
  info:    { bg: colors.infoSoft, fg: '#075985' },
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
