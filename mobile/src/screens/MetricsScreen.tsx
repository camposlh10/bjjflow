import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { Text } from 'react-native-paper';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CheckInEntry, listCheckIns, todayLocalDate } from '../api/checkins';
import Icon from '../components/Icon';
import Skeleton from '../components/Skeleton';
import { t, tf } from '../i18n';
import { makeStyles, palette } from '../theme/theme';
import { addDays, hours, iso, mondayOf, monthShort, relativeDay, sessionLabel, shortRange } from './progress/progressData';

type Range = 7 | 30 | 90 | 365;
const RANGES: Range[] = [7, 30, 90, 365];
const HISTORY_FROM = '2000-01-01';
const CHART_H = 150;

const KIND_COLORS = { GI: palette.primary, NOGI: '#71717A', OPEN_MAT: '#E0A82E' } as const;

type Bucket = { label: string; minutes: number; current: boolean };

const minutesOf = (list: CheckInEntry[]) => list.reduce((n, e) => n + (e.durationMinutes ?? 0), 0);
const between = (list: CheckInEntry[], from: string, to: string) => list.filter((e) => e.date >= from && e.date <= to);
const shortMonth = (m: number) => monthShort(m).replace(/\.$/, '');

/** Bars for the chart: days for a week, weeks for 30 or 90 days, months for a year. */
function buckets(entries: CheckInEntry[], range: Range, today: Date): { unit: 'day' | 'week' | 'month'; items: Bucket[] } {
  if (range === 7) {
    const names = t('progress.weekdaysShort').split(',');
    return {
      unit: 'day',
      items: Array.from({ length: 7 }, (_, i) => {
        const d = addDays(today, i - 6);
        return { label: names[(d.getDay() + 6) % 7], minutes: minutesOf(between(entries, iso(d), iso(d))), current: i === 6 };
      }),
    };
  }
  if (range === 365) {
    return {
      unit: 'month',
      items: Array.from({ length: 12 }, (_, i) => {
        const first = new Date(today.getFullYear(), today.getMonth() - 11 + i, 1);
        const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
        return { label: shortMonth(first.getMonth()).charAt(0).toUpperCase(), minutes: minutesOf(between(entries, iso(first), iso(last))), current: i === 11 };
      }),
    };
  }
  const firstMonday = mondayOf(addDays(today, -(range - 1)));
  const lastMonday = mondayOf(today);
  const count = Math.round((lastMonday.getTime() - firstMonday.getTime()) / (7 * 86_400_000)) + 1;
  const every = count > 8 ? 3 : 1;
  return {
    unit: 'week',
    items: Array.from({ length: count }, (_, i) => {
      const start = addDays(firstMonday, i * 7);
      const show = (count - 1 - i) % every === 0;
      return {
        label: show ? `${start.getDate()} ${shortMonth(start.getMonth())}` : '',
        minutes: minutesOf(between(entries, iso(start), iso(addDays(start, 6)))),
        current: i === count - 1,
      };
    }),
  };
}

