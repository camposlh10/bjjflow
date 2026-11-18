import Icon from '../components/Icon';
import { useNavigation } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TimelineItem, getJourney, logCompetition } from '../api/activity';
import { CheckInEntry, Stats, getStats, listCheckIns, setWeeklyGoal, todayLocalDate } from '../api/checkins';
import { getUserSubmissions } from '../api/submissions';
import DateField from '../components/DateField';
import Skeleton from '../components/Skeleton';
import SubmissionBars from '../components/SubmissionBars';
import { SESSION_TAG } from '../constants/classes';
import { TRAINING_MILESTONES, nextMilestone } from '../constants/milestones';
import { SUBMISSIONS } from '../constants/submissions';
import { t, tf } from '../i18n';
import { useAuthStore } from '../store/authStore';
import { useCheckInSheet } from '../store/checkInSheetStore';
import { makeStyles, palette } from '../theme/theme';
import {
  addDays,
  hours,
  iso,
  mondayOf,
  monthName,
  monthShort,
  plural,
  relativeDay,
  sessionLabel,
  shortRange,
  summarize,
} from './progress/progressData';

type Period = 'week' | 'month' | 'total';
type IconName = keyof typeof Icon.glyphMap;

// One colour per explore row, so each reads at a glance.
const COLORS = { hours: '#3E63DD', weeks: '#2DB6A3' };
const HISTORY_FROM = '2000-01-01';

function timelineText(item: TimelineItem): string {
  switch (item.type) {
    case 'FIRST_TRAINING':
      return t('home.timeline.FIRST_TRAINING');
    case 'BELT_PROMOTION':
      return tf('home.timeline.BELT_PROMOTION', { belt: item.text ?? '' });
    case 'ACADEMY_JOINED':
      return tf('home.timeline.ACADEMY_JOINED', { text: item.text ?? '' });
    case 'TRAINING_MILESTONE':
      return tf('home.timeline.TRAINING_MILESTONE', { n: item.value ?? 0 });
    case 'STREAK_MILESTONE':
      return tf('home.timeline.STREAK_MILESTONE', { n: item.value ?? 0 });
    default:
      return tf('home.timeline.COMPETITION_RESULT', { text: item.text ?? '' });
  }
}

// Calendar date from a UTC-midnight instant (avoids timezone off-by-one).
function eventDate(isoInstant: string): string {
  const d = new Date(isoInstant);
  return `${d.getUTCDate()} ${monthShort(d.getUTCMonth())} ${d.getUTCFullYear()}`;
}

/**
 * Progresso, top to bottom: the streak, this week against the goal (with the
 * button to log a session), how much you trained in the chosen period, your
 * last session, the next milestone, your game (submissions), where to dig
 * deeper and your journey.
 */
