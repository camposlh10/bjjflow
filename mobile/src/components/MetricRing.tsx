import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import Svg, { Circle } from 'react-native-svg';

import { makeStyles, palette } from '../theme/theme';

/**
 * WHOOP/Oura-style progress ring: a value in the centre, a coloured arc showing
 * progress toward a goal, and a label underneath. Built to make the screen feel
 * like an athlete's dashboard.
 */
export default function MetricRing({
  value,
  progress,
  label,
  sublabel,
  color,
  size = 88,
}: {
  value: string | number;
  progress: number;
  label: string;
  sublabel?: string;
  color: string;
  size?: number;
}) {
  const stroke = 5;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  const dash = circumference * p;
  const center = size / 2;

  return (
    <View style={styles.wrap}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Circle cx={center} cy={center} r={r} stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} fill="none" />
          <Circle
            cx={center}
            cy={center}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeLinecap="round"
            transform={`rotate(-90 ${center} ${center})`}
          />
        </Svg>
        <View style={styles.center}>
          <Text style={styles.value}>{value}</Text>
          {sublabel ? <Text style={styles.sub}>{sublabel}</Text> : null}
        </View>
      </View>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = makeStyles(() => ({
  wrap: { alignItems: 'center', gap: 9 },
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  value: { color: palette.textPrimary, fontSize: 21, fontWeight: '700', letterSpacing: -0.5 },
  sub: { color: palette.textSecondary, fontSize: 9, marginTop: 1, letterSpacing: 0.3 },
  label: { color: palette.textSecondary, fontSize: 10.5, fontWeight: '600', letterSpacing: 0.4, textTransform: 'uppercase' },
}));
