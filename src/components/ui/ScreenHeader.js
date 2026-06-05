import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from './Icon';
import { colors, gradients, radii, spacing, typography } from '../../theme';

// Brand header: teal->blue gradient with a centered title. Equal-width side
// slots keep the title optically centered whether or not a back chevron / right
// action is present. Back only appears on pushed screens (when onBack is given).
const ScreenHeader = ({ title, subtitle, onBack, right, backLabel }) => {
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient
      colors={gradients.hero}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.container, { paddingTop: insets.top + spacing.sm }]}
    >
      {/* Snowfrost — faint brand texture */}
      <Icon name="snow" size={118} color="rgba(255,255,255,0.10)" style={styles.snowBig} />
      <Icon name="snow" size={52} color="rgba(255,255,255,0.08)" style={styles.snowSmall} />

      <View style={styles.row}>
        <View style={styles.side}>
          {onBack ? (
            <TouchableOpacity
              onPress={onBack}
              hitSlop={10}
              style={styles.backBtn}
              accessibilityRole="button"
              accessibilityLabel={backLabel || 'Go back'}
            >
              <Icon name="chevron-back" size={24} color={colors.surface} />
              {backLabel ? <Text style={styles.backText} numberOfLines={1}>{backLabel}</Text> : null}
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
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomLeftRadius: radii.lg,
    borderBottomRightRadius: radii.lg,
    overflow: 'hidden',
  },
  snowBig: {
    position: 'absolute',
    right: -16,
    top: -10,
  },
  snowSmall: {
    position: 'absolute',
    right: 66,
    bottom: -12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
  },
  side: {
    width: 76,
    justifyContent: 'center',
  },
  sideRight: {
    alignItems: 'flex-end',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: -4,
  },
  backText: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.2,
    color: colors.surface,
    textAlign: 'center',
  },
  subtitle: {
    color: colors.whiteAlpha80,
    fontSize: 12,
    marginTop: 2,
    textAlign: 'center',
  },
});

export default ScreenHeader;
