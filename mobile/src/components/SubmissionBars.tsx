import { View } from 'react-native';
import { Text } from 'react-native-paper';

import { t } from '../i18n';
import { makeStyles, palette } from '../theme/theme';

export type SubmissionBarItem = { label: string; value: number; color?: string };

/** Ranked horizontal bars of submission counts — a clearer replacement for the
 *  radar/spider chart (sorted high→low, only non-zero finishes shown). */
export default function SubmissionBars({ items, max }: { items: SubmissionBarItem[]; max?: number }) {
  const sorted = items.filter((i) => i.value > 0).sort((a, b) => b.value - a.value);
  const shown = max ? sorted.slice(0, max) : sorted;
  const peak = Math.max(1, ...sorted.map((i) => i.value));

  if (shown.length === 0) {
    return <Text style={styles.empty}>{t('submissions.empty')}</Text>;
  }

  return (
    <View style={styles.wrap}>
      {shown.map((it, i) => (
        <View key={i} style={styles.row}>
          <Text style={styles.label} numberOfLines={1}>{it.label}</Text>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${(it.value / peak) * 100}%`, backgroundColor: it.color ?? palette.primary }]} />
          </View>
          <Text style={styles.count}>{it.value}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = makeStyles(() => ({
  wrap: { gap: 12, alignSelf: 'stretch' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  label: { color: palette.textPrimary, fontSize: 13, fontWeight: '600', width: 96 },
  track: { flex: 1, height: 10, borderRadius: 999, backgroundColor: palette.surfaceVariant, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 999 },
  count: { color: palette.textPrimary, fontSize: 15, fontWeight: '800', width: 28, textAlign: 'right' },
  empty: { color: palette.textSecondary, fontSize: 13, textAlign: 'center', paddingVertical: 12 },
}));
