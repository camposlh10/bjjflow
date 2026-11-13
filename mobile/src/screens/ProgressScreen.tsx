import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Alert, Modal, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TimelineItem, getJourney, logCompetition } from '../api/activity';
import { Stats, getStats, todayLocalDate } from '../api/checkins';
import { getUserSubmissions } from '../api/submissions';
import DateField from '../components/DateField';
import MetricRing from '../components/MetricRing';
import Skeleton from '../components/Skeleton';
import SubmissionBars from '../components/SubmissionBars';
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

const localDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const COLORS = { trainings: '#E0A82E', hours: '#3E63DD', streak: palette.primary, weeks: '#2DB6A3' };
const UP = '#16A34A';
const DOWN = '#E5484D';

function formatMinutes(m: number): string {
  if (!m) return '0min';
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (h === 0) return `${min}min`;
  return min === 0 ? `${h}h` : `${h}h ${min}min`;
}

// Calendar-date label from a UTC-midnight instant (avoids timezone off-by-one).
function eventDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

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

type Goal = { text: string; value: number; target: number; icon: keyof typeof MaterialCommunityIcons.glyphMap };

/** The single most reachable goal right now, with how far along it is. */
function nextGoal(s: Stats): Goal {
  const recordGap = s.longestStreak - s.currentStreak;
  if (s.currentStreak > 0 && recordGap > 0 && recordGap <= 10) {
    return {
      text: tf('home.nextGoal.record', { n: s.longestStreak }),
      value: s.currentStreak,
      target: s.longestStreak,
      icon: 'fire',
    };
  }
  const nextTraining = nextMilestone(s.totalCheckIns, TRAINING_MILESTONES);
  if (nextTraining !== null && nextTraining - s.totalCheckIns <= 15) {
    return {
      text: tf('home.nextGoal.trainingMilestone', { m: nextTraining, n: nextTraining - s.totalCheckIns }),
      value: s.totalCheckIns,
      target: nextTraining,
      icon: 'dumbbell',
    };
  }
  const nextStreak = nextMilestone(s.currentStreak, STREAK_MILESTONES);
  if (s.currentStreak > 0 && nextStreak !== null && nextStreak - s.currentStreak <= 7) {
    return {
      text: tf('home.nextGoal.streakMilestone', { m: nextStreak, n: nextStreak - s.currentStreak }),
      value: s.currentStreak,
      target: nextStreak,
      icon: 'fire',
    };
  }
  const goal = Math.max(1, s.weeklyGoal || 3);
  return {
    text: s.currentStreak > 0 ? t('home.nextGoal.maintain') : t('home.nextGoal.start'),
    value: Math.min(s.weeklyProgress ?? 0, goal),
    target: goal,
    icon: 'target',
  };
}

function weekMessage(s: Stats): string {
  const goal = Math.max(1, s.weeklyGoal || 3);
  const left = goal - (s.weeklyProgress ?? 0);
  if (left <= 0) return t('progress.week.goalDone');
  return left === 1 ? t('progress.week.left.one') : tf('progress.week.left.many', { n: left });
}