export default function ProgressScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const openSheet = useCheckInSheet((s) => s.open);
  const [period, setPeriod] = useState<Period>('week');
  const [goalOpen, setGoalOpen] = useState(false);
  const [compOpen, setCompOpen] = useState(false);
  const [showAllJourney, setShowAllJourney] = useState(false);

  const today = useMemo(() => new Date(), []);
  const todayIso = todayLocalDate();
  const stats = useQuery({ queryKey: ['stats'], queryFn: getStats });
  const history = useQuery({
    queryKey: ['checkins', 'all', todayIso],
    queryFn: () => listCheckIns(HISTORY_FROM, todayIso),
  });
  const journey = useQuery({ queryKey: ['journey'], queryFn: getJourney });
  const subMonth = todayIso.slice(0, 7);
  const submissions = useQuery({
    queryKey: ['userSubmissions', user?.id ?? 0, subMonth, 'HIT'],
    queryFn: () => getUserSubmissions(user?.id ?? 0, subMonth, 'HIT'),
    enabled: !!user?.id,
  });

  const s = stats.data;
  const entries: CheckInEntry[] = Array.isArray(history.data) ? history.data : [];
  const timeline = Array.isArray(journey.data?.timeline) ? journey.data.timeline : [];
  const shownTimeline = showAllJourney ? timeline : timeline.slice(0, 4);
  const openMatTime = () => navigation.navigate('Metrics');

  const refresh = () => {
    stats.refetch();
    history.refetch();
    journey.refetch();
    submissions.refetch();
  };

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
      refreshControl={
        <RefreshControl refreshing={stats.isRefetching || history.isRefetching} onRefresh={refresh} tintColor={palette.primary} />
      }>
      <View style={styles.titleRow}>
        <Text style={styles.screenTitle}>{t('tabs.progress')}</Text>
        {s && s.currentStreak > 0 ? (
          <Animated.View entering={FadeIn.duration(300)} style={styles.streakPill}>
            <Icon name="fire" size={18} color={palette.primary} />
            <Text style={styles.streakPillText}>
              {plural(s.currentStreak, 'progress.streakPill.one', 'progress.streakPill.many')}
            </Text>
          </Animated.View>
        ) : null}
      </View>

      {!s || history.isLoading ? (
        <View style={{ gap: 14 }}>
          <Skeleton height={330} radius={20} />
          <Skeleton height={52} radius={14} />
          <Skeleton height={110} radius={18} />
        </View>
      ) : (
        <>
          <WeekHero stats={s} entries={entries} today={today} onEditGoal={() => setGoalOpen(true)} onLog={openSheet} />

          <View style={{ marginTop: 18 }}>
            <Segmented value={period} onChange={setPeriod} />
          </View>

          <SectionHeader
            title={t('progress.perf.title')}
            sub={t(period === 'week' ? 'progress.perf.week' : period === 'month' ? 'progress.perf.month' : 'progress.perf.total')}
          />
          <Animated.View key={period} entering={FadeIn.duration(220)}>
            <Performance entries={entries} period={period} today={today} onPress={openMatTime} />
          </Animated.View>

          <SectionHeader title={t('progress.last.title')} />
          <LastTraining entries={entries} today={today} onPress={openMatTime} />

          <NextMilestone total={s.totalCheckIns} />

          <SectionHeader
            title={t('progress.game.title')}
            sub={tf('progress.game.sub', { month: monthName(today.getMonth()) })}
            action={t('metrics.seeAll')}
            onAction={() => navigation.navigate('Submissions', { userId: user?.id })}
          />
          <View style={styles.card}>
            {(submissions.data?.items ?? []).some((i) => i.count > 0) ? (
              <SubmissionBars
                items={SUBMISSIONS.map((sb) => ({
                  label: sb.label,
                  color: sb.color,
                  value: submissions.data?.items.find((i) => i.submission === sb.key)?.count ?? 0,
                }))}
                max={4}
              />
            ) : (
              <>
                <Text style={styles.muted}>{t('progress.subs.empty')}</Text>
                <Pressable onPress={openSheet} hitSlop={8} accessibilityRole="button">
                  <Text style={styles.inlineLink}>{t('progress.cta')}</Text>
                </Pressable>
              </>
            )}
          </View>

          <SectionHeader title={t('progress.explore.title')} />
          <View style={styles.card}>
            <ExploreRow icon="clock-outline" color={palette.primary} title={t('mat.title')} sub={t('mat.explore.sub')} onPress={openMatTime} />
            <ExploreRow icon="book-open-variant" color={COLORS.hours} title={t('progress.tools.techniques')} sub={t('progress.explore.techniquesSub')} onPress={() => navigation.navigate('Techniques')} />
            <ExploreRow icon="human-handsup" color={COLORS.weeks} title={t('progress.explore.body')} sub={t('progress.explore.bodySub')} onPress={() => navigation.navigate('BodyMap')} last />
          </View>

          <SectionHeader title={t('home.timeline.title')} action={t('home.competition.cta')} actionIcon="trophy" onAction={() => setCompOpen(true)} />
          <View style={styles.card}>
            {timeline.length === 0 ? (
              <Text style={styles.muted}>{t('home.timeline.empty')}</Text>
            ) : (
              <>
                {shownTimeline.map((item, i, arr) => (
                  <Animated.View key={i} entering={FadeInDown.duration(240).delay(i * 40)} style={styles.timelineRow}>
                    <View style={styles.timelineRail}>
                      <View style={styles.timelineDot} />
                      {i < arr.length - 1 && <View style={styles.timelineLine} />}
                    </View>
                    <View style={styles.timelineBody}>
                      <Text style={styles.timelineTitle}>{timelineText(item)}</Text>
                      <Text style={styles.timelineDate}>{eventDate(item.occurredAt)}</Text>
                    </View>
                  </Animated.View>
                ))}
                {timeline.length > 4 && (
                  <Pressable onPress={() => setShowAllJourney((v) => !v)} hitSlop={8}>
                    <Text style={styles.inlineLink}>
                      {showAllJourney ? t('progress.journey.less') : tf('progress.journey.more', { n: timeline.length - 4 })}
                    </Text>
                  </Pressable>
                )}
              </>
            )}
          </View>
        </>
      )}

      <GoalModal
        visible={goalOpen}
        current={Math.max(1, s?.weeklyGoal || 3)}
        onClose={() => setGoalOpen(false)}
        onSave={async (goal) => {
          // Show the new goal at once; the request is queued when offline.
          queryClient.setQueryData<Stats>(['stats'], (old) => (old ? { ...old, weeklyGoal: goal } : old));
          setGoalOpen(false);
          Haptics.selectionAsync();
          try {
            await setWeeklyGoal(goal);
          } catch {
            queryClient.invalidateQueries({ queryKey: ['stats'] });
          }
        }}
      />
      <CompetitionModal
        visible={compOpen}
        onClose={() => setCompOpen(false)}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ['journey'] })}
      />
    </ScrollView>
  );
}

