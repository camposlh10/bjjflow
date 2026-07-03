import { useHeaderHeight } from '@react-navigation/elements';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';

import { apiErrorMessage } from '../../api/auth';
import { RestrictionMode, SESSION_LABEL, SessionType, createClass } from '../../api/classes';
import DateField from '../../components/DateField';
import { ADULT_BELTS, KIDS_BELTS } from '../../constants/belts';
import { t } from '../../i18n';
import { makeStyles, palette } from '../../theme/theme';

const pad2 = (n: number) => String(n).padStart(2, '0');
const toTimeLabel = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
function parseTime(s: string): Date {
  const [h, m] = s.split(':').map((x) => parseInt(x, 10));
  const d = new Date();
  d.setHours(Number.isFinite(h) ? h : 19, Number.isFinite(m) ? m : 0, 0, 0);
  return d;
}

const DAYS: { label: string; dow: number }[] = [
  { label: 'S', dow: 1 },
  { label: 'T', dow: 2 },
  { label: 'Q', dow: 3 },
  { label: 'Q', dow: 4 },
  { label: 'S', dow: 5 },
  { label: 'S', dow: 6 },
  { label: 'D', dow: 7 },
];
const TYPES: SessionType[] = ['GI', 'NOGI', 'OPEN_MAT'];
const MODES: RestrictionMode[] = ['ALL', 'KIDS', 'ADULTS', 'BELTS'];
const ALL_BELTS = [...ADULT_BELTS, ...KIDS_BELTS];

export default function CreateClassScreen({ navigation }: { navigation: { goBack: () => void } }) {
  const queryClient = useQueryClient();
  const headerHeight = useHeaderHeight();

  const [name, setName] = useState('');
  const [days, setDays] = useState<number[]>([]);
  const [start, setStart] = useState('19:00');
  const [end, setEnd] = useState('20:30');
  const [sessionType, setSessionType] = useState<SessionType>('GI');
  const [mode, setMode] = useState<RestrictionMode>('ALL');
  const [belts, setBelts] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const toggle = <X,>(arr: X[], x: X): X[] => (arr.includes(x) ? arr.filter((v) => v !== x) : [...arr, x]);

  const valid = name.trim().length > 0 && days.length > 0 && /^\d{1,2}:\d{2}$/.test(start) && /^\d{1,2}:\d{2}$/.test(end);

  const save = useMutation({
    mutationFn: async () => {
      for (const dow of days) {
        await createClass({
          name: name.trim(),
          dayOfWeek: dow,
          startTime: start,
          endTime: end,
          sessionType,
          restrictionMode: mode,
          allowedBeltSlugs: mode === 'BELTS' ? belts : undefined,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gymClasses'] });
      queryClient.invalidateQueries({ queryKey: ['agenda'] });
      navigation.goBack();
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={headerHeight}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TextInput
          mode="outlined"
          label={t('agenda.class.name')}
          value={name}
          onChangeText={setName}
          style={styles.input}
        />

        <Text style={styles.label}>{t('agenda.class.days')}</Text>
        <View style={styles.daysRow}>
          {DAYS.map((d, i) => {
            const on = days.includes(d.dow);
            return (
              <Pressable
                key={i}
                style={[styles.dayCircle, on && styles.dayOn]}
                onPress={() => setDays((arr) => toggle(arr, d.dow))}>
                <Text style={[styles.dayText, on && styles.dayTextOn]}>{d.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.timeRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>{t('agenda.class.start')}</Text>
            <DateField mode="time" value={parseTime(start)} onChange={(d) => setStart(toTimeLabel(d))} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>{t('agenda.class.end')}</Text>
            <DateField mode="time" value={parseTime(end)} onChange={(d) => setEnd(toTimeLabel(d))} />
          </View>
        </View>

        <Text style={styles.label}>{t('agenda.class.type')}</Text>
        <View style={styles.chipsRow}>
          {TYPES.map((tp) => (
            <Pressable
              key={tp}
              style={[styles.chip, sessionType === tp && styles.chipOn]}
              onPress={() => setSessionType(tp)}>
              <Text style={[styles.chipText, sessionType === tp && styles.chipTextOn]}>{SESSION_LABEL[tp]}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>{t('agenda.class.who')}</Text>
        <View style={styles.chipsRow}>
          {MODES.map((m) => (
            <Pressable key={m} style={[styles.chip, mode === m && styles.chipOn]} onPress={() => setMode(m)}>
              <Text style={[styles.chipText, mode === m && styles.chipTextOn]}>{t(`agenda.who.${m}`)}</Text>
            </Pressable>
          ))}
        </View>

        {mode === 'BELTS' && (
          <View style={styles.beltsWrap}>
            {ALL_BELTS.map((b) => {
              const on = belts.includes(b.slug);
              return (
                <Pressable
                  key={b.slug}
                  style={[styles.beltChip, on && styles.beltChipOn]}
                  onPress={() => setBelts((arr) => toggle(arr, b.slug))}>
                  <View style={[styles.beltDot, { backgroundColor: b.color }]} />
                  <Text style={[styles.beltChipText, on && styles.chipTextOn]}>{b.namePt}</Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {error && <Text style={styles.error}>{error}</Text>}

        <Button
          mode="contained"
          onPress={() => save.mutate()}
          disabled={!valid || save.isPending}
          loading={save.isPending}
          contentStyle={styles.saveContent}
          style={styles.save}>
          {t('agenda.class.save')}
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = makeStyles(() => ({
  container: { flex: 1, backgroundColor: palette.background },
  content: { padding: 20, paddingBottom: 40 },
  input: { marginBottom: 14 },
  label: { color: palette.textSecondary, fontSize: 12, marginBottom: 8, marginTop: 4 },
  daysRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: palette.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayOn: { backgroundColor: palette.primary },
  dayText: { color: palette.textSecondary, fontSize: 13 },
  dayTextOn: { color: '#fff', fontWeight: 'bold' },
  timeRow: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  chipsRow: { flexDirection: 'row', gap: 8, marginBottom: 14, flexWrap: 'wrap' },
  chip: {
    backgroundColor: palette.surfaceVariant,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  chipOn: { backgroundColor: palette.primary },
  chipText: { color: palette.textSecondary, fontSize: 12 },
  chipTextOn: { color: '#fff', fontWeight: 'bold' },
  beltsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  beltChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: palette.surfaceVariant,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  beltChipOn: { backgroundColor: palette.primary },
  beltDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.3)' },
  beltChipText: { color: palette.textSecondary, fontSize: 12 },
  error: { color: palette.primary, marginBottom: 10 },
  save: { marginTop: 6 },
  saveContent: { paddingVertical: 6 },
}));
