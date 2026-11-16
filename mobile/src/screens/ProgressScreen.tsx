import Icon from '../components/Icon';
import { useNavigation } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TimelineItem, getJourney, logCompetition } from '../api/activity';
import { CheckInEntry, Stats, getStats, listCheckIns, setWeeklyGoal, todayLocalDate } from '../api/checkins';
import { getUserSubmissions } from '../api/submissions';
import DateField from '../components/DateField';
import MetricRing from '../components/MetricRing';
import Skeleton from '../components/Skeleton';
import TodayCard from '../components/TodayCard';
import SubmissionBars from '../components/SubmissionBars';
import { SESSION_TAG } from '../constants/classes';
import {
  STREAK_MILESTONES,
  TRAINING_MILESTONES,
  WEEK_MILESTONES,
  milestoneProgress,
  nextMilestone,
} from '../constants/milestones';
import { SUBMISSIONS } from '../constants/submissions';
import { t, tf } from '../i18n';
import { useAuthStore } from '../store/authStore';
import { useCheckInSheet } from '../store/checkInSheetStore';
import { makeStyles, palette } from '../theme/theme';
import {
  addDays,
  hours,
  iso,
  kinds,
  longDate,
  mondayOf,
  monthGrid,
  monthName,
  monthShort,
  parseIso,
  plural,
  rangeLabel,
  relativeDay,
  sessionLabel,
  summarize,
  weekdayInitials,
  weeklyDays,
} from './progress/progressData';

type Period = 'week' | 'month' | 'total';
type IconName = keyof typeof Icon.glyphMap;

