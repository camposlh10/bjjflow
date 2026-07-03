import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import Svg, { Circle, Path, Polygon, Rect, Text as SvgText } from 'react-native-svg';

import { MedalTier } from '../api/gyms';
import { competitionStyle } from '../constants/competitions';
import { makeStyles } from '../theme/theme';

const TIER_COLORS: Record<MedalTier, string> = {
  GOLD: '#F5C518',
  SILVER: '#C7CED6',
  BRONZE: '#CD7F32',
};

const BODY_FILL = '#0E0E12';

type Props = {
  competition: string;
  tier?: MedalTier;
  /** overall medal width in px */
  size?: number;
  count?: number;
};

function emblemFontSize(line: string): number {
  if (line.length <= 3) return 19;
  if (line.length <= 4) return 16;
  if (line.length <= 5) return 14;
  return 12;
}

export default function MedalVisual({ competition, tier = 'GOLD', size = 72, count = 1 }: Props) {
  const c = competitionStyle(competition);
  const height = size * 1.32;
  const lines = c.emblem ? c.emblem.split('\n') : [];
  const lineFont = Math.min(...lines.map(emblemFontSize), 19);

  return (
    <View style={{ width: size, height }}>
      <Svg width={size} height={height} viewBox="0 0 100 132">
        {/* two-tone ribbon straps forming a V into the medal */}
        <Polygon points="34,4 47,4 54,60 43,60" fill={c.ribbon[0]} />
        <Polygon points="66,4 53,4 46,60 57,60" fill={c.ribbon[1]} />

        {c.shape === 'circle' && (
          <Circle cx={50} cy={88} r={30} fill={BODY_FILL} stroke={c.accent} strokeWidth={3} />
        )}
        {c.shape === 'square' && (
          <Rect x={20} y={58} width={60} height={60} rx={12} fill={BODY_FILL} stroke={c.accent} strokeWidth={3} />
        )}
        {c.shape === 'shield' && (
          <Path
            d="M50 58 L80 68 L80 90 Q80 109 50 121 Q20 109 20 90 L20 68 Z"
            fill={BODY_FILL}
            stroke={c.accent}
            strokeWidth={3}
          />
        )}

        {lines.map((line, i) => (
          <SvgText
            key={i}
            x={50}
            y={88 + (i - (lines.length - 1) / 2) * (lineFont + 1) + lineFont * 0.35}
            fill={c.accent}
            fontSize={lineFont}
            fontWeight="bold"
            textAnchor="middle">
            {line}
          </SvgText>
        ))}
      </Svg>

      {count > 1 && (
        <View style={[styles.countBadge, { backgroundColor: TIER_COLORS[tier], top: height * 0.42 }]}>
          <Text style={styles.countText}>×{count}</Text>
        </View>
      )}
    </View>
  );
}

const styles = makeStyles(() => ({
  countBadge: {
    position: 'absolute',
    right: 0,
    minWidth: 22,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#0D0D10',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: { color: '#0D0D10', fontSize: 11, fontWeight: 'bold' },
}));
