import { useEffect, useRef } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from 'react-native-paper';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Match, Player, Side, perspective } from '../../api/compete';
import { getActiveLocale, t, tf } from '../../i18n';
import { makeStyles, palette } from '../../theme/theme';
import { Avatar } from '../CommunityFeed';
import Icon from '../Icon';

/** "16/11" in Portuguese, "Nov 16" in English, from a YYYY-MM-DD date. */
export function shortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return getActiveLocale() === 'en'
    ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
}

export function signed(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0';
}

/** Whole days from today (device date) to a YYYY-MM-DD date. */
export function daysUntil(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((new Date(y, m - 1, d).getTime() - today.getTime()) / 86_400_000);
}

export function firstName(p: Player): string {
  return p.displayName.trim().split(/\s+/)[0] || p.displayName;
}

/** One score digit that drops in with a spring whenever it changes. */
function ScoreDigit({ value, style }: { value: number; style: object }) {
  const y = useSharedValue(0);
  const opacity = useSharedValue(1);
  const last = useRef(value);
  useEffect(() => {
    if (last.current !== value) {
      last.current = value;
      y.value = -18;
      opacity.value = 0;
      y.value = withSpring(0, { damping: 12, stiffness: 220 });
      opacity.value = withTiming(1, { duration: 180 });
    }
  }, [value, y, opacity]);
  const anim = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ translateY: y.value }] }));
  return <Animated.Text style={[style, anim]}>{value}</Animated.Text>;
}

/**
 * Two avatars and the round score. On mount the players slide in from the sides
 * and the "×" lands like a stamp; a changed score drops in. The winner of a
 * finished match is drawn larger.
 */
export function Scoreboard({ side, size = 64, animate = true }: { side: Side; size?: number; animate?: boolean }) {
  const enter = useSharedValue(animate ? 0 : 1);
  const stamp = useSharedValue(animate ? 0 : 1);
  useEffect(() => {
    if (!animate) return;
    enter.value = withSpring(1, { damping: 15, stiffness: 140 });
    stamp.value = withDelay(260, withSequence(withSpring(1.3, { damping: 6, stiffness: 300 }), withSpring(1)));
  }, [animate, enter, stamp]);
  const left = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateX: (1 - enter.value) * -60 }],
  }));
  const right = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateX: (1 - enter.value) * 60 }],
  }));
  const mid = useAnimatedStyle(() => ({ opacity: Math.min(1, stamp.value), transform: [{ scale: stamp.value }] }));

  const meWon = side.result === 'WON';
  const themWon = side.result === 'LOST';
  const big = Math.round(size * 1.18);
  return (
    <View style={styles.board}>
      <Animated.View style={[styles.boardPlayer, left]}>
        <View style={[styles.ring, meWon && styles.ringWin]}>
          <Avatar name={side.me.displayName} url={side.me.avatarUrl} size={meWon ? big : size} />
        </View>
        <Text style={styles.boardName} numberOfLines={1}>
          {side.isViewer ? t('compete.you') : firstName(side.me)}
        </Text>
        <Text style={styles.boardRating}>{side.me.rating}</Text>
      </Animated.View>
      <Animated.View style={[styles.boardScore, mid]}>
        <ScoreDigit value={side.myRounds} style={styles.scoreNum} />
        <Text style={styles.scoreX}>×</Text>
        <ScoreDigit value={side.theirRounds} style={styles.scoreNum} />
      </Animated.View>
      <Animated.View style={[styles.boardPlayer, right]}>
        <View style={[styles.ring, themWon && styles.ringWin]}>
          <Avatar name={side.them.displayName} url={side.them.avatarUrl} size={themWon ? big : size} />
        </View>
        <Text style={styles.boardName} numberOfLines={1}>
          {firstName(side.them)}
        </Text>
        <Text style={styles.boardRating}>{side.them.rating}</Text>
      </Animated.View>
    </View>
  );
}

