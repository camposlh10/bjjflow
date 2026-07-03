import { MaterialCommunityIcons } from '@expo/vector-icons';
import { RouteProp, useRoute } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import { todayLocalDate } from '../api/checkins';
import { SubmissionDirection, getUserSubmissions } from '../api/submissions';
import CheckInSheet from '../components/CheckInSheet';
import Skeleton from '../components/Skeleton';
import SubmissionColumns from '../components/SubmissionColumns';
import { submissionStyle } from '../constants/submissions';
import { t } from '../i18n';
import { useAuthStore } from '../store/authStore';
import { makeStyles, palette } from '../theme/theme';
import { formatMonthYear } from '../utils/time';

function addMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function SubmissionsScreen() {
  const route = useRoute<RouteProp<Record<string, { userId?: number } | undefined>, string>>();
  const me = useAuthStore((s) => s.user);
  const targetId = route.params?.userId ?? me?.id ?? 0;
  const isMe = targetId === (me?.id ?? 0);
  const thisMonth = todayLocalDate().slice(0, 7);

  const [month, setMonth] = useState(thisMonth);
  const [direction, setDirection] = useState<SubmissionDirection>('HIT');
  const [checkInOpen, setCheckInOpen] = useState(false);

  const stats = useQuery({
    queryKey: ['userSubmissions', targetId, month, direction],
    queryFn: () => getUserSubmissions(targetId, month, direction),
  });

  const items = stats.data?.items ?? [];
  const maxCount = items[0]?.count ?? 1;
  const canNext = month < thisMonth;

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Month selector */}
        <View style={styles.monthRow}>
          <Pressable style={styles.monthBtn} onPress={() => setMonth((m) => addMonth(m, -1))} hitSlop={8}>
            <MaterialCommunityIcons name="chevron-left" size={24} color={palette.textPrimary} />
          </Pressable>
          <Text style={styles.monthLabel}>{formatMonthYear(`${month}-01`)}</Text>
          <Pressable
            style={[styles.monthBtn, !canNext && styles.monthBtnOff]}
            disabled={!canNext}
            onPress={() => setMonth((m) => addMonth(m, 1))}
            hitSlop={8}>
            <MaterialCommunityIcons name="chevron-right" size={24} color={canNext ? palette.textPrimary : palette.outline} />
          </Pressable>
        </View>

        {/* Direction toggle */}
        <View style={styles.seg}>
          <Pressable style={[styles.segBtn, direction === 'HIT' && styles.segBtnOn]} onPress={() => setDirection('HIT')}>
            <Text style={[styles.segText, direction === 'HIT' && styles.segTextOn]}>{t('submissions.hit')}</Text>
          </Pressable>
          <Pressable
            style={[styles.segBtn, direction === 'CONCEDED' && styles.segBtnOn]}
            onPress={() => setDirection('CONCEDED')}>
            <Text style={[styles.segText, direction === 'CONCEDED' && styles.segTextOn]}>{t('submissions.conceded')}</Text>
          </Pressable>
        </View>

        {stats.isLoading ? (
          <View style={styles.loading}>
            <Skeleton height={16} style={{ marginTop: 8 }} />
            <Skeleton width="80%" height={16} style={{ marginTop: 12 }} />
            <Skeleton width="65%" height={16} style={{ marginTop: 12 }} />
            <Skeleton width="50%" height={16} style={{ marginTop: 12 }} />
          </View>
        ) : (
          <>
            <SubmissionColumns
              items={items.map((it) => ({
                label: submissionStyle(it.submission).label,
                value: it.count,
                color: submissionStyle(it.submission).color,
              }))}
            />

            {items.length === 0 ? (
              <Text style={styles.empty}>{t('submissions.empty')}</Text>
            ) : (
              <View style={styles.list}>
                {items.map((it) => {
                  const s = submissionStyle(it.submission);
                  return (
                    <View key={it.submission} style={styles.row}>
                      <View style={[styles.dot, { backgroundColor: s.color }]} />
                      <View style={{ flex: 1 }}>
                        <View style={styles.rowHead}>
                          <Text style={styles.rowName}>{s.label}</Text>
                          <Text style={styles.rowCount}>{it.count}</Text>
                        </View>
                        <View style={styles.track}>
                          <View
                            style={[styles.fill, { width: `${(it.count / maxCount) * 100}%`, backgroundColor: s.color }]}
                          />
                        </View>
                        <Text style={styles.rowPct}>{it.percentage}%</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {isMe && (
              <Pressable style={styles.logBtn} onPress={() => setCheckInOpen(true)}>
                <MaterialCommunityIcons name="plus" size={18} color={palette.primary} />
                <Text style={styles.logText}>{t('submissions.log')}</Text>
              </Pressable>
            )}
          </>
        )}
      </ScrollView>
      <CheckInSheet visible={checkInOpen} onClose={() => setCheckInOpen(false)} />
    </>
  );
}

const styles = makeStyles(() => ({
  container: { flex: 1, backgroundColor: palette.background },
  content: { padding: 20, paddingBottom: 40 },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  monthBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthBtnOff: { opacity: 0.4 },
  monthLabel: { color: palette.textPrimary, fontSize: 18, fontWeight: 'bold', textTransform: 'capitalize' },
  seg: { flexDirection: 'row', backgroundColor: palette.surfaceVariant, borderRadius: 10, padding: 3, marginBottom: 16 },
  segBtn: { flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: 'center' },
  segBtnOn: { backgroundColor: palette.surface },
  segText: { color: palette.textSecondary, fontSize: 13, fontWeight: '600' },
  segTextOn: { color: palette.textPrimary },
  loading: { paddingVertical: 60 },
  empty: { color: palette.textSecondary, fontSize: 13, textAlign: 'center', marginTop: 20 },
  list: { marginTop: 8, gap: 14 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  dot: { width: 14, height: 14, borderRadius: 7, marginTop: 3 },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowName: { color: palette.textPrimary, fontSize: 15, fontWeight: 'bold' },
  rowCount: { color: palette.textPrimary, fontSize: 18, fontWeight: '800' },
  track: { height: 6, borderRadius: 999, backgroundColor: palette.surfaceVariant, overflow: 'hidden', marginTop: 6 },
  fill: { height: '100%', borderRadius: 999 },
  rowPct: { color: palette.textSecondary, fontSize: 11, marginTop: 4, alignSelf: 'flex-end' },
  logBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 24,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.outline,
  },
  logText: { color: palette.primary, fontSize: 14, fontWeight: '600' },
}));
