import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Alert, Image, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TimelineItem, getJourney, logCompetition } from '../api/activity';
import { Stats, createQuickCheckIn, getStats, todayLocalDate } from '../api/checkins';
import { getMyGym } from '../api/gyms';
import { getNotifications } from '../api/notifications';
import { resolveMediaUrl } from '../api/posts';
import { getUserSubmissions } from '../api/submissions';
import { getUserProfile } from '../api/users';
import BeltVisual from '../components/BeltVisual';
import Skeleton from '../components/Skeleton';
import MilestoneBar from '../components/MilestoneBar';
import DateField from '../components/DateField';
import SubmissionBars from '../components/SubmissionBars';
import { rankBarColorFor } from '../constants/belts';
import { SUBMISSIONS } from '../constants/submissions';
import { STREAK_MILESTONES, TRAINING_MILESTONES, WEEK_MILESTONES, nextMilestone } from '../constants/milestones';
import { t, tf } from '../i18n';
import { useAuthStore } from '../store/authStore';
import { makeStyles, palette } from '../theme/theme';

const WEEK_LETTERS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
const localDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

// Mirrors the profile "Métricas" rings so the evolution bars read the same.
const METRIC_COLORS = { streak: palette.primary, trainings: '#E0A82E', weeks: '#2DB6A3' };

// Journey dots cycle this palette by index, so no color repeats within any 6
// consecutive events; a color is only reused after the previous one scrolls past.
const JOURNEY_DOT_COLORS = ['#E63946', '#E0A82E', '#2DB6A3', '#3E63DD', '#8E4EC6', '#F76808'];

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

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

function heroMessage(s: Stats): string {
  if (s.currentStreak === 0) return t('home.hero.start');
  const gap = s.longestStreak - s.currentStreak;
  if (gap <= 0) return s.currentStreak >= s.longestStreak && s.longestStreak > 0
    ? t('home.hero.beyondRecord')
    : t('home.hero.atRecord');
  return gap === 1 ? t('home.hero.toRecord.one') : tf('home.hero.toRecord.many', { n: gap });
}

