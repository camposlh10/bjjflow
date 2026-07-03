import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import { milestoneProgress, nextMilestone } from '../constants/milestones';
import { t, tf } from '../i18n';
import { makeStyles, palette } from '../theme/theme';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export default function MilestoneBar({
  icon,
  label,
  value,
  ladder,
  color = palette.primary,
}: {
  icon: IconName;
  label: string;
  value: number;
  ladder: number[];
  /** Bar fill + icon tint; matches the profile Métricas ring colors. */
  color?: string;
}) {
  const next = nextMilestone(value, ladder);
  const progress = milestoneProgress(value, ladder);
  return (
    <View style={styles.row}>
      <View style={styles.head}>
        <View style={styles.labelWrap}>
          <MaterialCommunityIcons name={icon} size={15} color={color} />
          <Text style={styles.label}>{label}</Text>
        </View>
        <Text style={styles.value}>{value}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.sub}>
        {next === null ? t('home.overview.maxed') : tf('home.overview.toGo', { n: next - value, m: next })}
      </Text>
    </View>
  );
}

const styles = makeStyles(() => ({
  row: { gap: 6 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  labelWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { color: palette.textSecondary, fontSize: 12 },
  value: { color: palette.textPrimary, fontSize: 16, fontWeight: 'bold' },
  track: { height: 7, borderRadius: 999, backgroundColor: palette.surfaceVariant, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 999, backgroundColor: palette.primary },
  sub: { color: palette.textSecondary, fontSize: 10 },
}));
