import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { BODY_IMAGE_SIZE, BODY_NODES, BodyView, FIGURE_BOX, RegionNode, bodyRegionLabel, intensityColor } from '../constants/body';
import { makeStyles } from '../theme/theme';

// Dark front/back silhouette: front figure on the left, back on the right.
// Swap assets/body-silhouette.png and update BODY_IMAGE_SIZE + FIGURE_BOX in
// constants/body.ts (re-run the pixel scan) if you replace the image.
const BODY_IMAGE = require('../../assets/body-silhouette.png');
// Fraction of the view width each figure occupies (leaves side margin and keeps
// the crop window narrow enough that the neighbouring figure never peeks in).
const FILL = 0.72;

/** Anatomy body (front/back) with a soft glowing heat blob + numbered dot per
 *  painful region; every region is tappable to log/edit pain there. */
export default function BodyMap({
  view,
  pain,
  onRegionPress,
  width = 240,
}: {
  view: BodyView;
  pain: Record<string, number>;
  onRegionPress: (region: string) => void;
  width?: number;
}) {
  const box = FIGURE_BOX[view];
  const figW = box.right - box.left;
  const figH = box.bottom - box.top;
  const scale = (width * FILL) / figW;

  // Frame height is derived from the front figure so switching front/back doesn't
  // resize the frame; each figure is then centered within it.
  const frontBox = FIGURE_BOX.front;
  const frameH = Math.round(width * FILL * ((frontBox.bottom - frontBox.top) / (frontBox.right - frontBox.left)));

  const centerX = (box.left + box.right) / 2;
  const centerY = (box.top + box.bottom) / 2;
  const translateX = width / 2 - centerX * scale;
  const translateY = frameH / 2 - centerY * scale;
  const glowR = Math.max(26, width * 0.12);

  const pos = (n: RegionNode) => ({
    x: translateX + (box.left + n.x * figW) * scale,
    y: translateY + (box.top + n.y * figH) * scale,
  });

  const nodes = BODY_NODES[view];
  const active = nodes.filter((n) => (pain[n.key] ?? 0) > 0);

  return (
    <View style={[styles.frame, { width, height: frameH }]}>
      <Image
        source={BODY_IMAGE}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: BODY_IMAGE_SIZE.width * scale,
          height: BODY_IMAGE_SIZE.height * scale,
          transform: [{ translateX }, { translateY }],
        }}
        resizeMode="cover"
      />
      {active.length > 0 && (
        <Svg width={width} height={frameH} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            {active.map((n) => {
              const color = intensityColor(pain[n.key]);
              return (
                <RadialGradient key={n.key} id={`glow-${view}-${n.key}`} cx="50%" cy="50%" r="50%">
                  <Stop offset="0%" stopColor={color} stopOpacity={0.6} />
                  <Stop offset="55%" stopColor={color} stopOpacity={0.25} />
                  <Stop offset="100%" stopColor={color} stopOpacity={0} />
                </RadialGradient>
              );
            })}
          </Defs>
          {active.map((n) => {
            const p = pos(n);
            return <Circle key={n.key} cx={p.x} cy={p.y} r={glowR} fill={`url(#glow-${view}-${n.key})`} />;
          })}
        </Svg>
      )}
      {nodes.map((n) => {
        const intensity = pain[n.key] ?? 0;
        const on = intensity > 0;
        const color = intensityColor(intensity);
        const p = pos(n);
        return (
          <Pressable
            key={n.key}
            onPress={() => onRegionPress(n.key)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={bodyRegionLabel(n.key)}
            style={[styles.hotspot, { left: p.x - 22, top: p.y - 22 }]}>
            <View
              style={[
                styles.dot,
                on
                  ? { backgroundColor: color, borderColor: '#FFFFFF' }
                  : { backgroundColor: 'rgba(255,255,255,0.4)', borderColor: 'rgba(0,0,0,0.4)' },
              ]}>
              {on && <Text style={styles.dotText}>{intensity}</Text>}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = makeStyles(() => ({
  // Matches the silhouette image's dark-navy background so there's no seam.
  frame: { overflow: 'hidden', borderRadius: 14, backgroundColor: '#0A0F14' },
  hotspot: { position: 'absolute', width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  dot: { minWidth: 24, height: 24, borderRadius: 12, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  dotText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
}));