/** One number, what it means, and how close it is to the next milestone. */
function StatTile({
  icon,
  color,
  value,
  label,
  progress,
  hint,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  color: string;
  value: string | number;
  label: string;
  progress?: number;
  hint?: string;
}) {
  return (
    <View style={styles.tile} accessible accessibilityLabel={`${label}: ${value}${hint ? `. ${hint}` : ''}`}>
      <View style={styles.tileTop}>
        <MaterialCommunityIcons name={icon} size={18} color={color} />
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

function ToolTile({
  icon,
  color,
  label,
  onPress,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  color: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.tool} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <View style={[styles.toolIcon, { backgroundColor: color + '26' }]}>
        <MaterialCommunityIcons name={icon} size={22} color={color} />
      </View>
      <Text style={styles.toolLabel} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

function milestoneHint(value: number, ladder: number[]): string {
  const next = nextMilestone(value, ladder);
  return next === null ? t('progress.milestone.max') : tf('progress.milestone.next', { n: next - value, m: next });
}

/**
 * Progresso, read top to bottom as a story: how this week is going, your
 * totals and how close each is to its next milestone, the one goal to chase
 * next, your submissions, the tools that feed all this, and your journey.
 */
export default function ProgressScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const openSheet = useCheckInSheet((s) => s.open);
  const [compOpen, setCompOpen] = useState(false);
  const [showAllJourney, setShowAllJourney] = useState(false);

  const stats = useQuery({ queryKey: ['stats'], queryFn: getStats });
  const journey = useQuery({ queryKey: ['journey'], queryFn: getJourney });
  const subMonth = todayLocalDate().slice(0, 7);
  const submissions = useQuery({
    queryKey: ['userSubmissions', user?.id ?? 0, subMonth, 'HIT'],
    queryFn: () => getUserSubmissions(user?.id ?? 0, subMonth, 'HIT'),
    enabled: !!user?.id,
  });

  const s = stats.data;
  const timeline = Array.isArray(journey.data?.timeline) ? journey.data.timeline : [];
  const shownTimeline = showAllJourney ? timeline : timeline.slice(0, 4);
  const subItems = SUBMISSIONS.map((sb) => ({
    label: sb.label,
    color: sb.color,
    value: submissions.data?.items.find((i) => i.submission === sb.key)?.count ?? 0,
  }));
  const hasSubs = subItems.some((i) => i.value > 0);

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
      refreshControl={
        <RefreshControl
          refreshing={stats.isRefetching}
          onRefresh={() => {
            stats.refetch();
            journey.refetch();
            submissions.refetch();
          }}
          tintColor={palette.primary}
        />
      }>
      <Text variant="headlineSmall" style={styles.screenTitle}>
        {t('tabs.progress')}
      </Text>

      {!s ? (
        <View style={{ gap: 14 }}>
          <Skeleton height={150} radius={18} />
          <Skeleton height={190} radius={18} />
          <Skeleton height={80} radius={18} />
        </View>
      ) : (
        <>
          {/* 1. This week: the question people open this tab with. */}
          <Pressable
            style={styles.weekCard}
            onPress={() => navigation.navigate('Metrics')}
            accessibilityRole="button"
            accessibilityHint={t('metrics.seeAll')}>
            <MetricRing
              value={`${s.weeklyProgress ?? 0}/${Math.max(1, s.weeklyGoal || 3)}`}
              progress={Math.min(1, (s.weeklyProgress ?? 0) / Math.max(1, s.weeklyGoal || 3))}
              label=""
              sublabel={t('progress.week.sessions')}
              color={palette.primary}
              size={92}
            />
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={styles.cardKicker}>{t('home.week.title')}</Text>
              <Text style={styles.weekMessage}>{weekMessage(s)}</Text>
              <View style={styles.weekLoadRow}>
                <MaterialCommunityIcons name="timer-outline" size={15} color={palette.textSecondary} />
                <Text style={styles.weekLoad}>{formatMinutes(s.weeklyMinutes)}</Text>
                {s.weeklyMinutes !== s.lastWeekMinutes && (
                  <View style={styles.trend}>
                    <MaterialCommunityIcons
                      name={s.weeklyMinutes > s.lastWeekMinutes ? 'arrow-up' : 'arrow-down'}
                      size={13}
                      color={s.weeklyMinutes > s.lastWeekMinutes ? UP : DOWN}
                    />
                    <Text style={[styles.trendText, { color: s.weeklyMinutes > s.lastWeekMinutes ? UP : DOWN }]}>
                      {tf('progress.week.vsLast', { n: formatMinutes(Math.abs(s.weeklyMinutes - s.lastWeekMinutes)) })}
                    </Text>
                  </View>
                )}
              </View>
              {s.weeklyCalories != null && (
                <Text style={styles.weekCal}>{tf('home.week.calories', { n: s.weeklyCalories })}</Text>
              )}
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={palette.textSecondary} />
          </Pressable>

          {/* 2. Totals, each with progress toward its next milestone. */}
          <Text style={styles.section}>{t('progress.numbers.title')}</Text>
          <View style={styles.grid}>
            <StatTile
              icon="dumbbell"
              color={COLORS.trainings}
              value={s.totalCheckIns}
              label={t('home.overview.trainings')}
              progress={milestoneProgress(s.totalCheckIns, TRAINING_MILESTONES)}
              hint={milestoneHint(s.totalCheckIns, TRAINING_MILESTONES)}
            />
            <StatTile
              icon="fire"
              color={COLORS.streak}
              value={s.currentStreak}
              label={t('progress.numbers.streak')}
              progress={milestoneProgress(s.currentStreak, STREAK_MILESTONES)}
              hint={tf('home.hero.record', { n: s.longestStreak })}
            />
            <StatTile
              icon="clock-outline"
              color={COLORS.hours}
              value={`${s.totalHours}h`}
              label={t('progress.numbers.hours')}
              hint={t('progress.numbers.hoursHint')}
            />
            <StatTile
              icon="calendar-check"
              color={COLORS.weeks}
              value={s.activeWeeks ?? 0}
              label={t('home.overview.weeks')}
              progress={milestoneProgress(s.activeWeeks ?? 0, WEEK_MILESTONES)}
              hint={milestoneHint(s.activeWeeks ?? 0, WEEK_MILESTONES)}
            />
          </View>

          {/* 3. One goal to chase. */}
          {(() => {
            const goal = nextGoal(s);
            return (
              <View style={styles.goalCard}>
                <View style={styles.goalIcon}>
                  <MaterialCommunityIcons name={goal.icon} size={22} color={palette.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardKicker}>{t('home.nextGoal.title')}</Text>
                  <Text style={styles.goalText}>{goal.text}</Text>
                  <View style={styles.goalTrack}>
                    <View
                      style={[
                        styles.goalFill,
                        { width: `${Math.round(Math.min(1, goal.value / Math.max(1, goal.target)) * 100)}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.goalCount}>
                    {goal.value} / {goal.target}
                  </Text>
                </View>
              </View>
            );
          })()}

          {/* 4. Submissions this month. */}
          <View style={styles.sectionRow}>
            <Text style={styles.section}>{t('progress.subs.title')}</Text>
            <Pressable onPress={() => navigation.navigate('Submissions', { userId: user?.id })} hitSlop={8}>
              <Text style={styles.link}>{t('metrics.seeAll')}</Text>
            </Pressable>
          </View>
          <View style={styles.card}>
            {hasSubs ? (
              <SubmissionBars items={subItems} max={4} />
            ) : (
              <View style={styles.emptySubs}>
                <Text style={styles.cardSub}>{t('progress.subs.empty')}</Text>
                <Pressable onPress={openSheet} hitSlop={8} accessibilityRole="button">
                  <Text style={styles.inlineLink}>{t('home.action.button')}</Text>
                </Pressable>
              </View>
            )}
          </View>

          {/* 5. Tools that feed the numbers. */}
          <Text style={styles.section}>{t('progress.tools.title')}</Text>
          <View style={styles.tools}>
            <ToolTile
              icon="book-open-variant"
              color={palette.primary}
              label={t('progress.tools.techniques')}
              onPress={() => navigation.navigate('Techniques')}
            />
            <ToolTile
              icon="human-handsup"
              color="#2DB6A3"
              label={t('progress.tools.body')}
              onPress={() => navigation.navigate('BodyMap')}
            />
            <ToolTile
              icon="chart-box-outline"
              color="#3E63DD"
              label={t('progress.tools.metrics')}
              onPress={() => navigation.navigate('Metrics')}
            />
          </View>

          {/* 6. Journey. */}
          <View style={styles.sectionRow}>
            <Text style={styles.section}>{t('home.timeline.title')}</Text>
            <Pressable onPress={() => setCompOpen(true)} hitSlop={8}>
              <Text style={styles.link}>{t('home.competition.cta')}</Text>
            </Pressable>
          </View>
          <View style={styles.card}>
            {timeline.length === 0 ? (
              <Text style={styles.cardSub}>{t('home.timeline.empty')}</Text>
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
                  <Pressable onPress={() => setShowAllJourney((v) => !v)} hitSlop={8} style={styles.moreBtn}>
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

      <CompetitionModal
        visible={compOpen}
        onClose={() => setCompOpen(false)}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ['journey'] });
        }}
      />
    </ScrollView>
  );
}

function CompetitionModal({
  visible,
  onClose,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [placement, setPlacement] = useState('');
  const [date, setDate] = useState(new Date());

  const save = useMutation({
    mutationFn: () =>
      logCompetition({ name: name.trim(), placement: placement ? Number(placement) : undefined, date: localDate(date) }),
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
            <Button
              mode="contained"
              disabled={name.trim().length === 0 || save.isPending}
              loading={save.isPending}
              onPress={() => save.mutate()}>
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
  card: { backgroundColor: palette.surface, borderRadius: 18, padding: 16 },
  cardKicker: { color: palette.textSecondary, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  cardSub: { color: palette.textSecondary, fontSize: 13 },
  section: { color: palette.textPrimary, fontSize: 16, fontWeight: 'bold', marginTop: 24, marginBottom: 10 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  link: { color: palette.primary, fontSize: 13, fontWeight: '600', marginTop: 24, marginBottom: 10 },
  inlineLink: { color: palette.primary, fontSize: 13, fontWeight: '600', marginTop: 8 },

  weekCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: palette.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.primary + '40',
  },
  weekMessage: { color: palette.textPrimary, fontSize: 16, fontWeight: 'bold' },
  weekLoadRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  weekLoad: { color: palette.textPrimary, fontSize: 14, fontWeight: '600' },
  trend: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  trendText: { fontSize: 12, fontWeight: '600' },
  weekCal: { color: palette.textSecondary, fontSize: 12 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { flexBasis: '47%', flexGrow: 1, backgroundColor: palette.surface, borderRadius: 16, padding: 14, gap: 6 },
  tileTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tileLabel: { color: palette.textSecondary, fontSize: 12, fontWeight: '600', flexShrink: 1 },
  tileValue: { color: palette.textPrimary, fontSize: 26, fontWeight: 'bold' },
  tileTrack: { height: 5, borderRadius: 3, backgroundColor: palette.surfaceVariant, overflow: 'hidden' },
  tileFill: { height: '100%', borderRadius: 3 },
  tileHint: { color: palette.textSecondary, fontSize: 11 },

  goalCard: {
    flexDirection: 'row',
    gap: 14,
    backgroundColor: palette.surface,
    borderRadius: 18,
    padding: 16,
    marginTop: 10,
  },
  goalIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: palette.primary + '26',
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalText: { color: palette.textPrimary, fontSize: 15, fontWeight: 'bold', marginTop: 4 },
  goalTrack: { height: 6, borderRadius: 3, backgroundColor: palette.surfaceVariant, overflow: 'hidden', marginTop: 10 },
  goalFill: { height: '100%', borderRadius: 3, backgroundColor: palette.primary },
  goalCount: { color: palette.textSecondary, fontSize: 11, marginTop: 4 },

  emptySubs: { alignItems: 'flex-start', gap: 0 },

  tools: { flexDirection: 'row', gap: 10 },
  tool: { flex: 1, backgroundColor: palette.surface, borderRadius: 16, padding: 14, gap: 10, minHeight: 96 },
  toolIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  toolLabel: { color: palette.textPrimary, fontSize: 13, fontWeight: '600' },

  timelineRow: { flexDirection: 'row', gap: 12 },
  timelineRail: { alignItems: 'center', width: 12 },
  timelineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: palette.primary, marginTop: 5 },
  timelineLine: { flex: 1, width: 2, backgroundColor: palette.surfaceVariant, marginVertical: 2 },
  timelineBody: { flex: 1, paddingBottom: 14 },
  timelineTitle: { color: palette.textPrimary, fontSize: 14, fontWeight: '600' },
  timelineDate: { color: palette.textSecondary, fontSize: 12, marginTop: 2 },
  moreBtn: { alignSelf: 'flex-start' },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: palette.surface, borderRadius: 18, padding: 20 },
  modalTitle: { color: palette.textPrimary, fontSize: 16, fontWeight: 'bold', marginBottom: 14 },
  modalInput: { marginBottom: 10, backgroundColor: palette.surface },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 8, marginTop: 4 },
}));
