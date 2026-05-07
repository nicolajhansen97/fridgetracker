import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import Icon from './Icon';
import { colors, radii } from '../../theme';

// Variants:
//  - 'onHero' (default): translucent white, used on top of the gradient header
//  - 'surface':  light gray bg, used on white/bg surfaces
//  - 'ghost':    transparent, used inline with text
const IconButton = ({ name, onPress, variant = 'onHero', size = 36, accessibilityLabel, disabled, set = 'ion' }) => {
  const tint =
    variant === 'onHero' ? colors.surface
      : variant === 'surface' ? colors.text
      : colors.textMuted;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.base,
        { width: size, height: size, borderRadius: radii.sm + 2 },
        variant === 'onHero' && styles.onHero,
        variant === 'surface' && styles.surface,
        variant === 'ghost' && styles.ghost,
        disabled && styles.disabled,
      ]}
    >
      <Icon name={name} size={Math.round(size * 0.5)} color={tint} set={set} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  onHero: {
    backgroundColor: colors.whiteAlpha20,
  },
  surface: {
    backgroundColor: colors.surfaceMuted,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  disabled: {
    opacity: 0.5,
  },
});

export default IconButton;
