import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Text } from 'react-native-paper';

import { todayLocalDate } from '../../api/checkins';
import { AgendaOccurrence, SESSION_LABEL, getAgenda } from '../../api/classes';
import { Gym } from '../../api/gyms';
import { SESSION_TAG, addDays } from '../../constants/classes';
import { t, tf } from '../../i18n';
import { GymStackParamList } from '../../navigation/GymNavigator';
import { makeStyles, palette } from '../../theme/theme';
import { dayHeader } from '../../utils/time';

type Nav = NativeStackNavigationProp<GymStackParamList>;

const RANGE_DAYS = 14;
const DAY_LETTER = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

function dayNumber(iso: string): number {
  return new Date(`${iso}T00:00:00`).getDate();
}

function dayLetter(iso: string): string {
  return DAY_LETTER[new Date(`${iso}T00:00:00`).getDay()];
}

function ClassRow({ occ, onPress }: { occ: AgendaOccurrence; onPress: () => void }) {
  const tag = SESSION_TAG[occ.sessionType];
  return (
    <Pressable style={[styles.row, !occ.eligible && styles.rowDim]} onPress={onPress}>
      <View style={{ flex: 1 }}>
        <View style={styles.rowTop}>
          <Text style={styles.time}>
            {occ.startTime} – {occ.endTime}
          </Text>
          <View style={[styles.tag, { backgroundColor: tag.bg }]}>
            <Text style={[styles.tagText, { color: tag.fg }]}>{SESSION_LABEL[occ.sessionType]}</Text>
          </View>
          {occ.canCheckIn && (
            <View style={styles.openChip}>
              <Text style={styles.openChipText}>{t('agenda.openNow')}</Text>
            </View>
          )}
        </View>
        <Text style={styles.sub}>
          {[occ.name, occ.instructorName].filter(Boolean).join(' · ')}
        </Text>
        <View style={styles.metaRow}>
          {occ.restrictionLabel && (
            <View style={styles.restrict}>
              <MaterialCommunityIcons name="lock" size={9} color={palette.textSecondary} />
              <Text style={styles.metaText}>{occ.restrictionLabel}</Text>
            </View>
          )}
          {occ.attendeeCount > 0 && (
            <View style={styles.restrict}>
              <MaterialCommunityIcons name="account-group" size={10} color={palette.textSecondary} />
              <Text style={styles.metaText}>{tf('agenda.attendeesCount', { n: occ.attendeeCount })}</Text>
            </View>
          )}
        </View>
      </View>
      {occ.checkedIn ? (
        <View style={styles.stateDone}>
          <MaterialCommunityIcons name="check-circle" size={14} color="#4ADE80" />
          <Text style={styles.stateDoneText}>{t('agenda.checkinDone')}</Text>
        </View>
      ) : occ.reserved ? (
        <View style={styles.stateLocked}>
          <MaterialCommunityIcons name="clock-check-outline" size={13} color={palette.textPrimary} />
          <Text style={styles.stateReservedText}>{t('agenda.reserved')}</Text>
        </View>
      ) : !occ.eligible ? (
        <View style={styles.stateLocked}>
          <MaterialCommunityIcons name="lock" size={13} color={palette.textSecondary} />
          <Text style={styles.stateLockedText}>{t('agenda.restricted')}</Text>
        </View>
      ) : (
        <MaterialCommunityIcons name="chevron-right" size={20} color={palette.textSecondary} />
      )}
    </Pressable>
  );
}