function Segmented({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  const options: { key: Period; label: string }[] = [
    { key: 'week', label: t('progress.period.week') },
    { key: 'month', label: t('progress.period.month') },
    { key: 'total', label: t('progress.period.total') },
  ];
  return (
    <View style={styles.segment} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            style={[styles.segmentItem, on && styles.segmentOn]}
            onPress={() => {
              if (!on) Haptics.selectionAsync();
              onChange(o.key);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}>
            <Text style={[styles.segmentText, on && styles.segmentTextOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * "Sua semana": days trained against the goal, Monday to Sunday, whether today
 * is logged, and the button to log a session.
 */
function WeekHero({
  stats,
  entries,
  today,
  onEditGoal,
  onLog,
}: {
  stats: Stats;
  entries: CheckInEntry[];
  today: Date;
  onEditGoal: () => void;
  onLog: () => void;
}) {
  const monday = mondayOf(today);
  const sunday = addDays(monday, 6);
  const week = summarize(entries, iso(monday), iso(sunday));
  const goal = Math.max(1, stats.weeklyGoal || 3);
  const left = goal - week.days;
  const labels = t('progress.weekdaysShort').split(',');
  const todayIso = iso(today);
  const todaySum = summarize(entries, todayIso, todayIso);
  const doneToday = todaySum.sessions > 0 || stats.checkedInToday;

  return (
    <View style={styles.hero}>
      <View style={styles.heroHead}>
        <View style={{ flex: 1 }}>
          <Text style={styles.heroTitle}>{t('progress.hero.title')}</Text>
          <Text style={styles.heroRange}>{shortRange(monday, sunday)}</Text>
        </View>
        <Pressable onPress={onEditGoal} hitSlop={10} style={styles.editGoal} accessibilityRole="button">
          <Icon name="pencil-outline" size={18} color={palette.textSecondary} />
          <Text style={styles.editGoalText}>{t('progress.goal.edit')}</Text>
        </Pressable>
      </View>

      <View style={styles.countRow}>
        <Text style={styles.count}>
          {week.days}/{goal}
        </Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.countLabel}>{t('progress.hero.days')}</Text>
          <Text style={styles.countSub}>
            {left <= 0 ? t('progress.hero.done') : plural(left, 'progress.hero.left.one', 'progress.hero.left.many')}
          </Text>
        </View>
      </View>

      <View style={styles.days}>
        {labels.map((label, i) => {
          const day = iso(addDays(monday, i));
          const done = week.dates.has(day);
          const isToday = day === todayIso;
          return (
            <View key={label} style={styles.dayCol}>
              <Text style={[styles.dayLetter, (done || isToday) && styles.dayLetterOn]}>{label}</Text>
              <View style={[styles.dayDot, !done && isToday && styles.dayToday]}>
                {done && (
                  <Animated.View entering={ZoomIn.delay(80 + i * 50).springify()} style={styles.dayDone}>
                    <Icon name="check" size={20} color="#fff" strokeWidth={2.75} />
                  </Animated.View>
                )}
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.heroFoot}>
        <View style={styles.todayLabel}>
          <Icon
            name={doneToday ? 'check-circle-outline' : 'circle-outline'}
            size={20}
            color={doneToday ? palette.primary : palette.textSecondary}
          />
          <Text style={styles.todayText}>{doneToday ? t('progress.hero.today') : t('progress.hero.notToday')}</Text>
        </View>
        {doneToday && todaySum.sessions > 0 ? (
          <Text style={styles.todaySummary}>
            {plural(todaySum.sessions, 'progress.hero.todaySummary.one', 'progress.hero.todaySummary.many', {
              h: hours(todaySum.minutes),
            })}
          </Text>
        ) : null}
      </View>

      <Pressable
        style={({ pressed }) => [styles.heroButton, pressed && { opacity: 0.88 }]}
        onPress={onLog}
        accessibilityRole="button">
        <Icon name="plus" size={22} color="#FFFFFF" strokeWidth={2.25} />
        <Text style={styles.heroButtonText}>{doneToday ? t('progress.hero.logAnother') : t('progress.cta')}</Text>
      </Pressable>
    </View>
  );
}

/** Time on the mat and the average session length in the chosen period. */
function Performance({
  entries,
  period,
  today,
  onPress,
}: {
  entries: CheckInEntry[];
  period: Period;
  today: Date;
  onPress: () => void;
}) {
  let from = HISTORY_FROM;
  let to = iso(today);
  if (period === 'week') {
    from = iso(mondayOf(today));
    to = iso(addDays(mondayOf(today), 6));
  } else if (period === 'month') {
    from = iso(new Date(today.getFullYear(), today.getMonth(), 1));
    to = iso(new Date(today.getFullYear(), today.getMonth() + 1, 0));
  }
  const inRange = entries.filter((e) => e.date >= from && e.date <= to);
  const minutes = inRange.reduce((n, e) => n + (e.durationMinutes ?? 0), 0);
  const timed = inRange.filter((e) => e.durationMinutes);
  const avg = timed.length ? Math.round(minutes / timed.length) : 0;
  return (
    <Pressable style={({ pressed }) => [styles.perf, pressed && { opacity: 0.85 }]} onPress={onPress} accessibilityRole="button">
      <View style={styles.perfCell}>
        <Text style={styles.perfValue}>{hours(minutes)}</Text>
        <Text style={styles.perfLabel}>{t('progress.perf.mat')}</Text>
      </View>
      <View style={styles.perfDivider} />
      <View style={styles.perfCell}>
        <Text style={styles.perfValue}>{avg ? `${avg} min` : '—'}</Text>
        <Text style={styles.perfLabel}>{t('progress.perf.avg')}</Text>
      </View>
    </Pressable>
  );
}

/** The most recent session: kind, day and length. */
function LastTraining({ entries, today, onPress }: { entries: CheckInEntry[]; today: Date; onPress: () => void }) {
  const last = [...entries].sort((a, b) => (a.date === b.date ? b.id - a.id : a.date < b.date ? 1 : -1))[0];
  if (!last) {
    return <Text style={styles.muted}>{t('progress.recent.empty')}</Text>;
  }
  const [, m, d] = last.date.split('-').map(Number);
  const rel = relativeDay(last.date, today);
  const dateText = `${d} ${monthShort(m - 1)}`;
  const when = rel === dateText ? rel : `${rel}, ${dateText}`;
  const sub = [when, last.durationMinutes ? `${last.durationMinutes} min` : null].filter(Boolean).join(' · ');
  const type = last.sessionType ?? 'GI';
  const pill = type === 'NOGI' ? 'NO-GI' : type === 'OPEN_MAT' ? 'OPEN' : 'GI';
  const tag = SESSION_TAG[type as keyof typeof SESSION_TAG] ?? SESSION_TAG.GI;
  return (
    <Pressable style={({ pressed }) => [styles.lastRow, pressed && { opacity: 0.8 }]} onPress={onPress} accessibilityRole="button">
      <View style={[styles.pill, { backgroundColor: tag.bg }]}>
        <Text style={[styles.pillText, { color: tag.fg }]}>{pill}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.lastTitle} numberOfLines={1}>
          {last.notes?.trim() ? last.notes.trim() : sessionLabel(last.sessionType)}
        </Text>
        <Text style={styles.lastSub}>{sub}</Text>
      </View>
      <Icon name="chevron-right" size={22} color={palette.textSecondary} />
    </Pressable>
  );
}

/** The next training milestone, as the one goal to chase. */
function NextMilestone({ total }: { total: number }) {
  const next = nextMilestone(total, TRAINING_MILESTONES);
  if (next === null) return null;
  return (
    <View style={styles.goalCard}>
      <View style={styles.goalIcon}>
        <Icon name="flag-outline" size={22} color={palette.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.kicker}>{t('progress.next.kicker')}</Text>
        <Text style={styles.goalText}>{tf('progress.next.trainings', { n: next })}</Text>
        <View style={styles.goalTrack}>
          <View style={[styles.goalFill, { width: `${Math.round(Math.min(1, total / next) * 100)}%` }]} />
        </View>
        <Text style={styles.goalCount}>
          {total} / {next} · {tf('progress.next.left', { n: next - total })}
        </Text>
      </View>
    </View>
  );
}

function ExploreRow({
  icon,
  color,
  title,
  sub,
  onPress,
  last,
}: {
  icon: IconName;
  color: string;
  title: string;
  sub: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <Pressable style={[styles.listRow, !last && styles.listDivider]} onPress={onPress} accessibilityRole="button" accessibilityLabel={title}>
      <View style={[styles.exploreIcon, { backgroundColor: color + '26' }]}>
        <Icon name={icon} size={20} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSub}>{sub}</Text>
      </View>
      <Icon name="chevron-right" size={18} color={palette.textSecondary} />
    </Pressable>
  );
}

function SectionHeader({
  title,
  sub,
  action,
  actionIcon,
  onAction,
}: {
  title: string;
  sub?: string;
  action?: string;
  actionIcon?: IconName;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHead}>
      <View style={{ flex: 1 }}>
        <Text style={styles.section}>{title}</Text>
        {sub ? <Text style={styles.sectionSub}>{sub}</Text> : null}
      </View>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={8} style={styles.sectionAction} accessibilityRole="button">
          {actionIcon ? <Icon name={actionIcon} size={14} color={palette.primary} /> : null}
          <Text style={styles.link}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function GoalModal({
  visible,
  current,
  onClose,
  onSave,
}: {
  visible: boolean;
  current: number;
  onClose: () => void;
  onSave: (goal: number) => void;
}) {
  const [goal, setGoal] = useState(current);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} onShow={() => setGoal(current)}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => undefined}>
          <Text style={styles.modalTitle}>{t('progress.goal.dialogTitle')}</Text>
          <Text style={[styles.muted, { marginBottom: 16 }]}>{t('progress.goal.dialogSub')}</Text>
          <View style={styles.goalChoices}>
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <Pressable
                key={n}
                onPress={() => setGoal(n)}
                style={[styles.goalChoice, n === goal && styles.goalChoiceOn]}
                accessibilityRole="radio"
                accessibilityState={{ selected: n === goal }}>
                <Text style={[styles.goalChoiceText, n === goal && styles.goalChoiceTextOn]}>{n}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.modalActions}>
            <Button mode="text" textColor={palette.textSecondary} onPress={onClose}>
              {t('progress.goal.cancel')}
            </Button>
            <Button mode="contained" onPress={() => onSave(goal)}>
              {t('progress.goal.save')}
            </Button>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function CompetitionModal({ visible, onClose, onSaved }: { visible: boolean; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [placement, setPlacement] = useState('');
  const [date, setDate] = useState(new Date());

  const save = useMutation({
    mutationFn: () => logCompetition({ name: name.trim(), placement: placement ? Number(placement) : undefined, date: iso(date) }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSaved();
      setName('');
      setPlacement('');
      setDate(new Date());
      onClose();
      Alert.alert(t('home.competition.saved'));
    },
  });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => undefined}>
          <Text style={styles.modalTitle}>{t('home.competition.title')}</Text>
          <TextInput mode="outlined" label={t('home.competition.name')} value={name} onChangeText={setName} style={styles.modalInput} />
          <TextInput mode="outlined" label={t('home.competition.placement')} value={placement} onChangeText={setPlacement} keyboardType="number-pad" style={styles.modalInput} />
          <Text style={{ color: palette.textSecondary, fontSize: 12, marginBottom: 6, marginLeft: 2 }}>{t('home.competition.date')}</Text>
          <View style={styles.modalInput}>
            <DateField value={date} onChange={setDate} maximumDate={new Date()} />
          </View>
          <View style={styles.modalActions}>
            <Button mode="text" textColor={palette.textSecondary} onPress={onClose}>
              {t('home.competition.cancel')}
            </Button>
            <Button mode="contained" disabled={name.trim().length === 0 || save.isPending} loading={save.isPending} onPress={() => save.mutate()}>
              {t('home.competition.save')}
            </Button>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = makeStyles(() => ({
  container: { flex: 1, backgroundColor: palette.background },
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 18 },
  screenTitle: { color: palette.textPrimary, fontSize: 32, fontWeight: '800', letterSpacing: -0.5 },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.primary + '55',
    backgroundColor: palette.primary + '14',
  },
  streakPillText: { color: palette.textPrimary, fontSize: 14, fontWeight: '700' },

  segment: { flexDirection: 'row', backgroundColor: palette.surface, borderRadius: 14, padding: 4 },
  segmentItem: { flex: 1, paddingVertical: 11, borderRadius: 10, alignItems: 'center' },
  segmentOn: { backgroundColor: palette.primary + '2E' },
  segmentText: { color: palette.textSecondary, fontSize: 15, fontWeight: '700' },
  segmentTextOn: { color: palette.primary },

  hero: {
    backgroundColor: palette.surface,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: palette.primary + '55',
  },
  heroHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  heroTitle: { color: palette.textPrimary, fontSize: 22, fontWeight: '800' },
  heroRange: { color: palette.textSecondary, fontSize: 14, marginTop: 2 },
  editGoal: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 4 },
  editGoalText: { color: palette.primary, fontSize: 15, fontWeight: '700' },
  countRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 },
  count: { color: palette.textPrimary, fontSize: 52, fontWeight: '800', letterSpacing: -1.5, lineHeight: 58 },
  countLabel: { color: palette.textSecondary, fontSize: 20, fontWeight: '700' },
  countSub: { color: palette.textSecondary, fontSize: 14, marginTop: 2 },
  days: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 18 },
  dayCol: { alignItems: 'center', gap: 8, flex: 1 },
  dayLetter: { color: palette.textSecondary, fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
  dayLetterOn: { color: palette.textPrimary },
  dayDot: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: palette.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  dayDone: { width: 38, height: 38, borderRadius: 19, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center' },
  dayToday: { backgroundColor: 'transparent', borderWidth: 1.5, borderStyle: 'dashed', borderColor: palette.primary },
  heroFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: palette.surfaceVariant,
  },
  todayLabel: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  todayText: { color: palette.textPrimary, fontSize: 15, fontWeight: '700' },
  todaySummary: { color: palette.textSecondary, fontSize: 14 },
  heroButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 14,
    height: 52,
    borderRadius: 14,
    backgroundColor: palette.primary,
  },
  heroButtonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },

  perf: { flexDirection: 'row', alignItems: 'center', backgroundColor: palette.surface, borderRadius: 18, paddingVertical: 18 },
  perfCell: { flex: 1, paddingHorizontal: 18 },
  perfDivider: { width: 1, alignSelf: 'stretch', backgroundColor: palette.surfaceVariant },
  perfValue: { color: palette.textPrimary, fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  perfLabel: { color: palette.textSecondary, fontSize: 14, marginTop: 2 },

  lastRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.surfaceVariant,
  },
  pill: { width: 64, paddingVertical: 4, borderRadius: 6, alignItems: 'center' },
  pillText: { fontSize: 10, fontWeight: 'bold', letterSpacing: 0.5 },
  lastTitle: { color: palette.textPrimary, fontSize: 16, fontWeight: '700' },
  lastSub: { color: palette.textSecondary, fontSize: 14, marginTop: 2 },

  kicker: { color: palette.textSecondary, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  muted: { color: palette.textSecondary, fontSize: 13, marginTop: 2 },

  sectionHead: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 26, marginBottom: 12 },
  section: { color: palette.textPrimary, fontSize: 20, fontWeight: '800' },
  sectionSub: { color: palette.textSecondary, fontSize: 14, marginTop: 2 },
  sectionAction: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  link: { color: palette.primary, fontSize: 13, fontWeight: '600' },
  inlineLink: { color: palette.primary, fontSize: 13, fontWeight: '600', marginTop: 8 },

  card: { backgroundColor: palette.surface, borderRadius: 18, padding: 16 },

  goalCard: { flexDirection: 'row', gap: 14, backgroundColor: palette.surface, borderRadius: 18, padding: 16, marginTop: 22 },
  goalIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: palette.primary + '26', alignItems: 'center', justifyContent: 'center' },
  goalText: { color: palette.textPrimary, fontSize: 15, fontWeight: 'bold', marginTop: 4 },
  goalTrack: { height: 6, borderRadius: 3, backgroundColor: palette.surfaceVariant, overflow: 'hidden', marginTop: 10 },
  goalFill: { height: '100%', borderRadius: 3, backgroundColor: palette.primary },
  goalCount: { color: palette.textSecondary, fontSize: 11, marginTop: 4 },

  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  listDivider: { borderBottomWidth: 1, borderBottomColor: palette.surfaceVariant },
  rowTitle: { color: palette.textPrimary, fontSize: 14, fontWeight: '600' },
  rowSub: { color: palette.textSecondary, fontSize: 12, marginTop: 2 },
  exploreIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

  timelineRow: { flexDirection: 'row', gap: 12 },
  timelineRail: { alignItems: 'center', width: 12 },
  timelineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: palette.primary, marginTop: 5 },
  timelineLine: { flex: 1, width: 2, backgroundColor: palette.surfaceVariant, marginVertical: 2 },
  timelineBody: { flex: 1, paddingBottom: 14 },
  timelineTitle: { color: palette.textPrimary, fontSize: 14, fontWeight: '600' },
  timelineDate: { color: palette.textSecondary, fontSize: 12, marginTop: 2 },

  goalChoices: { flexDirection: 'row', gap: 6, marginBottom: 16 },
  goalChoice: { flex: 1, aspectRatio: 1, borderRadius: 10, backgroundColor: palette.surfaceVariant, alignItems: 'center', justifyContent: 'center' },
  goalChoiceOn: { backgroundColor: palette.primary },
  goalChoiceText: { color: palette.textPrimary, fontSize: 16, fontWeight: 'bold' },
  goalChoiceTextOn: { color: '#fff' },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: palette.surface, borderRadius: 18, padding: 20 },
  modalTitle: { color: palette.textPrimary, fontSize: 16, fontWeight: 'bold', marginBottom: 6 },
  modalInput: { marginBottom: 10, backgroundColor: palette.surface },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 8, marginTop: 4 },
}));
