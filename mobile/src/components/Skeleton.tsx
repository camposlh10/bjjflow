import { useEffect } from 'react';
import { DimensionValue, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { makeStyles, palette } from '../theme/theme';

/** A single shimmering placeholder block used while content loads. */
export default function Skeleton({
  width = '100%',
  height,
  radius = 8,
  style,
}: {
  width?: DimensionValue;
  height: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const opacity = useSharedValue(0.5);
  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 750, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.45, { duration: 750, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [opacity]);
  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[{ width, height, borderRadius: radius }, styles.block, style, animStyle]} />;
}

/** Strava-style training card placeholder for the Comunidade feed. */
export function TrainingCardSkeleton() {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Skeleton width={42} height={42} radius={21} />
        <View style={{ flex: 1, gap: 6 }}>
          <Skeleton width="55%" height={13} />
          <Skeleton width="35%" height={10} />
        </View>
      </View>
      <Skeleton width="40%" height={16} />
      <View style={styles.row}>
        <Skeleton width="28%" height={34} />
        <Skeleton width="28%" height={34} />
        <Skeleton width="28%" height={34} />
      </View>
      <Skeleton height={180} radius={12} />
    </View>
  );
}

const styles = makeStyles(() => ({
  block: { backgroundColor: palette.surfaceVariant },
  card: { backgroundColor: palette.surface, borderRadius: 16, padding: 16, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
}));
