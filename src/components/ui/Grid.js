import React, { Children } from 'react';
import { View, StyleSheet } from 'react-native';
import { spacing } from '../../theme';

// Lays children out in rows of `columns` equal cells. With columns=1 it is a
// plain stack, so screens can always render <Grid columns={columns}> and let
// useAdaptiveLayout decide. Rows are chunked explicitly (rather than
// flexWrap + percentages) so cells are exactly equal and an odd last item
// keeps its column width instead of stretching across the fold.
// `rowGap` defaults to `gap`; pass rowGap={0} when the children already carry
// their own bottom margin (list cards), so spacing matches the 1-column stack.
const Grid = ({ columns = 1, gap = spacing.md, rowGap = gap, children, style }) => {
  const items = Children.toArray(children).filter(Boolean);
  if (columns <= 1) return <View style={style}>{items}</View>;

  const rows = [];
  for (let i = 0; i < items.length; i += columns) rows.push(items.slice(i, i + columns));

  return (
    <View style={[{ gap: rowGap }, style]}>
      {rows.map((row, r) => (
        <View key={r} style={[styles.row, { gap }]}>
          {Array.from({ length: columns }, (_, c) => (
            <View key={c} style={styles.cell}>{row[c] || null}</View>
          ))}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'stretch' },
  cell: { flex: 1, minWidth: 0 },
});

export default Grid;