function nextGoal(s: Stats): string {
  const recordGap = s.longestStreak - s.currentStreak;
  if (s.currentStreak > 0 && recordGap > 0 && recordGap <= 10) {
    return tf('home.nextGoal.record', { n: s.longestStreak });
  }
  const nextTraining = nextMilestone(s.totalCheckIns, TRAINING_MILESTONES);
  if (nextTraining !== null && nextTraining - s.totalCheckIns <= 15) {
    return tf('home.nextGoal.trainingMilestone', { m: nextTraining, n: nextTraining - s.totalCheckIns });
  }
  const nextStreak = nextMilestone(s.currentStreak, STREAK_MILESTONES);
  if (s.currentStreak > 0 && nextStreak !== null && nextStreak - s.currentStreak <= 7) {
    return tf('home.nextGoal.streakMilestone', { m: nextStreak, n: nextStreak - s.currentStreak });
  }
  if (s.currentStreak > 0) return t('home.nextGoal.maintain');
  return t('home.nextGoal.start');
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [compOpen, setCompOpen] = useState(false);

  const stats = useQuery({ queryKey: ['stats'], queryFn: getStats });
  const subMonth = todayLocalDate().slice(0, 7);
  const submissions = useQuery({
    queryKey: ['userSubmissions', user?.id ?? 0, subMonth, 'HIT'],
    queryFn: () => getUserSubmissions(user?.id ?? 0, subMonth, 'HIT'),
    enabled: !!user?.id,
  });
  const gym = useQuery({ queryKey: ['myGym'], queryFn: getMyGym });
  const journey = useQuery({ queryKey: ['journey'], queryFn: getJourney });
  const notifications = useQuery({ queryKey: ['notifications'], queryFn: () => getNotifications() });
  const unread = notifications.data?.unread ?? 0;
  const profile = useQuery({
    queryKey: ['userProfile', user?.id ?? 0],
    queryFn: () => getUserProfile(user!.id),
    enabled: !!user?.id,
  });
  const avatarUrl = profile.data?.avatarUrl ? resolveMediaUrl(profile.data.avatarUrl) : null;

  const checkIn = useMutation({
    mutationFn: createQuickCheckIn,
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['journey'] });
    },
  });

  const s = stats.data;
  const todayIndex = (new Date().getDay() + 6) % 7;
  // Defensive against older/partial backend payloads: never index undefined and
  // never .map something that isn't actually an array (a stale server can answer
  // these routes with a non-JSON body, which axios surfaces as a string).
  const weekDays = Array.isArray(s?.weekDays) ? s.weekDays : [];
  const timelineItems = Array.isArray(journey.data?.timeline) ? journey.data.timeline : [];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
      refreshControl={
        <RefreshControl
          refreshing={stats.isRefetching}
          onRefresh={() => {
            stats.refetch();
            journey.refetch();
          }}
          tintColor={palette.primary}
        />
      }>
      {/* 1. Greeting */}
      <View style={styles.greeting}>
        <Pressable onPress={() => navigation.navigate('Profile')} hitSlop={6}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initialsOf(user?.displayName ?? '')}</Text>
            </View>
          )}
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text variant="titleMedium" style={styles.name}>
            {t('home.greeting')}, {user?.displayName?.split(' ')[0] ?? ''}
          </Text>
          {user?.belt && (
            <View style={styles.greetBeltRow}>
              <View style={styles.greetBelt}>
                <BeltVisual
                  color={user.belt.colorHex}
                  rankBarColor={rankBarColorFor(user.belt.slug)}
                  stripes={user.belt.stripes}
                  height={12}
                />
              </View>
              <Text style={styles.greetMeta} numberOfLines={1}>
                {user.belt.namePt}
                {gym.data ? ` · ${gym.data.name}` : ''}
              </Text>
            </View>
          )}
        </View>
        <Pressable
          onPress={() => navigation.navigate('Comunidade', { screen: 'NotificationCenter' })}
          hitSlop={8}
          style={styles.gearBtn}
          accessibilityLabel={t('feed.notifications')}>
          <MaterialCommunityIcons name="bell-outline" size={22} color={palette.textSecondary} />
          {unread > 0 && <View style={styles.bellDot} />}
        </Pressable>
      </View>

      {!s ? (
        <View style={{ gap: 14 }}>
          <Skeleton height={150} radius={20} />
          <Skeleton height={92} radius={16} />
          <Skeleton height={130} radius={16} />
          <Skeleton height={70} radius={16} />
        </View>
      ) : (
        <>
          {/* 2. Hero Progress Card */}
          <LinearGradient colors={['#3A1014', palette.surface]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
            <View style={styles.heroTop}>
              <View style={styles.heroStreak}>
                <MaterialCommunityIcons name="fire" size={34} color={palette.primary} />
                <Text style={styles.heroNumber}>{s.currentStreak}</Text>
                <View>
                  <Text style={styles.heroDays}>
                    {s.currentStreak === 1 ? t('home.hero.days.one') : t('home.hero.days.many')}
                  </Text>
                  <Text style={styles.heroLabel}>{t('home.hero.label')}</Text>
                </View>
              </View>
              <Text style={styles.heroRecord}>{tf('home.hero.record', { n: s.longestStreak })}</Text>
            </View>

            <Text style={styles.heroMsg}>{heroMessage(s)}</Text>

            {s.longestStreak > 0 && (
              <View style={styles.heroTrack}>
                <View
                  style={[styles.heroFill, { width: `${Math.min(1, s.currentStreak / s.longestStreak) * 100}%` }]}
                />
              </View>
            )}

            <View style={styles.weekRow}>
              {WEEK_LETTERS.map((letter, i) => (
                <View key={i} style={styles.weekDay}>
                  <Text style={[styles.weekLetter, i === todayIndex && styles.weekLetterToday]}>{letter}</Text>
                  <View
                    style={[
                      styles.weekCircle,
                      weekDays[i] && styles.weekCircleDone,
                      i === todayIndex && !weekDays[i] && styles.weekCircleToday,
                    ]}>
                    {weekDays[i] && <MaterialCommunityIcons name="check" size={13} color="#fff" />}
                  </View>
                </View>
              ))}
            </View>
          </LinearGradient>

          {/* 3. Training Action Area — hidden once today's check-in is done; returns next day */}
          {!s.checkedInToday && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('home.action.title')}</Text>
              <Text style={styles.cardSub}>{t('home.action.subtitle')}</Text>
              <Button
                mode="contained"
                icon="plus"
                onPress={() => checkIn.mutate()}
                loading={checkIn.isPending}
                contentStyle={styles.actionBtn}
                style={{ marginTop: 12 }}>
                {t('home.action.button')}
              </Button>
            </View>
          )}

          {/* 4. Progress Overview */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t('home.overview.title')}</Text>
            <View style={{ gap: 16, marginTop: 12 }}>
              <MilestoneBar icon="dumbbell" label={t('home.overview.trainings')} value={s.totalCheckIns} ladder={TRAINING_MILESTONES} color={METRIC_COLORS.trainings} />
              <MilestoneBar icon="fire" label={t('home.overview.streak')} value={s.longestStreak} ladder={STREAK_MILESTONES} color={METRIC_COLORS.streak} />
              <MilestoneBar icon="calendar-check" label={t('home.overview.weeks')} value={s.activeWeeks ?? 0} ladder={WEEK_MILESTONES} color={METRIC_COLORS.weeks} />
            </View>
          </View>

          {/* Técnicas shortcut (Técnicas lives off the tab bar — reached from Início) */}
          <Pressable
            style={[styles.card, { flexDirection: 'row', alignItems: 'center', gap: 14 }]}
            onPress={() => navigation.navigate('Techniques')}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: palette.primary + '26',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <MaterialCommunityIcons name="book-open-variant" size={22} color={palette.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>{t('techniques.card.title')}</Text>
              <Text style={styles.cardSub}>{t('techniques.card.subtitle')}</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={palette.textSecondary} />
          </Pressable>

          {/* Body map shortcut (log pain / injuries on a body diagram) */}
          <Pressable
            style={[styles.card, { flexDirection: 'row', alignItems: 'center', gap: 14 }]}
            onPress={() => navigation.navigate('BodyMap')}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: '#2DB6A326',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <MaterialCommunityIcons name="human-handsup" size={22} color="#2DB6A3" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>{t('body.card.title')}</Text>
              <Text style={styles.cardSub}>{t('body.card.subtitle')}</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={palette.textSecondary} />
          </Pressable>

          {/* Submissions widget → full Submissions screen */}
          <Pressable style={styles.card} onPress={() => navigation.navigate('Submissions', { userId: user?.id })}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>{t('profile.submissions')}</Text>
              <MaterialCommunityIcons name="chevron-right" size={18} color={palette.textSecondary} />
            </View>
            <View style={{ marginTop: 10 }}>
              <SubmissionBars
                items={SUBMISSIONS.map((sb) => ({
                  label: sb.label,
                  color: sb.color,
                  value: submissions.data?.items.find((i) => i.submission === sb.key)?.count ?? 0,
                }))}
                max={5}
              />
            </View>
          </Pressable>

          {/* 4b. Weekly training load + estimated calories */}
          <View style={styles.card}>
            <Pressable style={styles.weekHead} onPress={() => navigation.navigate('Metrics')} hitSlop={6}>
              <Text style={styles.sectionTitle}>{t('home.week.title')}</Text>
              <View style={styles.weekLink}>
                <Text style={styles.link}>{t('metrics.seeAll')}</Text>
                <MaterialCommunityIcons name="chevron-right" size={16} color={palette.primary} />
              </View>
            </Pressable>
            <View style={styles.loadRow}>
              <View style={styles.loadMain}>
                <View style={styles.loadIcon}>
                  <MaterialCommunityIcons name="lightning-bolt" size={20} color={METRIC_COLORS.trainings} />
                </View>
                <View>
                  <Text style={styles.loadValue}>{formatMinutes(s.weeklyMinutes)}</Text>
                  <Text style={styles.loadLabel}>{t('home.week.load')}</Text>
                </View>
              </View>
              <View
                style={[
                  styles.trend,
                  s.weeklyMinutes >= s.lastWeekMinutes ? styles.trendUp : styles.trendDown,
                ]}>
                <MaterialCommunityIcons
                  name={
                    s.weeklyMinutes === s.lastWeekMinutes
                      ? 'minus'
                      : s.weeklyMinutes > s.lastWeekMinutes
                        ? 'arrow-up'
                        : 'arrow-down'
                  }
                  size={13}
                  color={s.weeklyMinutes >= s.lastWeekMinutes ? '#16A34A' : '#E5484D'}
                />
                <Text style={[styles.trendText, { color: s.weeklyMinutes >= s.lastWeekMinutes ? '#16A34A' : '#E5484D' }]}>
                  {s.weeklyMinutes === s.lastWeekMinutes
                    ? t('home.week.same')
                    : `${Math.abs(s.weeklyMinutes - s.lastWeekMinutes)}min`}
                </Text>
              </View>
            </View>
            {s.weeklyCalories != null && (
              <View style={styles.calRow}>
                <MaterialCommunityIcons name="fire" size={16} color={palette.primary} />
                <Text style={styles.calText}>{tf('home.week.calories', { n: s.weeklyCalories })}</Text>
              </View>
            )}
          </View>

          {/* 5. Next Goal */}
          <View style={[styles.card, styles.goalCard]}>
            <MaterialCommunityIcons name="target" size={24} color={palette.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.goalLabel}>{t('home.nextGoal.title')}</Text>
              <Text style={styles.goalText}>{nextGoal(s)}</Text>
            </View>
          </View>

          {/* Journey Timeline */}
          <View>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>{t('home.timeline.title')}</Text>
              <Pressable onPress={() => setCompOpen(true)} hitSlop={6}>
                <Text style={styles.link}>{t('home.competition.cta')}</Text>
              </Pressable>
            </View>
            <View style={styles.card}>
              {timelineItems.length === 0 ? (
                <Text style={styles.cardSub}>{t('home.timeline.empty')}</Text>
              ) : (
                timelineItems.slice(0, 6).map((item, i, arr) => (
                  <Animated.View key={i} entering={FadeInDown.duration(260).delay(i * 50)} style={styles.timelineRow}>
                    <View style={styles.timelineRail}>
                      <View
                        style={[styles.timelineDot, { backgroundColor: JOURNEY_DOT_COLORS[i % JOURNEY_DOT_COLORS.length] }]}
                      />
                      {i < arr.length - 1 && <View style={styles.timelineLine} />}
                    </View>
                    <View style={styles.timelineBody}>
                      <Text style={styles.timelineTitle}>{timelineText(item)}</Text>
                      <Text style={styles.timelineDate}>{eventDate(item.occurredAt)}</Text>
                    </View>
                  </Animated.View>
                ))
              )}
            </View>
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
  content: { paddingHorizontal: 20, paddingBottom: 32, gap: 14 },
  greeting: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  gearBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: palette.surface, alignItems: 'center', justifyContent: 'center' },
  bellDot: { position: 'absolute', top: 9, right: 9, width: 9, height: 9, borderRadius: 5, backgroundColor: palette.primary, borderWidth: 1.5, borderColor: palette.surface },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: palette.surfaceVariant, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: palette.textPrimary, fontWeight: 'bold', fontSize: 15 },
  name: { color: palette.textPrimary, fontWeight: 'bold' },
  greetBeltRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 },
  greetBelt: { width: 40 },
  greetMeta: { color: palette.textSecondary, fontSize: 12, flex: 1 },
  loading: { paddingVertical: 48 },

  hero: { borderRadius: 20, padding: 18, gap: 14 },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  heroStreak: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroNumber: { color: palette.textPrimary, fontSize: 46, fontWeight: 'bold', lineHeight: 50 },
  heroDays: { color: palette.textPrimary, fontSize: 14, fontWeight: 'bold' },
  heroLabel: { color: palette.textSecondary, fontSize: 11 },
  heroRecord: { color: palette.textSecondary, fontSize: 12, marginTop: 6 },
  heroMsg: { color: '#F4F4F5', fontSize: 13, fontWeight: '600' },
  heroTrack: { height: 8, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' },
  heroFill: { height: '100%', borderRadius: 999, backgroundColor: palette.primary },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
  weekDay: { alignItems: 'center', gap: 4 },
  weekLetter: { color: palette.textSecondary, fontSize: 10 },
  weekLetterToday: { color: palette.textPrimary, fontWeight: 'bold' },
  weekCircle: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  weekCircleDone: { backgroundColor: palette.primary },
  weekCircleToday: { borderWidth: 2, borderColor: palette.primary },

  card: { backgroundColor: palette.surface, borderRadius: 16, padding: 16 },
  cardTitle: { color: palette.textPrimary, fontWeight: 'bold', fontSize: 15 },
  cardSub: { color: palette.textSecondary, fontSize: 12, marginTop: 3 },
  actionBtn: { paddingVertical: 4 },
  doneCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: palette.primary },
  againLink: { color: palette.textSecondary, fontSize: 12 },

  sectionTitle: { color: palette.textPrimary, fontWeight: 'bold', fontSize: 14 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  link: { color: palette.primary, fontSize: 12, fontWeight: '600' },

  weekHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  weekLink: { flexDirection: 'row', alignItems: 'center' },
  loadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  loadMain: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  loadIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: palette.surfaceVariant, alignItems: 'center', justifyContent: 'center' },
  loadValue: { color: palette.textPrimary, fontSize: 22, fontWeight: 'bold' },
  loadLabel: { color: palette.textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  trend: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  trendUp: { backgroundColor: 'rgba(22,163,74,0.15)' },
  trendDown: { backgroundColor: 'rgba(229,72,77,0.15)' },
  trendText: { fontSize: 12, fontWeight: '700' },
  calRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.surfaceVariant },
  calText: { color: palette.textSecondary, fontSize: 13 },

  goalCard: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  goalLabel: { color: palette.textSecondary, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  goalText: { color: palette.textPrimary, fontSize: 14, fontWeight: 'bold', marginTop: 3 },

  activityRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  activityDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.surfaceVariant },
  activityText: { color: '#E4E4E7', fontSize: 12, flex: 1, lineHeight: 16 },
  activityTime: { color: palette.textSecondary, fontSize: 10 },

  beltRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 12 },
  beltVisual: { width: 90 },
  beltName: { color: palette.textPrimary, fontSize: 15, fontWeight: 'bold' },
  beltMeta: { color: palette.textSecondary, fontSize: 12, marginTop: 2 },

  timelineRow: { flexDirection: 'row', gap: 12 },
  timelineRail: { alignItems: 'center', width: 14 },
  timelineDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: palette.primary, marginTop: 3 },
  timelineLine: { flex: 1, width: 2, backgroundColor: palette.surfaceVariant, marginVertical: 2 },
  timelineBody: { flex: 1, paddingBottom: 16 },
  timelineTitle: { color: palette.textPrimary, fontSize: 13, fontWeight: '600' },
  timelineDate: { color: palette.textSecondary, fontSize: 11, marginTop: 2 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: palette.surface, borderRadius: 18, padding: 20 },
  modalTitle: { color: palette.textPrimary, fontSize: 16, fontWeight: 'bold', marginBottom: 14 },
  modalInput: { marginBottom: 10, backgroundColor: palette.surface },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 8, marginTop: 4 },
}));
