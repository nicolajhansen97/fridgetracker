import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Text, TouchableOpacity, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii, spacing } from '../theme';

// A short message that slides up above the tab bar, optionally with one
// action, and leaves by itself.
//
// For suggestions worth offering but not worth stopping someone for. Eating
// something is the most common thing people do in the app; an Alert after it
// would turn a one-tap action into two every time.
//
//   const { showNudge } = useNudge();
//   showNudge({ message, actionLabel, onAction, duration });
//
// A new nudge replaces the current one rather than queueing: by the time a
// second arrives, the first is about something the person has moved past.

const DEFAULT_DURATION_MS = 6000;
// Matches tabBarBaseHeight in AppNavigator, so the bar sits just above it.
const TAB_BAR_HEIGHT = 56;

const NudgeContext = createContext({ showNudge: () => {}, hideNudge: () => {} });

export const NudgeProvider = ({ children }) => {
  const insets = useSafeAreaInsets();
  const [nudge, setNudge] = useState(null);
  const anim = useRef(new Animated.Value(0)).current;
  const timer = useRef(null);

  const hideNudge = useCallback(() => {
    clearTimeout(timer.current);
    Animated.timing(anim, { toValue: 0, duration: 160, useNativeDriver: true }).start(
      ({ finished }) => {
        if (finished) setNudge(null);
      }
    );
  }, [anim]);

  const showNudge = useCallback(
    (next) => {
      clearTimeout(timer.current);
      setNudge(next);
      anim.setValue(0);
      Animated.timing(anim, { toValue: 1, duration: 220, useNativeDriver: true }).start();
      timer.current = setTimeout(hideNudge, next.duration || DEFAULT_DURATION_MS);
    },
    [anim, hideNudge]
  );

  useEffect(() => () => clearTimeout(timer.current), []);

  const runAction = useCallback(async () => {
    const action = nudge?.onAction;
    hideNudge();
    if (action) await action();
  }, [nudge, hideNudge]);

  const value = useMemo(() => ({ showNudge, hideNudge }), [showNudge, hideNudge]);

  return (
    <NudgeContext.Provider value={value}>
      {children}
      {nudge ? (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.wrap,
            {
              bottom: TAB_BAR_HEIGHT + insets.bottom + spacing.sm,
              opacity: anim,
              transform: [
                { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
              ],
            },
          ]}
        >
          <View style={styles.bar} accessibilityLiveRegion="polite">
            <Text style={styles.message} numberOfLines={2}>
              {nudge.message}
            </Text>
            {nudge.actionLabel ? (
              <TouchableOpacity
                onPress={runAction}
                hitSlop={10}
                accessibilityRole="button"
                style={styles.actionBtn}
              >
                <Text style={styles.action}>{nudge.actionLabel}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </Animated.View>
      ) : null}
    </NudgeContext.Provider>
  );
};

export const useNudge = () => useContext(NudgeContext);

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.text,
    borderRadius: radii.lg,
    paddingVertical: 12,
    paddingLeft: spacing.lg,
    paddingRight: spacing.md,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 8,
  },
  message: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.surface,
  },
  actionBtn: {
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  action: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.primaryTint,
  },
});
