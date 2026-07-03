import { Dimensions, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import Svg, { Circle, Line, Polygon } from 'react-native-svg';

import { makeStyles, palette } from '../theme/theme';

export type RadarAxis = { label: string; value: number };

// Leave generous room for the labels that ring the chart so they never clip.
const DEFAULT_SIZE = Math.min(300, Dimensions.get('window').width - 72);

/** Spider/radar chart of submission counts across the catalog axes. */
export default function SubmissionRadar({
  axes,
  color = palette.primary,
  size = DEFAULT_SIZE,
}: {
  axes: RadarAxis[];
  color?: string;
  size?: number;
}) {
  const n = axes.length;
  if (n < 3) {
    return null;
  }

  const center = size / 2;
  const r = center - 38; // data radius, leaving a ring of space for labels
  const labelR = r + 18;
  const labelWidth = 76;
  const rings = 4;
  const max = Math.max(1, ...axes.map((a) => a.value));
  const hasData = axes.some((a) => a.value > 0);

  const pointAt = (i: number, radius: number) => {
    const angle = (-90 + (360 / n) * i) * (Math.PI / 180);
    return { x: center + radius * Math.cos(angle), y: center + radius * Math.sin(angle) };
  };

  const points = (radius: number, scale?: (a: RadarAxis) => number) =>
    axes
      .map((a, i) => {
        const p = pointAt(i, scale ? scale(a) : radius);
        return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
      })
      .join(' ');

  const dataPoints = points(0, (a) => (a.value / max) * r);

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {Array.from({ length: rings }).map((_, k) => (
          <Polygon
            key={k}
            points={points((r * (k + 1)) / rings)}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={1}
          />
        ))}
        {axes.map((_, i) => {
          const p = pointAt(i, r);
          return (
            <Line key={i} x1={center} y1={center} x2={p.x} y2={p.y} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
          );
        })}
        {hasData && <Polygon points={dataPoints} fill={`${color}33`} stroke={color} strokeWidth={2} />}
        {hasData &&
          axes.map((a, i) =>
            a.value > 0 ? (
              (() => {
                const p = pointAt(i, (a.value / max) * r);
                return <Circle key={i} cx={p.x} cy={p.y} r={3.5} fill={color} stroke="#fff" strokeWidth={1.5} />;
              })()
            ) : null,
          )}
      </Svg>
      {axes.map((a, i) => {
        const p = pointAt(i, labelR);
        const left = Math.max(0, Math.min(size - labelWidth, p.x - labelWidth / 2));
        return (
          <Text key={i} style={[styles.label, { left, top: p.y - 8, width: labelWidth }]} numberOfLines={1}>
            {a.label}
          </Text>
        );
      })}
    </View>
  );
}

const styles = makeStyles(() => ({
  wrap: { alignSelf: 'center', overflow: 'visible' },
  label: {
    position: 'absolute',
    textAlign: 'center',
    color: palette.textSecondary,
    fontSize: 9,
  },
}));
