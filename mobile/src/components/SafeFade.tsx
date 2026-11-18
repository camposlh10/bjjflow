import { useEffect } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

type Props = {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  delay?: number;
  duration?: number;
  /** Slides up (positive) or down (negative) by this many points as it appears. */
  offsetY?: number;
  /** Grows from this scale (e.g. 0.6) as it appears. */
  fromScale?: number;
  pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only';
};

/**
 * Fades its content in when it mounts, and is guaranteed to end fully visible.
 *
 * Reanimated's `entering` layout animations can stay stuck at their first
 * frame when the screen is switched or frozen mid-animation, which left whole
 * screens black. This drives the fade from a shared value instead, and snaps
 * to visible shortly after the animation should have ended, whatever happened
 * in between.
 */
export default function SafeFade({
  children,
  style,
  delay = 0,
  duration = 240,
  offsetY = 0,
  fromScale = 1,
  pointerEvents,
}: Props) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(delay, withTiming(1, { duration, easing: Easing.out(Easing.cubic) }));
    const fallback = setTimeout(() => {
      progress.value = 1;
    }, delay + duration + 300);
    return () => clearTimeout(fallback);
  }, [delay, duration, progress]);

  const animated = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateY: (1 - progress.value) * offsetY },
      { scale: fromScale + (1 - fromScale) * progress.value },
    ],
  }));

  return (
    <Animated.View style={[style, animated]} pointerEvents={pointerEvents}>
      {children}
    </Animated.View>
  );
}
