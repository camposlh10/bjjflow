import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import { makeStyles, palette } from '../theme/theme';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/** A dashboard metric tile (2-per-row). `locked` greys it out for wearable-only metrics. */
export default function MetricWidget({
  icon,
  label,
  value,
  sub,
  color = palette.primary,
  locked,
}: {
  icon: IconName;
  label: string;
  value?: string;
  sub?: string;
  color?: string;
  locked?: boolean;
}) {
  return (
    <View style={[styles.tile, locked && styles.tileLocked]}>
      <View style={styles.top}>
        <View style={[styles.iconWrap, { backgroundColor: locked ? palette.surfaceVariant : `${color}22` }]}>
          <MaterialCommunityIcons name={icon} size={18} color={locked ? palette.textSecondary : color} />
        </View>
        {locked && <MaterialCommunityIcons name="lock" size={14} color={palette.outline} />}
      </View>
      <Text style={[styles.value, locked && styles.valueLocked]} numberOfLines={1}>
        {locked ? '—' : (value ?? '—')}
      </Text>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
      {sub ? (
        <Text style={[styles.sub, locked && { color: palette.outline }]} numberOfLines={1}>
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

const styles = makeStyles(() => ({
  tile: {
    width: '48%',
    backgroundColor: palette.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  tileLocked: { opacity: 0.55 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  iconWrap: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  value: { color: palette.textPrimary, fontSize: 22, fontWeight: 'bold' },
  valueLocked: { color: palette.textSecondary },
  label: { color: palette.textPrimary, fontSize: 13, fontWeight: '600', marginTop: 2 },
  sub: { color: palette.textSecondary, fontSize: 11, marginTop: 2 },
}));
