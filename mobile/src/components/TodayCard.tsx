import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMutation } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Alert, Pressable, View } from 'react-native';
import { Button, Text } from 'react-native-paper';

import { Stats, todayLocalDate } from '../api/checkins';
import { t, tf } from '../i18n';
import { submitCheckIn } from '../offline/outbox';
import { useCheckInSheet } from '../store/checkInSheetStore';
import { makeStyles, palette } from '../theme/theme';
import Skeleton from './Skeleton';

const WEEK_LETTERS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];

/**
 * Today at a glance, at the top of Início: streak, this week, and the one thing
 * to do next — log today's session in one tap, or add details / another one.
 */
export default function TodayCard({ stats }: { stats: Stats | undefined }) {
  const openSheet = useCheckInSheet((s) => s.open);

  const quick = useMutation({
    // One-tap check-in (60 min). Queued for later when offline.
    mutationFn: () => submitCheckIn({ date: todayLocalDate(), durationMinutes: 60 }),
    onSuccess: (outcome) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (outcome === 'queued') Alert.alert(t('checkin.queued'));
    },
  });

  if (!stats) {
    return <Skeleton height={170} radius={18} />;
  }

  const todayIndex = (new Date().getDay() + 6) % 7;
  const weekDays = Array.isArray(stats.weekDays) ? stats.weekDays : [];
  const done = stats.checkedInToday;

  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={styles.streak}>
          <MaterialCommunityIcons name="fire" size={26} color={palette.primary} />
          <Text style={styles.streakNumber}>{stats.currentStreak}</Text>
          <Text style={styles.streakLabel}>
            {stats.currentStreak === 1 ? t('home.hero.days.one') : t('home.hero.days.many')}
          </Text>
        </View>
        {stats.weeklyGoal ? (
          <Text style={styles.week}>
            {tf('today.week', { done: stats.weeklyProgress ?? 0, goal: stats.weeklyGoal })}
          </Text>
        ) : null}
      </View>

      <View style={styles.weekRow} accessibilityLabel={t('today.week.a11y')}>
        {WEEK_LETTERS.map((letter, i) => (
          <View key={i} style={styles.day}>
            <View style={[styles.dot, weekDays[i] && styles.dotDone, i === todayIndex && !weekDays[i] && styles.dotToday]}>
              {weekDays[i] && <MaterialCommunityIcons name="check" size={11} color="#fff" />}
            </View>
            <Text style={[styles.letter, i === todayIndex && styles.letterToday]}>{letter}</Text>
          </View>
        ))}
      </View>

      {done ? (
        <View style={styles.doneRow}>
          <View style={styles.doneLabel}>
            <MaterialCommunityIcons name="check-circle" size={18} color={palette.primary} />
            <Text style={styles.doneText}>{t('today.done')}</Text>
          </View>
          <Pressable onPress={openSheet} hitSlop={8} accessibilityRole="button">
            <Text style={styles.link}>{t('home.action.again')}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.actions}>
          <Button
            mode="contained"
            icon="check"
            onPress={() => quick.mutate()}
            loading={quick.isPending}
            disabled={quick.isPending}
            style={styles.primary}
            contentStyle={styles.primaryContent}>
            {t('today.quick')}
          </Button>
          <Button mode="outlined" onPress={openSheet} style={styles.secondary} contentStyle={styles.primaryContent}>
            {t('today.details')}
          </Button>
        </View>
      )}
    </View>
  );
}

const styles = makeStyles(() => ({
  card: {
    backgroundColor: palette.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.primary + '40',
  },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  streak: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  streakNumber: { color: palette.textPrimary, fontSize: 30, fontWeight: 'bold', lineHeight: 34 },
  streakLabel: { color: palette.textSecondary, fontSize: 14 },
  week: { color: palette.textSecondary, fontSize: 13 },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
  day: { alignItems: 'center', gap: 4, flex: 1 },
  dot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: palette.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: { backgroundColor: palette.primary },
  dotToday: { borderWidth: 2, borderColor: palette.primary },
  letter: { color: palette.textSecondary, fontSize: 11 },
  letterToday: { color: palette.textPrimary, fontWeight: 'bold' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 16 },
  primary: { flex: 1, borderRadius: 12 },
  secondary: { borderRadius: 12, borderColor: palette.outline },
  primaryContent: { paddingVertical: 4 },
  doneRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  doneLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  doneText: { color: palette.textPrimary, fontSize: 14, fontWeight: '600' },
  link: { color: palette.primary, fontSize: 14, fontWeight: '600' },
}));
