import { MaterialCommunityIcons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';

import { RosterEntry, getRoster, markAttendance } from '../../api/classes';
import BeltVisual from '../../components/BeltVisual';
import { rankBarColorFor } from '../../constants/belts';
import { t } from '../../i18n';
import { GymStackParamList } from '../../navigation/GymNavigator';
import { makeStyles, palette } from '../../theme/theme';

type Props = NativeStackScreenProps<GymStackParamList, 'Attendance'>;

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export default function AttendanceScreen({ route }: Props) {
  const { classId, date, title } = route.params;
  const queryClient = useQueryClient();

  const roster = useQuery({ queryKey: ['roster', classId, date], queryFn: () => getRoster(classId, date) });

  const mark = useMutation({
    mutationFn: (v: { userId: number; present: boolean }) =>
      markAttendance(classId, date, v.userId, v.present),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roster', classId, date] });
      queryClient.invalidateQueries({ queryKey: ['attendees', classId, date] });
      queryClient.invalidateQueries({ queryKey: ['agenda'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });

  if (roster.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  const data = roster.data ?? [];
  const present = data.filter((r) => r.present).length;

  return (
    <FlatList
      style={styles.container}
      data={data}
      keyExtractor={(r) => String(r.userId)}
      contentContainerStyle={styles.content}
      ListHeaderComponent={
        <View>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.summary}>
            <View style={styles.summaryGood}>
              <Text style={styles.summaryNum}>{present}</Text>
              <Text style={styles.summaryLabel}>{t('agenda.attendance.present')}</Text>
            </View>
          </View>
          <Text style={styles.hint}>{t('agenda.attendance.hint')}</Text>
        </View>
      }
      renderItem={({ item }: { item: RosterEntry }) => (
        <Pressable
          style={styles.row}
          onPress={() => mark.mutate({ userId: item.userId, present: !item.present })}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initialsOf(item.displayName)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{item.displayName}</Text>
            {item.belt && (
              <View style={styles.beltMini}>
                <BeltVisual
                  color={item.belt.colorHex}
                  rankBarColor={rankBarColorFor(item.belt.slug)}
                  stripes={item.belt.stripes}
                  height={8}
                />
              </View>
            )}
          </View>
          {item.present ? (
            <View style={styles.checkOn}>
              <MaterialCommunityIcons name="check" size={16} color="#fff" />
            </View>
          ) : (
            <View style={styles.checkOff} />
          )}
        </Pressable>
      )}
    />
  );
}

const styles = makeStyles(() => ({
  container: { flex: 1, backgroundColor: palette.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.background },
  content: { padding: 20 },
  title: { color: palette.textPrimary, fontSize: 16, fontWeight: 'bold' },
  summary: { flexDirection: 'row', marginTop: 12, marginBottom: 14 },
  summaryGood: { backgroundColor: '#12231A', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 20, alignItems: 'center' },
  summaryNum: { color: '#4ADE80', fontSize: 18, fontWeight: 'bold' },
  summaryLabel: { color: '#4ADE80', fontSize: 10 },
  hint: { color: palette.textSecondary, fontSize: 10, marginBottom: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
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
  name: { color: palette.textPrimary, fontSize: 12, fontWeight: 'bold' },
  beltMini: { width: 40, marginTop: 4 },
  checkOn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOff: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: palette.outline },
}));
