import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients, radii, spacing, typography } from '../../theme';

const ScreenHeader = ({ title, subtitle, onBack, right, backLabel }) => {
  return (
    <LinearGradient
      colors={gradients.hero}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <View style={styles.row}>
        <View style={styles.side}>
          {onBack ? (
            <TouchableOpacity onPress={onBack} hitSlop={8} style={styles.backBtn}>
              <Text style={styles.backText}>{'←'}{backLabel ? `  ${backLabel}` : ''}</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.center}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
        </View>

        <View style={[styles.side, styles.sideRight]}>{right}</View>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
    borderBottomLeftRadius: radii.header,
    borderBottomRightRadius: radii.header,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 36,
  },
  side: {
    minWidth: 64,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sideRight: {
    justifyContent: 'flex-end',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  backBtn: {
    paddingVertical: 6,
    paddingRight: 6,
  },
  backText: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: '600',
  },
  title: {
    ...typography.h3,
    color: colors.surface,
  },
  subtitle: {
    color: colors.whiteAlpha80,
    fontSize: 12,
    marginTop: 2,
  },
});

export default ScreenHeader;
