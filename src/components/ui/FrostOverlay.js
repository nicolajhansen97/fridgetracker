import React from 'react';
import { View, StyleSheet } from 'react-native';
import Icon from './Icon';

// The snowflake texture that sits behind the hero gradient on full-screen
// branded screens (login, register, forgot password, lock).
//
// This was the same four-element block copy-pasted into four files, with its
// own four opacity literals each time. Tuning the frost meant editing it in
// four places and hoping they stayed in step, which is exactly how the rest of
// the palette drifted.
//
// Sizes and opacities live here rather than in the theme because they are not
// a scale anyone else should reach for - they are this one effect's internals.
// Oversized, placed off-centre and bled off the edges so the flakes read as
// atmosphere rather than as decoration sitting on top of the content.
const FrostOverlay = () => (
  <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    <Icon name="snow" size={260} color="rgba(255,255,255,0.09)" style={styles.one} />
    <Icon name="snow" size={150} color="rgba(255,255,255,0.07)" style={styles.two} />
    <Icon name="snow" size={90} color="rgba(255,255,255,0.08)" style={styles.three} />
    <Icon name="snow" size={58} color="rgba(255,255,255,0.06)" style={styles.four} />
  </View>
);

const styles = StyleSheet.create({
  one: { position: 'absolute', top: -70, right: -80 },
  two: { position: 'absolute', bottom: -30, left: -50 },
  three: { position: 'absolute', top: '32%', left: -28 },
  four: { position: 'absolute', top: '12%', left: '38%' },
});

export default FrostOverlay;
