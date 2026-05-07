import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme';

// Screen wrapper that provides the bg color and safe area handling.
const Screen = ({ children, style, edges }) => {
  return (
    <SafeAreaView style={[styles.container, style]} edges={edges}>
      {children}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
});

export default Screen;