/** R1…R5 pills: red when "me" took the round, grey when they did, outlined for a tie or not played. */
export function RoundStrip({ side, current }: { side: Side; current: number | null }) {
  return (
    <View style={styles.rounds}>
      {[1, 2, 3, 4, 5].map((n) => {
        const r = side.rounds.find((x) => x.roundNo === n);
        const live = current === n;
        return (
          <View
            key={n}
            style={[
              styles.round,
              r?.result === 'WON' && styles.roundWon,
              r?.result === 'LOST' && styles.roundLost,
              live && styles.roundLive,
            ]}>
            <Text style={[styles.roundLabel, r && r.result !== 'TIE' && styles.roundLabelOn]}>
              {r ? `${r.myDays}–${r.theirDays}` : `R${n}`}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/** Seven day dots for one player in the current round; days that count fill in one after another. */
export function WeekDots({
  startsOn,
  dates,
  mine,
}: {
  startsOn: string;
  dates: string[];
  mine: boolean;
}) {
  const [y, m, d] = startsOn.split('-').map(Number);
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(y, m - 1, d + i);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  });
  return (
    <View style={styles.dots}>
      {days.map((day, i) => (
        <Dot key={day} on={dates.includes(day)} future={daysUntil(day) > 0} mine={mine} delay={i * 60} />
      ))}
    </View>
  );
}

function Dot({ on, future, mine, delay }: { on: boolean; future: boolean; mine: boolean; delay: number }) {
  const scale = useSharedValue(on ? 0.3 : 1);
  useEffect(() => {
    if (on) scale.value = withDelay(delay, withSpring(1, { damping: 9, stiffness: 240 }));
  }, [on, delay, scale]);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <View style={[styles.dot, future && styles.dotFuture]}>
      {on && <Animated.View style={[styles.dotFill, mine ? styles.dotMine : styles.dotTheirs, anim]} />}
    </View>
  );
}

/** One line about where a match stands, for lists and the home card. */
export function statusLine(m: Match, side: Side): string {
  if (m.status === 'PENDING') {
    return m.myRole === 'OPPONENT'
      ? tf('compete.match.challengedYou', { name: firstName(side.them) })
      : tf('compete.match.waiting', { name: firstName(side.them) });
  }
  if (m.status === 'ACTIVE') {
    if (m.startsOn && daysUntil(m.startsOn) > 0) {
      return daysUntil(m.startsOn) === 1
        ? t('compete.match.startsTomorrow')
        : tf('compete.match.startsOn', { date: shortDate(m.startsOn) });
    }
    const c = m.current;
    if (!c) return t('compete.match.firstTo3');
    const left = daysUntil(c.endsOn);
    const when = left <= 0 ? t('compete.match.lastDay') : tf('compete.match.daysLeft', { n: left + 1 });
    return `${tf('compete.match.round', { n: c.roundNo })} · ${side.myDays}–${side.theirDays} · ${when}`;
  }
  if (m.status === 'FINISHED') {
    const delta = side.isViewer ? side.myDelta : null;
    const head =
      side.result === 'DRAW'
        ? t('compete.result.draw')
        : side.result === 'WON' && side.isViewer
          ? t('compete.result.won')
          : tf('compete.result.someoneWon', { name: firstName(side.result === 'WON' ? side.me : side.them) });
    return delta != null ? `${head} · ${tf('compete.result.ratingChange', { delta: signed(delta) })}` : head;
  }
  return t(`compete.match.status.${m.status}` as 'compete.match.status.EXPIRED');
}

/** Compact match row: both avatars, the score and one status line. */
export function MatchCard({ match, onPress, highlight }: { match: Match; onPress?: () => void; highlight?: boolean }) {
  const side = perspective(match);
  const live = match.status === 'ACTIVE';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, highlight && styles.cardHighlight, pressed && { opacity: 0.85 }]}
      accessibilityRole="button">
      <View style={styles.cardAvatars}>
        <Avatar name={side.me.displayName} url={side.me.avatarUrl} size={38} />
        <View style={styles.cardAvatarBack}>
          <Avatar name={side.them.displayName} url={side.them.avatarUrl} size={38} />
        </View>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {side.isViewer ? t('compete.you') : firstName(side.me)} {t('compete.vs')} {firstName(side.them)}
        </Text>
        <Text style={styles.cardSub} numberOfLines={1}>
          {statusLine(match, side)}
        </Text>
      </View>
      {(live || match.status === 'FINISHED') && (
        <Text style={styles.cardScore}>
          {side.myRounds}
          <Text style={styles.cardX}> × </Text>
          {side.theirRounds}
        </Text>
      )}
      <Icon name="chevron-right" size={18} color={palette.textSecondary} />
    </Pressable>
  );
}

export function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.section}>{children}</Text>;
}

const styles = makeStyles(() => ({
  board: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  boardPlayer: { alignItems: 'center', width: 104, gap: 4 },
  ring: { borderRadius: 999, padding: 3, borderWidth: 2, borderColor: 'transparent' },
  ringWin: { borderColor: palette.pro },
  boardName: { color: palette.textPrimary, fontSize: 14, fontWeight: 'bold', maxWidth: 100 },
  boardRating: { color: palette.textSecondary, fontSize: 12 },
  boardScore: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  scoreNum: { color: palette.textPrimary, fontSize: 46, fontWeight: 'bold', fontVariant: ['tabular-nums'] },
  scoreX: { color: palette.textSecondary, fontSize: 24 },
  rounds: { flexDirection: 'row', gap: 6 },
  round: {
    flex: 1,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundWon: { backgroundColor: palette.primary, borderColor: palette.primary },
  roundLost: { backgroundColor: palette.outline, borderColor: palette.outline },
  roundLive: { borderStyle: 'dashed', borderColor: palette.textSecondary },
  roundLabel: { color: palette.textSecondary, fontSize: 12, fontWeight: '600' },
  roundLabelOn: { color: '#FFFFFF' },
  dots: { flexDirection: 'row', gap: 5 },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: palette.outline,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  dotFuture: { borderStyle: 'dashed', borderColor: palette.outline, opacity: 0.55 },
  dotFill: { width: 20, height: 20, borderRadius: 10 },
  dotMine: { backgroundColor: palette.primary },
  dotTheirs: { backgroundColor: palette.textSecondary },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: palette.surface,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  cardHighlight: { borderWidth: 1, borderColor: palette.primary },
  cardAvatars: { flexDirection: 'row', width: 62 },
  cardAvatarBack: { marginLeft: -14, borderRadius: 21, borderWidth: 2, borderColor: palette.surface },
  cardTitle: { color: palette.textPrimary, fontSize: 15, fontWeight: 'bold' },
  cardSub: { color: palette.textSecondary, fontSize: 12, marginTop: 2 },
  cardScore: { color: palette.textPrimary, fontSize: 20, fontWeight: 'bold', fontVariant: ['tabular-nums'] },
  cardX: { color: palette.textSecondary, fontSize: 14, fontWeight: 'normal' },
  section: { color: palette.textSecondary, fontSize: 13, fontWeight: '600', marginTop: 20, marginBottom: 10 },
}));
