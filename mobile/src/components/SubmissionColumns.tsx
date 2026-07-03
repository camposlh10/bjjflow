import { View } from 'react-native';
import { Text } from 'react-native-paper';

import { makeStyles, palette } from '../theme/theme';

export type ColumnItem = { label: string; value: number; color?: string };

/** A vertical column chart (workout-stats style): one colored bar per finish, value
 *  on top, label below. Clear at-a-glance read — replaces the old radar. */
export default function SubmissionColumns({ items, height = 168 }: { items: ColumnItem[]; height?: number }) {
  const data = items.filter((i) => i.value > 0).sort((a, b) => b.value - a.value);
  const peak = Math.max(1, ...data.map((i) => i.value));

  if (data.length === 0) {
    return null;
  }

  const barMax = height - 40; // room for the value label on top

  return (
    <View style={styles.wrap}>
      <View style={[styles.plot, { height }]}>
        {data.map((it, i) => (
          <View key={i} style={styles.col}>
            <Text style={styles.value}>{it.value}</Text>
            <View
              style={[styles.bar, { height: Math.max(6, (it.value / peak) * barMax), backgroundColor: it.color ?? palette.primary }]}
            />
          </View>
        ))}
      </View>
      <View style={styles.labelRow}>
        {data.map((it, i) => (
          <Text key={i} style={styles.label} numberOfLines={1}>
            {it.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = makeStyles(() => ({
  wrap: { marginBottom: 8 },
  plot: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', gap: 6, borderBottomWidth: 1, borderBottomColor: palette.surfaceVariant },
  col: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  value: { color: palette.textPrimary, fontSize: 13, fontWeight: '800', marginBottom: 4 },
  bar: { width: '62%', minWidth: 12, borderTopLeftRadius: 6, borderTopRightRadius: 6 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-around', gap: 6, marginTop: 6 },
  label: { color: palette.textSecondary, fontSize: 9, flex: 1, textAlign: 'center' },
}));