export default function AgendaScreen({ gym }: { gym: Gym }) {
  const navigation = useNavigation<Nav>();
  const staff = gym.role === 'OWNER' || gym.role === 'INSTRUCTOR';
  const today = todayLocalDate();
  const [selected, setSelected] = useState(today);

  const agenda = useQuery({
    queryKey: ['agenda'],
    queryFn: () => getAgenda(today, addDays(today, RANGE_DAYS - 1)),
  });

  const days = useMemo(
    () => Array.from({ length: RANGE_DAYS }, (_, i) => addDays(today, i)),
    [today],
  );
  const byDay = useMemo(() => {
    const map = new Map<string, AgendaOccurrence[]>();
    for (const occ of agenda.data ?? []) {
      const list = map.get(occ.date) ?? [];
      list.push(occ);
      map.set(occ.date, list);
    }
    return map;
  }, [agenda.data]);

  if (agenda.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  const dayItems = byDay.get(selected) ?? [];
  const hasAnyClass = (agenda.data?.length ?? 0) > 0;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.strip}
        contentContainerStyle={styles.stripContent}>
        {days.map((d) => {
          const isSelected = d === selected;
          const hasClasses = (byDay.get(d)?.length ?? 0) > 0;
          return (
            <Pressable key={d} style={styles.dayChip} onPress={() => setSelected(d)}>
              <Text style={[styles.dayChipLetter, isSelected && styles.dayChipLetterOn]}>
                {dayLetter(d)}
              </Text>
              <View style={[styles.dayChipCircle, isSelected && styles.dayChipCircleOn]}>
                <Text style={[styles.dayChipNum, isSelected && styles.dayChipNumOn]}>
                  {dayNumber(d)}
                </Text>
              </View>
              <View style={[styles.dayDot, hasClasses && styles.dayDotOn]} />
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={agenda.isRefetching}
            onRefresh={() => agenda.refetch()}
            tintColor={palette.primary}
          />
        }>
        {staff && (
          <Button
            mode="outlined"
            icon="plus"
            textColor={palette.primary}
            style={styles.add}
            onPress={() => navigation.navigate('CreateClass')}>
            {t('agenda.addClass')}
          </Button>
        )}

        <Text style={styles.dayHeader}>{dayHeader(selected)}</Text>

        {dayItems.length === 0 ? (
          <Text style={styles.empty}>
            {hasAnyClass ? t('agenda.day.empty') : t('agenda.empty')}
          </Text>
        ) : (
          dayItems.map((occ) => (
            <ClassRow
              key={`${occ.classId}-${occ.date}`}
              occ={occ}
              onPress={() => navigation.navigate('ClassDetail', { occurrence: occ })}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = makeStyles(() => ({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  strip: { flexGrow: 0, marginBottom: 12 },
  stripContent: { gap: 6, paddingRight: 12 },
  dayChip: { alignItems: 'center', width: 40 },
  dayChipLetter: { color: palette.textSecondary, fontSize: 10, marginBottom: 4 },
  dayChipLetterOn: { color: palette.textPrimary, fontWeight: 'bold' },
  dayChipCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayChipCircleOn: { backgroundColor: palette.primary },
  dayChipNum: { color: palette.textSecondary, fontSize: 13 },
  dayChipNumOn: { color: '#fff', fontWeight: 'bold' },
  dayDot: { width: 4, height: 4, borderRadius: 2, marginTop: 4, backgroundColor: 'transparent' },
  dayDotOn: { backgroundColor: palette.primary },
  content: { paddingBottom: 24 },
  add: { borderColor: palette.primary, marginBottom: 14 },
  dayHeader: { color: palette.textSecondary, fontSize: 11, marginBottom: 8 },
  empty: { color: palette.textSecondary, textAlign: 'center', paddingVertical: 28 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: palette.surface,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },
  rowDim: { opacity: 0.6 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  time: { color: palette.textPrimary, fontSize: 13, fontWeight: 'bold' },
  tag: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 },
  tagText: { fontSize: 9 },
  openChip: { backgroundColor: '#12231A', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 },
  openChipText: { color: '#4ADE80', fontSize: 9, fontWeight: 'bold' },
  sub: { color: palette.textSecondary, fontSize: 11 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  restrict: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { color: palette.textSecondary, fontSize: 9 },
  stateDone: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  stateDoneText: { color: '#4ADE80', fontSize: 11, fontWeight: 'bold' },
  stateLocked: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  stateLockedText: { color: palette.textSecondary, fontSize: 11 },
  stateReservedText: { color: palette.textPrimary, fontSize: 11, fontWeight: 'bold' },
}));
