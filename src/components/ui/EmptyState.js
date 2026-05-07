import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from './Icon';
import { colors, spacing, typography } from '../../theme';

// `icon` may be:
//   - a string: Ionicons name (e.g. "snow-outline")
//   - an object: { name, set, color } for explicit set selection
//   - a React node: rendered as-is
const renderIcon = (icon) => {
  if (!icon) return null;
  if (React.isValidElement(icon)) return icon;
  if (typeof icon === 'string') {
    return <Icon name={icon} size={40} color={colors.primary} />;
  }
  if (typeof icon === 'object') {
    return <Icon {...icon} size={icon.size || 40} color={icon.color || colors.primary} />;
  }
  return null;
};

const EmptyState = ({ icon, title, description, action }) => {
  return (
    <View style={styles.container}>
      {icon ? <View style={styles.iconWrap}>{renderIcon(icon)}</View> : null}
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: spacing.xxl,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#ECFEFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  description: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  action: {
    marginTop: spacing.xl,
    alignSelf: 'stretch',
  },
});

export default EmptyState;
