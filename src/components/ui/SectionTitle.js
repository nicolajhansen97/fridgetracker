import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../../theme';

const SectionTitle = ({ children, icon, action, style }) => {
  return (
    <View style={[styles.row, style]}>
      <View style={styles.titleWrap}>
        {icon ? <View style={styles.icon}>{icon}</View> : null}
        <Text style={styles.text}>{children}</Text>
      </View>
      {action ? <View>{action}</View> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  icon: {
    marginRight: 6,
  },
  text: {
    ...typography.label,
    color: colors.textMuted,
    flexShrink: 1,
  },
});

export default SectionTitle;
