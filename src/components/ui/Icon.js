import React from 'react';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../theme';

// Single icon component used app-wide. Default set is Ionicons.
// For food/category icons, pass set="mci" to use MaterialCommunityIcons.
const SETS = {
  ion: Ionicons,
  mci: MaterialCommunityIcons,
};

const Icon = ({ name, size = 20, color = colors.text, set = 'ion', style }) => {
  const IconSet = SETS[set] || Ionicons;
  return <IconSet name={name} size={size} color={color} style={style} />;
};

export default Icon;
