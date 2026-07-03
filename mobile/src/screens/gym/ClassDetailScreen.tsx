import { MaterialCommunityIcons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Text } from 'react-native-paper';

import { apiErrorMessage } from '../../api/auth';
import { getStats } from '../../api/checkins';
import {
  Attendee,
  SESSION_LABEL,
  checkInClass,
  deleteClass,
  getAttendees,
  reserveClass,
} from '../../api/classes';
import { getMyGym } from '../../api/gyms';
import BeltVisual from '../../components/BeltVisual';
import { SESSION_TAG } from '../../constants/classes';
import { rankBarColorFor } from '../../constants/belts';
import { t, tf } from '../../i18n';
import { GymStackParamList } from '../../navigation/GymNavigator';
import { makeStyles, palette } from '../../theme/theme';
import { dayHeader } from '../../utils/time';

type Props = NativeStackScreenProps<GymStackParamList, 'ClassDetail'>;

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export default function ClassDetailScreen({ route, navigation }: Props) {
  const { occurrence } = route.params;
  const [occ, setOcc] = useState(occurrence);
  const [successStreak, setSuccessStreak] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const gym = useQuery({ queryKey: ['myGym'], queryFn: getMyGym });
  const staff = gym.data ? gym.data.role !== 'MEMBER' : false;

  const attendees = useQuery({
    queryKey: ['attendees', occ.classId, occ.date],
    queryFn: () => getAttendees(occ.classId, occ.date),
  });

  const checkIn = useMutation({
    mutationFn: () => checkInClass(occ.classId, occ.date),
    onSuccess: async (updated) => {
      setOcc(updated);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ['agenda'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['attendees', occ.classId, occ.date] });
      try {
        const stats = await getStats();
        setSuccessStreak(stats.currentStreak);
      } catch {
        setSuccessStreak(0);
      }
    },
    onError: (e) => Alert.alert(apiErrorMessage(e)),
  });

  const reserve = useMutation({
    mutationFn: () => reserveClass(occ.classId, occ.date),
    onSuccess: (updated) => {
      Haptics.selectionAsync();
      setOcc(updated);
      queryClient.invalidateQueries({ queryKey: ['agenda'] });
      queryClient.invalidateQueries({ queryKey: ['attendees', occ.classId, occ.date] });
    },
    onError: (e) => Alert.alert(apiErrorMessage(e)),
  });

  const del = useMutation({
    mutationFn: () => deleteClass(occ.classId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agenda'] });
      navigation.goBack();
    },
  });

  const confirmDelete = () =>
    Alert.alert(t('agenda.class.delete'), t('agenda.class.delete.confirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('agenda.class.delete'), style: 'destructive', onPress: () => del.mutate() },
    ]);

  const tag = SESSION_TAG[occ.sessionType];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <Text style={styles.time}>
            {occ.startTime} – {occ.endTime}
          </Text>
          <View style={[styles.tag, { backgroundColor: tag.bg }]}>
            <Text style={[styles.tagText, { color: tag.fg }]}>{SESSION_LABEL[occ.sessionType]}</Text>
          </View>
        </View>
        <Text style={styles.name}>{occ.name}</Text>
        <Text style={styles.sub}>
          {[occ.instructorName, dayHeader(occ.date)].filter(Boolean).join(' · ')}
        </Text>
        {occ.restrictionLabel && (
          <View style={styles.restrict}>
            <MaterialCommunityIcons name="lock" size={11} color={palette.textSecondary} />
            <Text style={styles.restrictText}>{occ.restrictionLabel}</Text>
          </View>
        )}
      </View>

      {occ.checkedIn ? (
        <View style={styles.doneBox}>
          <MaterialCommunityIcons name="check-circle" size={18} color="#4ADE80" />
          <Text style={styles.doneText}>{t('agenda.checkinDone')}</Text>
        </View>
      ) : !occ.eligible ? (
        <View style={styles.lockedBox}>
          <MaterialCommunityIcons name="lock" size={16} color={palette.textSecondary} />
          <Text style={styles.lockedText}>{occ.restrictionLabel ?? t('agenda.restricted')}</Text>
        </View>
      ) : occ.canCheckIn ? (
        <>
          <Button
            mode="contained"
            onPress={() => checkIn.mutate()}
            loading={checkIn.isPending}
            contentStyle={styles.checkinContent}>
            {t('agenda.checkin')}
          </Button>
          <Text style={styles.window}>{t('agenda.window')}</Text>
        </>
      ) : occ.reserved ? (
        <>
          <View style={styles.reservedBox}>
            <MaterialCommunityIcons name="clock-check-outline" size={16} color={palette.textPrimary} />
            <Text style={styles.reservedText}>{t('agenda.reserved')}</Text>
          </View>
          <Button
            mode="text"
            textColor={palette.textSecondary}
            onPress={() => reserve.mutate()}
            loading={reserve.isPending}>
            {t('agenda.reserve.cancel')}
          </Button>
        </>
      ) : occ.canReserve ? (
        <Button
          mode="outlined"
          textColor={palette.textPrimary}
          style={styles.reserveBtn}
          onPress={() => reserve.mutate()}
          loading={reserve.isPending}
          contentStyle={styles.checkinContent}>
          {t('agenda.reserve')}
        </Button>
      ) : (
        <View style={styles.lockedBox}>
          <MaterialCommunityIcons name="clock-outline" size={16} color={palette.textSecondary} />
          <Text style={styles.lockedText}>{t('agenda.window')}</Text>
        </View>
      )}

      {staff && (
        <Button
          mode="outlined"
          icon="clipboard-check-outline"
          textColor={palette.textPrimary}
          style={styles.attendanceBtn}
          onPress={() =>
            navigation.navigate('Attendance', {
              classId: occ.classId,
              date: occ.date,
              title: occ.name,
            })
          }>
          {t('agenda.viewAttendance')}
        </Button>
      )}

      <View style={styles.whoHeader}>
        <Text style={styles.whoTitle}>{t('agenda.attendees')}</Text>
        <Text style={styles.whoCount}>{tf('agenda.attendeesCount', { n: occ.attendeeCount })}</Text>
      </View>
      {attendees.isLoading ? (
        <ActivityIndicator style={{ marginTop: 12 }} />
      ) : (
        (attendees.data ?? []).map((a: Attendee) => (
          <View key={a.userId} style={styles.attendeeRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initialsOf(a.displayName)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.attendeeName}>{a.displayName}</Text>
              {a.belt && (
                <View style={styles.beltMini}>
                  <BeltVisual
                    color={a.belt.colorHex}
                    rankBarColor={rankBarColorFor(a.belt.slug)}
                    stripes={a.belt.stripes}
                    height={8}
                  />
                </View>
              )}
            </View>
            <View style={styles.statusChip}>
              <MaterialCommunityIcons
                name={a.status === 'PRESENT' ? 'check-circle' : 'clock-outline'}
                size={12}
                color={a.status === 'PRESENT' ? '#4ADE80' : palette.textSecondary}
              />
              <Text
                style={[
                  styles.statusText,
                  a.status === 'PRESENT' ? styles.statusPresent : undefined,
                ]}>
                {t(a.status === 'PRESENT' ? 'agenda.status.PRESENT' : 'agenda.status.RESERVED')}
              </Text>
            </View>
          </View>
        ))
      )}

      {staff && (
        <Button mode="text" textColor={palette.primary} style={styles.deleteBtn} onPress={confirmDelete}>
          {t('agenda.class.delete')}
        </Button>
      )}

      <Modal visible={successStreak !== null} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.successCircle}>
              <MaterialCommunityIcons name="check" size={34} color="#fff" />
            </View>
            <Text style={styles.successTitle}>{t('agenda.success.title')}</Text>
            <Text style={styles.successSub}>
              {occ.name} · {SESSION_LABEL[occ.sessionType]} · {occ.startTime}
            </Text>
            <View style={styles.streakChip}>
              <MaterialCommunityIcons name="fire" size={18} color={palette.primary} />
              <Text style={styles.streakText}>
                {successStreak === 1
                  ? t('agenda.success.streakOne')
                  : tf('agenda.success.streakMany', { n: successStreak ?? 0 })}
              </Text>
            </View>
            <Button mode="contained" onPress={() => setSuccessStreak(null)} contentStyle={styles.checkinContent}>
              {t('agenda.success.continue')}
            </Button>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = makeStyles(() => ({
  container: { flex: 1, backgroundColor: palette.background },
  content: { padding: 20 },
  card: { backgroundColor: palette.surface, borderRadius: 16, padding: 16, marginBottom: 12 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  time: { color: palette.textPrimary, fontSize: 18, fontWeight: 'bold' },
  tag: { borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2 },
  tagText: { fontSize: 9 },
  name: { color: palette.textPrimary, fontSize: 15, fontWeight: 'bold' },
  sub: { color: palette.textSecondary, fontSize: 12, marginTop: 2 },
  restrict: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  restrictText: { color: palette.textSecondary, fontSize: 11 },
  checkinContent: { paddingVertical: 5 },
  window: { color: palette.textSecondary, fontSize: 10, textAlign: 'center', marginTop: 6 },
  doneBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: palette.surface,
    borderRadius: 12,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: '#16A34A',
  },
  doneText: { color: '#4ADE80', fontSize: 14, fontWeight: 'bold' },
  lockedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: palette.surface,
    borderRadius: 12,
    paddingVertical: 13,
  },
  lockedText: { color: palette.textSecondary, fontSize: 12 },
  reservedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: palette.surface,
    borderRadius: 12,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: palette.outline,
  },
  reservedText: { color: palette.textPrimary, fontSize: 14, fontWeight: 'bold' },
  reserveBtn: { borderColor: palette.outline },
  statusChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusText: { color: palette.textSecondary, fontSize: 10 },
  statusPresent: { color: '#4ADE80', fontWeight: 'bold' },
  attendanceBtn: { borderColor: palette.outline, marginTop: 12 },
  whoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 22,
    marginBottom: 8,
  },
  whoTitle: { color: palette.textPrimary, fontSize: 14, fontWeight: 'bold' },
  whoCount: { color: palette.textSecondary, fontSize: 11 },
  attendeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#1A1A20',
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: palette.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: palette.textPrimary, fontWeight: 'bold', fontSize: 10 },
  attendeeName: { color: palette.textPrimary, fontSize: 12, fontWeight: 'bold' },
  beltMini: { width: 40, marginTop: 4 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  modalCard: {
    backgroundColor: palette.surface,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  successCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  successTitle: { color: palette.textPrimary, fontSize: 17, fontWeight: 'bold' },
  successSub: { color: palette.textSecondary, fontSize: 12, marginTop: 4, marginBottom: 16, textAlign: 'center' },
  streakChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2A1215',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 18,
  },
  streakText: { color: palette.textPrimary, fontSize: 14, fontWeight: 'bold' },
  deleteBtn: { marginTop: 20, alignSelf: 'center' },
}));
