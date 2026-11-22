import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { layout } from '../theme';

// Live window-size classification. Uses useWindowDimensions (not
// Dimensions.get at module load), so folding/unfolding an iPhone Duo or
// resizing the window re-renders with the new layout without a relaunch.
//
//   isRegular  - wide enough for two columns (Duo inner screen, iPad, landscape)
//   columns    - 1 or 2; use with <Grid columns={columns}>
//   frame      - style for a ScrollView contentContainerStyle: caps the content
//                width and centres it, keeping the screen's own padding
export default function useAdaptiveLayout() {
  const { width, height } = useWindowDimensions();

  return useMemo(() => {
    // Regular needs room both ways — roughly UIKit's regular/regular size
    // class. Width alone would put the Duo's outer screen in landscape
    // (~678x466pt, compact per Apple) and phones in landscape into two
    // columns with barely three rows of height.
    const isRegular = width >= layout.regularWidth && height >= layout.regularHeight;
    // Wide enough for side-by-side panes (Duo inner landscape ~950pt, iPad);
    // inner portrait (~626pt) stays stacked.
    const isExpanded = isRegular && width >= layout.expandedWidth;
    const maxWidth = isRegular ? layout.wideWidth : layout.readableWidth;
    return {
      width,
      height,
      isRegular,
      isExpanded,
      isLandscape: width > height,
      columns: isRegular ? 2 : 1,
      frame: { width: '100%', maxWidth, alignSelf: 'center' },
    };
  }, [width, height]);
}