// Same colours as before: one per number, so each reads at a glance.
const COLORS = { trainings: '#E0A82E', hours: '#3E63DD', streak: palette.primary, weeks: '#2DB6A3' };
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
 * Sua evolução, read top to bottom: the chosen period (this week against the
 * goal, this month's calendar, or the whole path), one button to log a
 * session, all-time numbers, the next milestone, your game (submissions),
 * recent sessions, where to dig deeper, and your journey.
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
      <Text variant="headlineSmall" style={styles.screenTitle}>
        {t('tabs.progress')}
      </Text>

      {/* Streak + one-tap check-in (moved here from Início when it became Comunidade). */}
      <View style={{ marginBottom: 14 }}>
        <TodayCard stats={stats.data} />
      </View>

      <Segmented value={period} onChange={setPeriod} />

      {!s || history.isLoading ? (
        <View style={{ gap: 14, marginTop: 14 }}>
          <Skeleton height={260} radius={20} />
          <Skeleton height={56} radius={18} />
          <Skeleton height={180} radius={20} />
        </View>
      ) : (
        <>
          <Animated.View key={period} entering={FadeIn.duration(220)}>
            {period === 'week' && <WeekCard stats={s} entries={entries} today={today} onEditGoal={() => setGoalOpen(true)} />}
            {period === 'month' && <MonthCard entries={entries} today={today} />}
            {period === 'total' && <TotalCard stats={s} entries={entries} today={today} />}
          </Animated.View>

          <Button
            mode="contained"
            icon="plus"
            onPress={openSheet}
            style={styles.cta}
            contentStyle={styles.ctaContent}
            labelStyle={styles.ctaLabel}>
            {t('progress.cta')}
          </Button>

          <Numbers stats={s} entries={entries} />
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

          <SectionHeader title={t('progress.recent.title')} />
          <RecentCard entries={entries} today={today} />

          <SectionHeader title={t('progress.explore.title')} />
          <View style={styles.card}>
            <ExploreRow icon="book-open-variant" color={palette.primary} title={t('progress.tools.techniques')} sub={t('progress.explore.techniquesSub')} onPress={() => navigation.navigate('Techniques')} />
            <ExploreRow icon="human-handsup" color={COLORS.weeks} title={t('progress.explore.body')} sub={t('progress.explore.bodySub')} onPress={() => navigation.navigate('BodyMap')} />
            <ExploreRow icon="chart-box-outline" color={COLORS.hours} title={t('progress.tools.metrics')} sub={t('progress.explore.metricsSub')} onPress={() => navigation.navigate('Metrics')} last />
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

function RangeRow({ text, note }: { text: string; note?: string }) {
  return (
    <View style={styles.rangeRow}>
      <Icon name="calendar-blank-outline" size={15} color={palette.textSecondary} />
      <Text style={styles.rangeText}>{text}</Text>
      {note ? <Text style={styles.rangeNote}>· {note}</Text> : null}
    </View>
  );
}

function WeekCard({
  stats,
  entries,
  today,
  onEditGoal,
}: {
  stats: Stats;
  entries: CheckInEntry[];
  today: Date;
  onEditGoal: () => void;
}) {
  const monday = mondayOf(today);
  const sunday = addDays(monday, 6);
  const week = summarize(entries, iso(monday), iso(sunday));
  const goal = Math.max(1, stats.weeklyGoal || 3);
  const pct = Math.min(1, week.days / goal);
  const left = goal - week.days;
  const initials = weekdayInitials();
  const todayIso = iso(today);

  return (
    <>
      <RangeRow text={rangeLabel(monday, sunday)} note={t('progress.range.thisWeek')} />
      <View style={styles.hero}>
        <View style={styles.heroHead}>
          <Text style={styles.kicker}>{t('progress.goal.kicker')}</Text>
          <Pressable onPress={onEditGoal} hitSlop={10} style={styles.editGoal} accessibilityRole="button">
            <Icon name="pencil-outline" size={14} color={palette.textSecondary} />
            <Text style={styles.editGoalText}>{t('progress.goal.edit')}</Text>
          </Pressable>
        </View>
        <View style={styles.goalRow}>
          <MetricRing
            value={`${week.days}/${goal}`}
            progress={pct}
            label=""
            sublabel={t('progress.goal.ringSub')}
            color={palette.primary}
            size={88}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.goalLine}>
              <Text style={styles.big}>{week.days} </Text>
              {tf('progress.goal.daysOf', { goal })}
            </Text>
            <Text style={styles.muted}>
              {left <= 0
                ? t('progress.week.goalDone')
                : left === 1
                  ? t('progress.week.left.one')
                  : tf('progress.week.left.many', { n: left })}
            </Text>
          </View>
        </View>
        <View style={styles.days}>
          {initials.map((letter, i) => {
            const day = iso(addDays(monday, i));
            const done = week.dates.has(day);
            const isToday = day === todayIso;
            return (
              <View key={i} style={styles.dayCol}>
                <Text style={[styles.dayLetter, isToday && styles.dayLetterToday]}>{letter}</Text>
                <View style={[styles.dayDot, done && styles.dayDone, !done && isToday && styles.dayToday]}>
                  {done && <Icon name="check" size={16} color="#fff" strokeWidth={2.5} />}
                </View>
              </View>
            );
          })}
        </View>
        <View style={styles.heroFoot}>
          <Text style={styles.footText}>{tf('progress.goal.footer', { n: week.sessions, h: hours(week.minutes) })}</Text>
          <Text style={styles.footNote}>{t('progress.goal.rule')}</Text>
        </View>
      </View>
    </>
  );
}

function MonthCard({ entries, today }: { entries: CheckInEntry[]; today: Date }) {
  const first = new Date(today.getFullYear(), today.getMonth(), 1);
  const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const month = summarize(entries, iso(first), iso(last));
  const grid = monthGrid(today.getFullYear(), today.getMonth());
  const todayIso = iso(today);
  const name = monthName(today.getMonth());

  return (
    <>
      <RangeRow text={rangeLabel(first, last)} />
      <View style={styles.hero}>
        <Text style={styles.kicker}>{tf('progress.month.kicker', { month: name })}</Text>
        <Text style={[styles.goalLine, { marginTop: 10 }]}>
          <Text style={styles.big}>{month.sessions} </Text>
          {month.days === 1
            ? month.sessions === 1
              ? t('progress.month.oneSession')
              : t('progress.month.inDays.one')
            : tf('progress.month.inDays.many', { d: month.days })}
        </Text>
        <Text style={styles.muted}>{tf('progress.month.mat', { h: hours(month.minutes) })}</Text>
        <View style={styles.calHead}>
          {weekdayInitials().map((l, i) => (
            <Text key={i} style={styles.calHeadText}>
              {l}
            </Text>
          ))}
        </View>
        <View style={styles.calGrid}>
          {grid.map((d, i) => {
            if (!d) return <View key={i} style={styles.calCell} />;
            const day = iso(d);
            const done = month.dates.has(day);
            const future = day > todayIso;
            const isToday = day === todayIso;
            return (
              <View key={i} style={styles.calCell}>
                <View style={[styles.calDay, done && styles.calDone, future && styles.calFuture, !done && isToday && styles.calToday]}>
                  <Text style={[styles.calText, done && styles.calTextDone, future && styles.calTextFuture]}>{d.getDate()}</Text>
                </View>
              </View>
            );
          })}
        </View>
      </View>
    </>
  );
}

function TotalCard({ stats, entries, today }: { stats: Stats; entries: CheckInEntry[]; today: Date }) {
  const firstDate = entries.length ? parseIso(entries[0].date) : null;
  const days = new Set(entries.map((e) => e.date)).size;
  const weeks = weeklyDays(entries, today, 12);
  const goal = Math.max(1, stats.weeklyGoal || 3);
  const top = Math.max(goal, ...weeks.map((w) => w.days), 1);
  const split = kinds(entries);
  const splitTotal = split.gi + split.nogi;
  const CHART = 72;

  return (
    <>
      <RangeRow text={firstDate ? rangeLabel(firstDate, today) : longDate(today)} />
      <View style={styles.hero}>
        <Text style={styles.kicker}>{t('progress.total.kicker')}</Text>
        <Text style={[styles.goalLine, { marginTop: 10 }]}>
          <Text style={styles.big}>{days} </Text>
          {days === 1 ? t('progress.total.days.one') : t('progress.total.days.many')}
        </Text>
        <Text style={styles.muted}>
          {firstDate ? tf('progress.total.since', { date: longDate(firstDate) }) : t('progress.total.none')}
        </Text>

        <View style={[styles.chart, { height: CHART }]}>
          <View style={[styles.goalLineMark, { bottom: (goal / top) * CHART }]} />
          {weeks.map((w, i) => {
            const isNow = i === weeks.length - 1;
            const h = w.days === 0 ? 3 : Math.max(8, (w.days / top) * CHART);
            return (
              <View key={i} style={styles.barSlot}>
                <View
                  style={[
                    styles.bar,
                    { height: h },
                    w.days === 0 && styles.barEmpty,
                    w.days > 0 && { backgroundColor: isNow ? palette.primary : palette.primary + '99' },
                  ]}
                />
              </View>
            );
          })}
        </View>
        <View style={styles.chartLegend}>
          <Text style={styles.legendText}>{`${weeks[0].start.getDate()} ${monthShort(weeks[0].start.getMonth())}`}</Text>
          <Text style={styles.legendText}>{t('progress.total.legend')}</Text>
          <Text style={styles.legendText}>{t('progress.total.thisWeek')}</Text>
        </View>

        {splitTotal > 0 && (
          <View style={styles.split}>
            <View style={styles.splitLabels}>
              <Text style={styles.splitText}>
                {t('checkin.type.GI')} <Text style={styles.splitStrong}>{split.gi}</Text>
              </Text>
              <Text style={styles.splitText}>
                {t('checkin.type.NOGI')} <Text style={styles.splitStrong}>{split.nogi}</Text>
              </Text>
            </View>
            <View style={styles.splitTrack}>
              <View style={[styles.splitFill, { flex: Math.max(split.gi, 0.0001) }]} />
              <View style={{ flex: Math.max(split.nogi, 0.0001) }} />
            </View>
          </View>
        )}
      </View>
    </>
  );
}

function Numbers({ stats, entries }: { stats: Stats; entries: CheckInEntry[] }) {
  const first = entries.length ? parseIso(entries[0].date) : null;
  const timed = entries.filter((e) => e.durationMinutes);
  const avg = timed.length ? Math.round(timed.reduce((n, e) => n + (e.durationMinutes ?? 0), 0) / timed.length) : 0;
  return (
    <>
      <SectionHeader title={t('progress.numbers.title')} sub={t('progress.numbers.since')} />
      <View style={styles.grid}>
        <StatTile
          icon="dumbbell"
          color={COLORS.trainings}
          value={String(stats.totalCheckIns)}
          label={t('progress.numbers.trainings')}
          progress={milestoneProgress(stats.totalCheckIns, TRAINING_MILESTONES)}
          hint={first ? tf('progress.numbers.trainingsHint', { date: `${first.getDate()} ${monthShort(first.getMonth())}` }) : undefined}
        />
        <StatTile
          icon="fire"
          color={COLORS.streak}
          value={plural(stats.currentStreak, 'progress.numbers.days.one', 'progress.numbers.days.many')}
          label={t('progress.numbers.streak')}
          progress={milestoneProgress(stats.currentStreak, STREAK_MILESTONES)}
          hint={tf('progress.numbers.record', { n: stats.longestStreak })}
        />
        <StatTile
          icon="clock-outline"
          color={COLORS.hours}
          value={`${stats.totalHours}h`}
          label={t('progress.numbers.mat')}
          hint={avg ? tf('progress.numbers.matHint', { m: avg }) : undefined}
        />
        <StatTile
          icon="calendar-check"
          color={COLORS.weeks}
          value={String(stats.activeWeeks ?? 0)}
          label={t('progress.numbers.weeks')}
          progress={milestoneProgress(stats.activeWeeks ?? 0, WEEK_MILESTONES)}
          hint={t('progress.numbers.weeksHint')}
        />
      </View>
    </>
  );
}

/** One number, what it means, and how close it is to its next milestone. */
function StatTile({
  icon,
  color,
  value,
  label,
  progress,
  hint,
}: {
  icon: IconName;
  color: string;
  value: string;
  label: string;
  progress?: number;
  hint?: string;
}) {
  return (
    <View style={styles.tile} accessible accessibilityLabel={`${label}: ${value}${hint ? `. ${hint}` : ''}`}>
      <View style={styles.tileTop}>
        <Icon name={icon} size={18} color={color} />
        <Text style={styles.tileLabel} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text style={styles.tileValue}>{value}</Text>
      {progress !== undefined && (
        <View style={styles.tileTrack}>
          <View style={[styles.tileFill, { width: `${Math.round(progress * 100)}%`, backgroundColor: color }]} />
        </View>
      )}
      {hint ? (
        <Text style={styles.tileHint} numberOfLines={1}>
          {hint}
        </Text>
      ) : null}
    </View>
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

function RecentCard({ entries, today }: { entries: CheckInEntry[]; today: Date }) {
  const recent = [...entries].sort((a, b) => (a.date === b.date ? b.id - a.id : a.date < b.date ? 1 : -1)).slice(0, 3);
  if (recent.length === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.muted}>{t('progress.recent.empty')}</Text>
      </View>
    );
  }
  return (
    <View style={styles.card}>
      {recent.map((e, i) => {
        const type = e.sessionType ?? 'GI';
        const pill = type === 'NOGI' ? 'NO-GI' : type === 'OPEN_MAT' ? 'OPEN' : 'GI';
        const tag = SESSION_TAG[type as keyof typeof SESSION_TAG] ?? SESSION_TAG.GI;
        const sub = [relativeDay(e.date, today), e.durationMinutes ? hours(e.durationMinutes) : null].filter(Boolean).join(' · ');
        return (
          <View key={e.id} style={[styles.listRow, i < recent.length - 1 && styles.listDivider]}>
            <View style={[styles.pill, { backgroundColor: tag.bg }]}>
              <Text style={[styles.pillText, { color: tag.fg }]}>{pill}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {e.notes?.trim() ? e.notes.trim() : sessionLabel(type)}
              </Text>
              <Text style={styles.rowSub}>{sub}</Text>
            </View>
          </View>
        );
      })}
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
  screenTitle: { color: palette.textPrimary, fontWeight: 'bold', marginBottom: 16 },

  segment: { flexDirection: 'row', backgroundColor: palette.surface, borderRadius: 14, padding: 4 },
  segmentItem: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center' },
  segmentOn: { backgroundColor: palette.primary + '26' },
  segmentText: { color: palette.textSecondary, fontSize: 14, fontWeight: '600' },
  segmentTextOn: { color: palette.primary },

  rangeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, marginBottom: 10 },
  rangeText: { color: palette.textPrimary, fontSize: 13, fontWeight: '600' },
  rangeNote: { color: palette.textSecondary, fontSize: 13 },

  hero: {
    backgroundColor: palette.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.primary + '40',
  },
  heroHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kicker: { color: palette.textSecondary, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  editGoal: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  editGoalText: { color: palette.primary, fontSize: 13, fontWeight: '600' },
  goalRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 12 },
  goalLine: { color: palette.textSecondary, fontSize: 15, fontWeight: '600' },
  big: { color: palette.textPrimary, fontSize: 26, fontWeight: 'bold' },
  muted: { color: palette.textSecondary, fontSize: 13, marginTop: 2 },
  days: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  dayCol: { alignItems: 'center', gap: 6 },
  dayLetter: { color: palette.textSecondary, fontSize: 11, fontWeight: '600' },
  dayLetterToday: { color: palette.primary },
  dayDot: { width: 32, height: 32, borderRadius: 16, backgroundColor: palette.surfaceVariant, alignItems: 'center', justifyContent: 'center' },
  dayDone: { backgroundColor: palette.primary },
  dayToday: { backgroundColor: 'transparent', borderWidth: 1.5, borderStyle: 'dashed', borderColor: palette.primary },
  heroFoot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: palette.surfaceVariant,
  },
  footText: { color: palette.textPrimary, fontSize: 12, fontWeight: '600' },
  footNote: { color: palette.textSecondary, fontSize: 12 },

  calHead: { flexDirection: 'row', marginTop: 14, marginBottom: 6 },
  calHeadText: { flex: 1, textAlign: 'center', color: palette.textSecondary, fontSize: 11, fontWeight: '600' },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: { width: `${100 / 7}%`, aspectRatio: 1, padding: 3 },
  calDay: { flex: 1, borderRadius: 8, backgroundColor: palette.surfaceVariant, alignItems: 'center', justifyContent: 'center' },
  calDone: { backgroundColor: palette.primary },
  calFuture: { backgroundColor: 'transparent' },
  calToday: { backgroundColor: 'transparent', borderWidth: 1.5, borderStyle: 'dashed', borderColor: palette.primary },
  calText: { color: palette.textPrimary, fontSize: 13, fontWeight: '600' },
  calTextDone: { color: '#fff' },
  calTextFuture: { color: palette.outline },

  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 5, marginTop: 16 },
  goalLineMark: { position: 'absolute', left: 0, right: 0, borderTopWidth: 1, borderStyle: 'dashed', borderColor: palette.textSecondary + '88' },
  barSlot: { flex: 1, justifyContent: 'flex-end' },
  bar: { borderRadius: 4 },
  barEmpty: { backgroundColor: palette.surfaceVariant },
  chartLegend: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  legendText: { color: palette.textSecondary, fontSize: 11 },
  split: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: palette.surfaceVariant, gap: 8 },
  splitLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  splitText: { color: palette.textSecondary, fontSize: 13 },
  splitStrong: { color: palette.textPrimary, fontWeight: '700' },
  splitTrack: { flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: palette.surfaceVariant },
  splitFill: { backgroundColor: SESSION_TAG.GI.fg },

  cta: { marginTop: 14, borderRadius: 14 },
  ctaContent: { height: 50 },
  ctaLabel: { fontSize: 16, fontWeight: 'bold' },

  sectionHead: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 24, marginBottom: 10 },
  section: { color: palette.textPrimary, fontSize: 16, fontWeight: 'bold' },
  sectionSub: { color: palette.textSecondary, fontSize: 12, marginTop: 2 },
  sectionAction: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  link: { color: palette.primary, fontSize: 13, fontWeight: '600' },
  inlineLink: { color: palette.primary, fontSize: 13, fontWeight: '600', marginTop: 8 },

  card: { backgroundColor: palette.surface, borderRadius: 18, padding: 16 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { flexBasis: '47%', flexGrow: 1, backgroundColor: palette.surface, borderRadius: 16, padding: 14, gap: 6 },
  tileTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tileLabel: { color: palette.textSecondary, fontSize: 12, fontWeight: '600', flexShrink: 1 },
  tileValue: { color: palette.textPrimary, fontSize: 26, fontWeight: 'bold' },
  tileTrack: { height: 5, borderRadius: 3, backgroundColor: palette.surfaceVariant, overflow: 'hidden' },
  tileFill: { height: '100%', borderRadius: 3 },
  tileHint: { color: palette.textSecondary, fontSize: 11 },

  goalCard: { flexDirection: 'row', gap: 14, backgroundColor: palette.surface, borderRadius: 18, padding: 16, marginTop: 10 },
  goalIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: palette.primary + '26', alignItems: 'center', justifyContent: 'center' },
  goalText: { color: palette.textPrimary, fontSize: 15, fontWeight: 'bold', marginTop: 4 },
  goalTrack: { height: 6, borderRadius: 3, backgroundColor: palette.surfaceVariant, overflow: 'hidden', marginTop: 10 },
  goalFill: { height: '100%', borderRadius: 3, backgroundColor: palette.primary },
  goalCount: { color: palette.textSecondary, fontSize: 11, marginTop: 4 },

  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  listDivider: { borderBottomWidth: 1, borderBottomColor: palette.surfaceVariant },
  rowTitle: { color: palette.textPrimary, fontSize: 14, fontWeight: '600' },
  rowSub: { color: palette.textSecondary, fontSize: 12, marginTop: 2 },
  pill: { width: 64, paddingVertical: 4, borderRadius: 6, alignItems: 'center' },
  pillText: { fontSize: 10, fontWeight: 'bold', letterSpacing: 0.5 },
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
