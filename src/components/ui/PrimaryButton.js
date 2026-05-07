import React from 'react';
import { Text, TouchableOpacity, StyleSheet, ActivityIndicator, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients, radii, shadows, typography } from '../../theme';

const PrimaryButton = ({ title, onPress, loading, disabled, style, fullWidth = true, icon }) => {
  const inactive = loading || disabled;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={inactive}
      activeOpacity={0.85}
      style={[fullWidth && { alignSelf: 'stretch' }, style]}
    >
      <LinearGradient
        colors={gradients.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.button, inactive && styles.disabled]}
      >
        {loading ? (
          <ActivityIndicator color={colors.surface} />
        ) : (
          <View style={styles.content}>
            {icon
              ? typeof icon === 'string'
                ? <Text style={styles.icon}>{icon}</Text>
                : icon
              : null}
            <Text style={styles.text}>{title}</Text>
          </View>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: radii.md,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.button,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  icon: {
    fontSize: 16,
  },
  text: {
    ...typography.button,
    color: colors.surface,
  },
  disabled: {
    opacity: 0.6,
  },
});

export default PrimaryButton;
