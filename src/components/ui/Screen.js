import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme';

// Default edges intentionally exclude 'top' so that gradient headers can
// extend all the way behind the status bar. Headers themselves add
// `insets.top` to their internal padding so their content still sits below
// the notch.
const DEFAULT_EDGES = ['left', 'right', 'bottom'];

const Screen = ({ children, style, edges = DEFAULT_EDGES }) => {
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