/** Whole hours for the axis: 0 up to a round top with at most five lines. */
function axis(maxHours: number): number[] {
  const top = Math.max(1, Math.ceil(maxHours));
  const step = top <= 5 ? 1 : Math.ceil(top / 4);
  const ticks: number[] = [];
  for (let v = 0; v <= top; v += step) ticks.push(v);
  if (ticks[ticks.length - 1] < top) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

function barLabel(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  return `${Math.round(minutes / 60)}h`;
}

/** One bar that grows in from the baseline. */
function Bar({ height, current, frame, label, delay }: { height: number; current: boolean; frame: number; label?: string; delay: number }) {
  const h = useSharedValue(0);
  useEffect(() => {
    h.value = withDelay(delay, withTiming(height, { duration: 520, easing: Easing.out(Easing.cubic) }));
  }, [height, delay, h]);
  const grow = useAnimatedStyle(() => ({ height: h.value }));
  return (
    <View style={styles.barSlot}>
      {current && frame > height && <View style={[styles.barFrame, { height: frame }]} />}
      {label ? (
        <Animated.Text entering={FadeIn.delay(delay + 380)} style={[styles.barValue, { bottom: height + 4 }]}>
          {label}
        </Animated.Text>
      ) : null}
      <Animated.View style={[styles.bar, current && styles.barCurrent, grow]} />
    </View>
  );
}

/**
 * Tempo de tatame: hours on the mat in a chosen period against the period
 * before, sessions and their average length, the volume per day / week /
 * month, the split between Gi, No-Gi and open mat, and the sessions themselves.
 */
export default function MetricsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [range, setRange] = useState<Range>(30);
  const [picking, setPicking] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const today = useMemo(() => new Date(), []);
  const todayIso = todayLocalDate();
  // Same cache entry as Progresso, so opening this screen is instant.
  const history = useQuery({
    queryKey: ['checkins', 'all', todayIso],
    queryFn: () => listCheckIns(HISTORY_FROM, todayIso),
  });
  const entries: CheckInEntry[] = Array.isArray(history.data) ? history.data : [];

  const from = addDays(today, -(range - 1));
  const prevFrom = addDays(today, -(2 * range - 1));
  const prevTo = addDays(today, -range);
  const current = between(entries, iso(from), todayIso);
  const minutes = minutesOf(current);
  const delta = minutes - minutesOf(between(entries, iso(prevFrom), iso(prevTo)));
  const timed = current.filter((e) => e.durationMinutes);
  const avg = timed.length ? Math.round(minutes / timed.length) : 0;

  const chart = buckets(entries, range, today);
  const ticks = axis(Math.max(0, ...chart.items.map((b) => b.minutes / 60)));
  const top = ticks[ticks.length - 1];
  const px = (m: number) => (m / 60 / top) * CHART_H;
  const others = chart.items.filter((b) => !b.current).map((b) => b.minutes);
  const frame = others.length ? px(Math.max(...others)) : 0;
  const showValues = chart.items.length <= 8;
  const gap = chart.items.length > 8 ? 4 : 10;

  const kinds = { GI: 0, NOGI: 0, OPEN_MAT: 0 };
  for (const e of current) {
    const k = e.sessionType === 'NOGI' || e.sessionType === 'OPEN_MAT' ? e.sessionType : 'GI';
    kinds[k] += e.durationMinutes ?? 0;
  }
  const kindList = (Object.keys(kinds) as (keyof typeof kinds)[]).filter((k) => kinds[k] > 0);

  const sessions = [...current].sort((a, b) => (a.date === b.date ? b.id - a.id : a.date < b.date ? 1 : -1));
  const rangeName = (r: Range) => t(`mat.range.${r}` as 'mat.range.30');
  const signedDelta = `${delta > 0 ? '+' : '−'}${hours(Math.abs(delta))}`;

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}
        refreshControl={<RefreshControl refreshing={history.isRefetching} onRefresh={() => history.refetch()} tintColor={palette.primary} />}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={styles.back} accessibilityRole="button">
          <Icon name="chevron-left" size={28} color={palette.textPrimary} strokeWidth={2.25} />
          <Text style={styles.backText}>{t('tabs.progress')}</Text>
        </Pressable>
        <Text style={styles.title}>{t('mat.title')}</Text>

        <Pressable
          style={({ pressed }) => [styles.picker, pressed && { opacity: 0.85 }]}
          onPress={() => setPicking(true)}
          accessibilityRole="button"
          accessibilityLabel={`${t('mat.range.pick')}: ${rangeName(range)}`}>
          <Icon name="calendar-blank-outline" size={24} color={palette.textSecondary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.pickerTitle}>{rangeName(range)}</Text>
            <Text style={styles.pickerSub}>{shortRange(from, today)}</Text>
          </View>
          <Icon name="chevron-down" size={22} color={palette.textSecondary} />
        </Pressable>

        {history.isLoading ? (
          <View style={{ gap: 14, marginTop: 20 }}>
            <Skeleton height={140} radius={18} />
            <Skeleton height={220} radius={18} />
          </View>
        ) : (
          <Animated.View key={range} entering={FadeIn.duration(240)}>
            <Text style={styles.big}>{hours(minutes)}</Text>
            <Text style={styles.bigSub}>{t('mat.onMat')}</Text>
            <View style={[styles.chip, delta > 0 ? styles.chipUp : delta < 0 ? styles.chipDown : styles.chipSame]}>
              <Text style={[styles.chipText, delta > 0 ? styles.chipTextUp : delta < 0 ? styles.chipTextDown : null]}>
                {delta === 0
                  ? t('mat.vs.same')
                  : tf(range === 365 ? 'mat.vs.year' : 'mat.vs.days', { d: signedDelta, n: range })}
              </Text>
            </View>

            <View style={styles.stats}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{current.length}</Text>
                <Text style={styles.statLabel}>{t('mat.trainings')}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={[styles.stat, { paddingLeft: 20 }]}>
                <Text style={styles.statValue}>{avg ? `${avg}min` : '—'}</Text>
                <Text style={styles.statLabel}>{t('mat.avg')}</Text>
              </View>
            </View>

            <Text style={styles.section}>{t(`mat.volume.${chart.unit}` as 'mat.volume.week')}</Text>
            <Text style={styles.sectionSub}>{t('mat.volume.sub')}</Text>
            <View style={styles.chart}>
              <View style={[styles.plot, { height: CHART_H }]}>
                {ticks.map((v) => (
                  <View key={v} style={[styles.gridLine, { bottom: (v / top) * CHART_H }]}>
                    <Text style={styles.gridLabel}>{v}h</Text>
                  </View>
                ))}
                <View style={[styles.bars, { gap }]}>
                  {chart.items.map((b, i) => (
                    <Bar
                      key={i}
                      height={b.minutes > 0 ? Math.max(4, px(b.minutes)) : 0}
                      current={b.current}
                      frame={b.current ? frame : 0}
                      label={showValues && b.minutes > 0 ? barLabel(b.minutes) : undefined}
                      delay={i * 45}
                    />
                  ))}
                </View>
              </View>
              <View style={[styles.xLabels, { gap }]}>
                {chart.items.map((b, i) => (
                  <View key={i} style={styles.xSlot}>
                    <Text style={styles.xLabel} numberOfLines={1}>
                      {b.label}
                    </Text>
                  </View>
                ))}
              </View>
              <Text style={styles.caption}>{t(`mat.current.${chart.unit}` as 'mat.current.week')}</Text>
            </View>

            {kindList.length > 0 && (
              <View style={styles.block}>
                <Text style={styles.section}>{t('mat.how')}</Text>
                <View style={styles.split}>
                  {kindList.map((k) => (
                    <View key={k} style={{ flex: kinds[k], backgroundColor: KIND_COLORS[k] }} />
                  ))}
                </View>
                <View style={styles.legend}>
                  {kindList.map((k) => (
                    <View key={k} style={styles.legendItem}>
                      <View style={[styles.legendSwatch, { backgroundColor: KIND_COLORS[k] }]} />
                      <Text style={styles.legendText}>
                        {sessionLabel(k)} · {hours(kinds[k])}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            <Pressable
              style={styles.historyRow}
              onPress={() => {
                Haptics.selectionAsync();
                setShowHistory((v) => !v);
              }}
              accessibilityRole="button"
              accessibilityState={{ expanded: showHistory }}>
              <Text style={styles.historyText}>{showHistory ? t('mat.historyHide') : t('mat.history')}</Text>
              <Icon name={showHistory ? 'chevron-up' : 'chevron-right'} size={22} color={palette.textSecondary} />
            </Pressable>
            {showHistory &&
              (sessions.length === 0 ? (
                <Text style={styles.empty}>{t('mat.empty')}</Text>
              ) : (
                sessions.map((e, i) => (
                  <Animated.View key={e.id} entering={FadeInDown.delay(Math.min(i, 10) * 30)} style={styles.session}>
                    <View style={[styles.legendSwatch, { backgroundColor: KIND_COLORS[e.sessionType === 'NOGI' || e.sessionType === 'OPEN_MAT' ? e.sessionType : 'GI'] }]} />
                    <Text style={styles.sessionTitle}>
                      {sessionLabel(e.sessionType)} · {e.durationMinutes ? `${e.durationMinutes} min` : t('mat.noTime')}
                    </Text>
                    <Text style={styles.sessionDate}>{relativeDay(e.date, today)}</Text>
                  </Animated.View>
                ))
              ))}

          </Animated.View>
        )}
      </ScrollView>

      <Modal visible={picking} transparent animationType="fade" onRequestClose={() => setPicking(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPicking(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{t('mat.range.pick')}</Text>
            {RANGES.map((r) => (
              <Pressable
                key={r}
                style={styles.option}
                onPress={() => {
                  Haptics.selectionAsync();
                  setRange(r);
                  setShowHistory(false);
                  setPicking(false);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: r === range }}>
                <Text style={[styles.optionText, r === range && styles.optionOn]}>{rangeName(r)}</Text>
                {r === range && <Icon name="check" size={20} color={palette.primary} />}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = makeStyles(() => ({
  screen: { flex: 1, backgroundColor: palette.background },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: -6, alignSelf: 'flex-start', paddingVertical: 6 },
  backText: { color: palette.textPrimary, fontSize: 18, fontWeight: '700' },
  title: { color: palette.textPrimary, fontSize: 34, fontWeight: '800', letterSpacing: -0.5, marginTop: 10, marginBottom: 16 },
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: palette.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.surfaceVariant,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  pickerTitle: { color: palette.textPrimary, fontSize: 17, fontWeight: '700' },
  pickerSub: { color: palette.textSecondary, fontSize: 14, marginTop: 1 },
  big: { color: palette.textPrimary, fontSize: 88, fontWeight: '800', letterSpacing: -3, lineHeight: 96, marginTop: 22 },
  bigSub: { color: palette.textPrimary, fontSize: 26, fontWeight: '800', marginTop: -4 },
  chip: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, marginTop: 10 },
  chipUp: { backgroundColor: '#22C55E22' },
  chipDown: { backgroundColor: palette.primary + '22' },
  chipSame: { backgroundColor: palette.surfaceVariant },
  chipText: { color: palette.textSecondary, fontSize: 14, fontWeight: '700' },
  chipTextUp: { color: '#4ADE80' },
  chipTextDown: { color: palette.primary },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 22,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: palette.surfaceVariant,
  },
  stat: { flex: 1 },
  statDivider: { width: 1, alignSelf: 'stretch', backgroundColor: palette.surfaceVariant },
  statValue: { color: palette.textPrimary, fontSize: 30, fontWeight: '800' },
  statLabel: { color: palette.textSecondary, fontSize: 14, marginTop: 2 },
  section: { color: palette.textPrimary, fontSize: 20, fontWeight: '800', marginTop: 26 },
  sectionSub: { color: palette.textSecondary, fontSize: 14, marginTop: 2 },
  chart: { marginTop: 14 },
  plot: { marginLeft: 30, marginTop: 22 },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: palette.surfaceVariant,
  },
  gridLabel: { position: 'absolute', left: -30, top: -8, width: 26, color: palette.textSecondary, fontSize: 12, textAlign: 'right' },
  bars: { position: 'absolute', left: 6, right: 0, bottom: 0, top: 0, flexDirection: 'row', alignItems: 'flex-end' },
  barSlot: { flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'stretch' },
  bar: { backgroundColor: palette.primary, borderTopLeftRadius: 6, borderTopRightRadius: 6 },
  barCurrent: { backgroundColor: '#F28B93' },
  barFrame: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: palette.primary,
    borderRadius: 6,
  },
  barValue: { position: 'absolute', left: -6, right: -6, textAlign: 'center', color: palette.textPrimary, fontSize: 14, fontWeight: '800' },
  xLabels: { flexDirection: 'row', marginLeft: 36, marginTop: 8, height: 18 },
  // Centred on its bar and allowed wider than it, so dense charts keep whole labels.
  xSlot: { flex: 1, alignItems: 'center' },
  xLabel: { position: 'absolute', width: 64, textAlign: 'center', color: palette.textSecondary, fontSize: 12 },
  caption: { color: palette.textSecondary, fontSize: 13, fontStyle: 'italic', textAlign: 'center', marginTop: 10 },
  block: { borderTopWidth: 1, borderTopColor: palette.surfaceVariant, marginTop: 22 },
  split: { flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden', gap: 2, marginTop: 14 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 22, marginTop: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendSwatch: { width: 14, height: 14, borderRadius: 3 },
  legendText: { color: palette.textPrimary, fontSize: 15 },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 24,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: palette.surfaceVariant,
  },
  historyText: { color: palette.textPrimary, fontSize: 16, fontWeight: '600' },
  empty: { color: palette.textSecondary, fontSize: 14, paddingVertical: 14 },
  session: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.surfaceVariant,
  },
  sessionTitle: { flex: 1, color: palette.textPrimary, fontSize: 14, fontWeight: '600' },
  sessionDate: { color: palette.textSecondary, fontSize: 13 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: palette.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 34 },
  sheetTitle: { color: palette.textSecondary, fontSize: 13, fontWeight: '700', marginBottom: 6 },
  option: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
  optionText: { color: palette.textPrimary, fontSize: 17 },
  optionOn: { color: palette.primary, fontWeight: '700' },
}));
