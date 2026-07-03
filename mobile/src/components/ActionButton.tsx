import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { makeStyles, palette } from '../theme/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/** Post action icon (like/comment/share/download/save) with a smooth scale pop on press. */
export default function ActionButton({
  icon,
  count,
  color = palette.textSecondary,
  size = 17,
  onPress,
  accessibilityLabel,
}: {
  icon: IconName;
  count?: number;
  color?: string;
  size?: number;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.8, { damping: 14, stiffness: 340 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 8, stiffness: 240 });
      }}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[styles.btn, animStyle]}>
      <MaterialCommunityIcons name={icon} size={size} color={color} />
      {count !== undefined && <Text style={[styles.count, { color }]}>{count}</Text>}
    </AnimatedPressable>
  );
}

const styles = makeStyles(() => ({
  btn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  count: { fontSize: 11 },
}));
