import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from 'react-native-paper';
import Animated, {
  Easing,
  FadeOutUp,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MyRating, getMyRating } from '../api/compete';
import { t, tf } from '../i18n';
import { useRatingBurst } from '../store/ratingBurstStore';
import { makeStyles, palette } from '../theme/theme';
import Icon from './Icon';

const SHOW_MS = 3400;

/** Counts a number up from `from` to `to` over `ms`, starting when `to` is known. */
function useCountUp(from: number | null, to: number | null, ms = 700): number | null {
  const [value, setValue] = useState<number | null>(from);
  useEffect(() => {
    if (from == null || to == null) {
      setValue(to ?? from);
      return;
    }
    let frame = 0;
    const start = Date.now();
    const tick = () => {
      const p = Math.min(1, (Date.now() - start) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(from + (to - from) * eased));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [from, to, ms]);
  return value;
}

/** One segment of the weekly-goal bar; the newest filled one grows in. */
function GoalSegment({ filled, fresh, delay }: { filled: boolean; fresh: boolean; delay: number }) {
  const width = useSharedValue(filled && !fresh ? 1 : 0);
  useEffect(() => {
    if (filled && fresh) {
      width.value = withDelay(delay, withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) }));
    }
  }, [filled, fresh, delay, width]);
  const fill = useAnimatedStyle(() => ({ width: `${width.value * 100}%` }));
  return (
    <View style={styles.segment}>
      <Animated.View style={[styles.segmentFill, fill]} />
    </View>
  );
}

/**
 * The moment after a check-in: "+5" pops, the rating counts up, and the weekly
 * goal bar fills its new segment (closing with a second haptic when the bonus
 * lands). Tap to dismiss; it leaves on its own after a few seconds.
 */
export default function RatingBurst() {
  const { visible, points, key, hide } = useRatingBurst();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<MyRating | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pop = useSharedValue(0.4);
  const enter = useSharedValue(0);

  useEffect(() => {
    if (!visible) return;
    setData(null);
    let alive = true;
    getMyRating()
      .then((r) => alive && setData(r))
      .catch(() => undefined);
    enter.value = 0;
    pop.value = 0.4;
    enter.value = withDelay(220, withSpring(1, { damping: 16, stiffness: 180 }));
    pop.value = withDelay(320, withSequence(withSpring(1.18, { damping: 7, stiffness: 260 }), withSpring(1)));
    if (points >= 10) {
      setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), 900);
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(hide, SHOW_MS);
    return () => {
      alive = false;
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, visible]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: (1 - enter.value) * -28 }],
  }));
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  const rating = useCountUp(data ? data.rating - points : null, data ? data.rating : null);

  if (!visible) return null;

  const bonus = points >= 10;
  const goal = data?.weeklyGoal ?? 0;
  const days = Math.min(data?.weekDays ?? 0, goal);
  const left = Math.max(0, goal - (data?.weekDays ?? 0));
  const line = bonus
    ? tf('compete.burst.bonus', { n: 5 })
    : data?.weekBonusEarned
      ? t('compete.burst.goalDone')
      : left === 1
        ? t('compete.burst.toGoal.one')
        : tf('compete.burst.toGoal.many', { n: left });

  return (
    <Animated.View
      key={key}
      exiting={FadeOutUp.duration(220)}
      pointerEvents="box-none"
      style={[styles.wrap, { top: insets.top + 8 }, cardStyle]}>
      <Pressable onPress={hide} style={styles.card} accessibilityRole="button" accessibilityLabel={t('a11y.close')}>
        <View style={styles.row}>
          <Animated.Text style={[styles.points, popStyle]}>+{points}</Animated.Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{t('compete.burst.training')}</Text>
            <Text style={styles.sub} numberOfLines={1}>
              {t('compete.rating')} {rating ?? '—'}
              {data?.gymPosition ? `  ·  ${tf('compete.burst.gym', { n: data.gymPosition })}` : ''}
            </Text>
          </View>
          <Icon name="trophy" size={22} color={palette.pro} />
        </View>
        {goal > 0 && (
          <View style={styles.goal}>
            <View style={styles.segments}>
              {Array.from({ length: goal }, (_, i) => (
                <GoalSegment key={i} filled={i < days} fresh={i === days - 1} delay={520} />
              ))}
            </View>
            <View style={styles.goalLine}>
              {bonus && <Icon name="fire" size={14} color={palette.primary} />}
              <Text style={[styles.goalText, bonus && styles.goalTextBonus]} numberOfLines={1}>
                {line}
              </Text>
            </View>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = makeStyles(() => ({
  wrap: { position: 'absolute', left: 14, right: 14, zIndex: 1000, elevation: 12 },
  card: {
    backgroundColor: palette.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.surfaceVariant,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  points: { color: palette.primary, fontSize: 34, fontWeight: 'bold', minWidth: 64 },
  title: { color: palette.textPrimary, fontSize: 15, fontWeight: 'bold' },
  sub: { color: palette.textSecondary, fontSize: 13, marginTop: 2 },
  goal: { marginTop: 12, gap: 8 },
  segments: { flexDirection: 'row', gap: 5 },
  segment: { flex: 1, height: 6, borderRadius: 3, backgroundColor: palette.surfaceVariant, overflow: 'hidden' },
  segmentFill: { height: '100%', borderRadius: 3, backgroundColor: palette.primary },
  goalLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  goalText: { color: palette.textSecondary, fontSize: 12 },
  goalTextBonus: { color: palette.textPrimary, fontWeight: '600' },
}));
