import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { ReactNode, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';

import { apiErrorMessage } from '../api/auth';
import { CheckInSubmission, Visibility, todayLocalDate } from '../api/checkins';
import { uploadMedia } from '../api/posts';
import { ALL_REGIONS, bodyRegionLabel, intensityColor } from '../constants/body';
import { SUBMISSIONS } from '../constants/submissions';
import { newClientId, submitCheckIn } from '../offline/outbox';
import { t, tf } from '../i18n';
import { makeStyles, palette } from '../theme/theme';
import DateField from './DateField';

type Direction = 'HIT' | 'CONCEDED';
const DURATIONS = [60, 75, 90, 120];
const VISIBILITY_KEY = 'bjjflow.checkin.visibility';
const localDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function durationLabel(d: number) {
  const h = Math.floor(d / 60);
  const m = d % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
}

/** An optional part of the form: one row with a summary, expanding in place. */
function Section({
  icon,
  title,
  summary,
  open,
  onToggle,
  children,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  summary: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Pressable
        style={styles.sectionHead}
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}>
        <MaterialCommunityIcons name={icon} size={18} color={palette.textSecondary} />
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSummary} numberOfLines={1}>
          {summary}
        </Text>
        <MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={palette.textSecondary} />
      </Pressable>
      {open && <View style={styles.sectionBody}>{children}</View>}
    </View>
  );
}

/**
 * Log a session. The essentials (day, type, duration) are a few taps and can be
 * saved right away; submissions, pain, and note/photo are optional rows that
 * expand only when wanted. Visibility starts private and remembers the last choice.
 */
export default function CheckInSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { height } = useWindowDimensions();
  // Built in render (not at module load) so labels follow the active language.
  const TYPES: { key: string; label: string }[] = [
    { key: 'GI', label: t('checkin.type.GI') },
    { key: 'NOGI', label: t('checkin.type.NOGI') },
    { key: 'OPEN_MAT', label: t('checkin.type.OPEN_MAT') },
  ];

  const [sessionType, setSessionType] = useState('GI');
  const [duration, setDuration] = useState(60);
  const [subDir, setSubDir] = useState<Direction>('HIT');
  const [hit, setHit] = useState<Record<string, number>>({});
  const [conceded, setConceded] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('PRIVATE');
  const [photo, setPhoto] = useState<{ key: string; uri: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pain, setPain] = useState<Record<string, number>>({});
  const [painRegion, setPainRegion] = useState<string | null>(null);
  const [date, setDate] = useState(new Date());
  const [pickingDate, setPickingDate] = useState(false);
  const [openSection, setOpenSection] = useState<'subs' | 'pain' | 'notes' | null>(null);
  const toggle = (section: 'subs' | 'pain' | 'notes') => setOpenSection((cur) => (cur === section ? null : section));

  // Sessions are private unless the user chose to share; their last choice sticks.
  useEffect(() => {
    if (!visible) return;
    AsyncStorage.getItem(VISIBILITY_KEY)
      .then((saved) => {
        if (saved === 'PUBLIC' || saved === 'PRIVATE') setVisibility(saved);
      })
      .catch(() => undefined);
  }, [visible]);
  const chooseVisibility = (v: Visibility) => {
    setVisibility(v);
    AsyncStorage.setItem(VISIBILITY_KEY, v).catch(() => undefined);
  };

  const reset = () => {
    setSessionType('GI');
    setDate(new Date());
    setDuration(60);
    setSubDir('HIT');
    setHit({});
    setConceded({});
    setNotes('');
    setPhoto(null);
    setPain({});
    setPainRegion(null);
    setPickingDate(false);
    setOpenSection(null);
  };

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t('mural.media.permission'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.7 });
    if (result.canceled) return;
    const asset = result.assets[0];
    setUploading(true);
    try {
      const uploaded = await uploadMedia({
        uri: asset.uri,
        name: asset.fileName ?? 'treino.jpg',
        type: asset.mimeType ?? 'image/jpeg',
      });
      setPhoto({ key: uploaded.key, uri: asset.uri });
    } catch (e) {
      Alert.alert(apiErrorMessage(e));
    } finally {
      setUploading(false);
    }
  };

  // One id per session being logged: a double tap or a retry records it once.
  const clientId = useRef(newClientId());

  const save = useMutation({
    mutationFn: async () => {
      const submissions: CheckInSubmission[] = [
        ...Object.entries(hit).filter(([, n]) => n > 0).map(([submission, n]) => ({ submission, direction: 'HIT' as const, count: n })),
        ...Object.entries(conceded).filter(([, n]) => n > 0).map(([submission, n]) => ({ submission, direction: 'CONCEDED' as const, count: n })),
      ];
      const painEntries = Object.entries(pain)
        .filter(([, n]) => n > 0)
        .map(([region, n]) => ({ region, intensity: n }));
      // Sent now if possible; without a connection it waits in the outbox.
      return submitCheckIn({
        date: localDate(date),
        sessionType,
        durationMinutes: duration,
        notes: notes.trim() || undefined,
        visibility,
        photoKey: photo?.key,
        submissions: submissions.length ? submissions : undefined,
        clientId: clientId.current,
        // Pain marked in this report shows on the body map.
      }, painEntries);
    },
    onSuccess: (outcome) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      clientId.current = newClientId();
      reset();
      onClose();
      Alert.alert(outcome === 'queued' ? t('checkin.queued') : t('checkin.sheet.saved'));
    },
    onError: (e) => Alert.alert(apiErrorMessage(e)),
  });

  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  const isToday = sameDay(date, today);
  const isYesterday = sameDay(date, yesterday);

  const hitTotal = Object.values(hit).reduce((a, b) => a + b, 0);
  const concededTotal = Object.values(conceded).reduce((a, b) => a + b, 0);
  const subsSummary =
    hitTotal + concededTotal === 0
      ? t('checkin.section.none')
      : tf('checkin.section.subsSummary', { hit: hitTotal, conceded: concededTotal });
  const painCount = Object.keys(pain).length;
  const painSummary = painCount === 0 ? t('checkin.section.none') : tf('checkin.pain.added', { n: painCount });
  const notesSummary =
    [notes.trim() ? t('checkin.section.note') : null, photo ? t('checkin.section.photo') : null]
      .filter(Boolean)
      .join(' · ') || t('checkin.section.none');

  const counts = subDir === 'HIT' ? hit : conceded;
  const setCounts = subDir === 'HIT' ? setHit : setConceded;
  const bump = (key: string, delta: number) =>
    setCounts((prev) => {
      const next = Math.max(0, (prev[key] ?? 0) + delta);
      if (delta > 0) Haptics.selectionAsync();
      return { ...prev, [key]: next };
    });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.kav} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Dimmed area ABOVE the sheet dismisses on tap. It's a sibling (not a
            wrapper), so nothing competes with the ScrollView for the scroll gesture. */}
        <Pressable style={styles.dismissArea} onPress={onClose} accessibilityLabel={t('a11y.close')} />
        <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.title}>{t('checkin.sheet.title')}</Text>
            <ScrollView
              showsVerticalScrollIndicator={false}
              style={[styles.scroll, { maxHeight: height * 0.7 }]}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              automaticallyAdjustKeyboardInsets
              contentContainerStyle={{ paddingBottom: 24 }}>
            {/* Day: today / yesterday cover almost every session; a calendar for the rest. */}
            <Text style={styles.label}>{t('checkin.sheet.date')}</Text>
            <View style={styles.chips}>
              <Pressable
                style={[styles.chip, isToday && !pickingDate && styles.chipOn]}
                onPress={() => {
                  setDate(new Date());
                  setPickingDate(false);
                }}>
                <Text style={[styles.chipText, isToday && !pickingDate && styles.chipTextOn]}>{t('checkin.date.today')}</Text>
              </Pressable>
              <Pressable
                style={[styles.chip, isYesterday && !pickingDate && styles.chipOn]}
                onPress={() => {
                  setDate(new Date(Date.now() - 86_400_000));
                  setPickingDate(false);
                }}>
                <Text style={[styles.chipText, isYesterday && !pickingDate && styles.chipTextOn]}>
                  {t('checkin.date.yesterday')}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.chip, (pickingDate || (!isToday && !isYesterday)) && styles.chipOn]}
                onPress={() => setPickingDate(true)}
                accessibilityLabel={t('checkin.date.other')}>
                <MaterialCommunityIcons
                  name="calendar"
                  size={15}
                  color={pickingDate || (!isToday && !isYesterday) ? '#fff' : palette.textSecondary}
                />
              </Pressable>
            </View>
            {pickingDate && (
              <View style={{ marginBottom: 8 }}>
                <DateField value={date} onChange={setDate} maximumDate={new Date()} />
              </View>
            )}

            {/* Session type */}
            <Text style={styles.label}>{t('checkin.sheet.type')}</Text>
            <View style={styles.chips}>
              {TYPES.map((x) => (
                <Pressable
                  key={x.key}
                  style={[styles.chip, sessionType === x.key && styles.chipOn]}
                  onPress={() => setSessionType(x.key)}>
                  <Text style={[styles.chipText, sessionType === x.key && styles.chipTextOn]}>{x.label}</Text>
                </Pressable>
              ))}
            </View>

            {/* Duration */}
            <Text style={styles.label}>{t('checkin.sheet.duration')}</Text>
            <View style={styles.chips}>
              {DURATIONS.map((d) => (
                <Pressable key={d} style={[styles.chip, duration === d && styles.chipOn]} onPress={() => setDuration(d)}>
                  <Text style={[styles.chipText, duration === d && styles.chipTextOn]}>
                    {durationLabel(d)}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Optional details */}
            <Section icon="karate" title={t('checkin.section.subs')} summary={subsSummary} open={openSection === 'subs'} onToggle={() => toggle('subs')}>
            <View style={styles.subToggle}>
              <Pressable
                style={[styles.segBtn, subDir === 'HIT' && styles.segBtnOn]}
                onPress={() => setSubDir('HIT')}>
                <Text style={[styles.segText, subDir === 'HIT' && styles.segTextOn]}>{t('checkin.sheet.subsHit')}</Text>
              </Pressable>
              <Pressable
                style={[styles.segBtn, subDir === 'CONCEDED' && styles.segBtnOn]}
                onPress={() => setSubDir('CONCEDED')}>
                <Text style={[styles.segText, subDir === 'CONCEDED' && styles.segTextOn]}>
                  {t('checkin.sheet.subsConceded')}
                </Text>
              </Pressable>
            </View>
            <View style={styles.subList}>
              {SUBMISSIONS.map((s) => {
                const n = counts[s.key] ?? 0;
                return (
                  <View key={s.key} style={styles.subRow}>
                    <View style={[styles.subDot, { backgroundColor: s.color }]} />
                    <Text style={[styles.subLabel, n > 0 && styles.subLabelOn]} numberOfLines={1}>
                      {s.label}
                    </Text>
                    <Pressable onPress={() => bump(s.key, -1)} hitSlop={8} style={styles.stepBtn} disabled={n === 0} accessibilityRole="button" accessibilityLabel={`${t('a11y.decrease')} ${s.label}`}>
                      <MaterialCommunityIcons name="minus" size={15} color={n === 0 ? palette.outline : palette.textPrimary} />
                    </Pressable>
                    <Text style={styles.stepNum}>{n}</Text>
                    <Pressable onPress={() => bump(s.key, 1)} hitSlop={8} style={styles.stepBtn} accessibilityRole="button" accessibilityLabel={`${t('a11y.increase')} ${s.label}`}>
                      <MaterialCommunityIcons name="plus" size={15} color={palette.primary} />
                    </Pressable>
                  </View>
                );
              })}
            </View>
            </Section>

            {/* Pain / injury — slide through regions, pick one, then set 0-10 */}
            <Section icon="bandage" title={t('checkin.section.pain')} summary={painSummary} open={openSection === 'pain'} onToggle={() => toggle('pain')}>
            <Text style={styles.painHint}>{t('checkin.pain.hint')}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.painChips}>
              {ALL_REGIONS.map((r) => {
                const intensity = pain[r] ?? 0;
                const active = intensity > 0;
                const selected = painRegion === r;
                return (
                  <Pressable
                    key={r}
                    onPress={() => setPainRegion(selected ? null : r)}
                    style={[styles.painChip, selected && styles.painChipSelected, active && { borderColor: intensityColor(intensity) }]}>
                    {active && <View style={[styles.painChipDot, { backgroundColor: intensityColor(intensity) }]} />}
                    <Text style={[styles.painChipText, (active || selected) && styles.painChipTextOn]} numberOfLines={1}>
                      {bodyRegionLabel(r)}
                    </Text>
                    {active && <Text style={[styles.painChipNum, { color: intensityColor(intensity) }]}>{intensity}</Text>}
                  </Pressable>
                );
              })}
            </ScrollView>
            {painRegion && (
              <View style={styles.painPicker}>
                <Text style={styles.painPickerTitle}>{bodyRegionLabel(painRegion)}</Text>
                <View style={styles.painScale}>
                  {Array.from({ length: 11 }).map((_, i) => (
                    <Pressable
                      key={i}
                      onPress={() => {
                        setPain((prev) => {
                          const next = { ...prev };
                          if (i === 0) delete next[painRegion];
                          else next[painRegion] = i;
                          return next;
                        });
                        setPainRegion(null);
                      }}
                      style={[styles.painScaleBtn, { backgroundColor: i === 0 ? palette.surfaceVariant : intensityColor(i) }]}>
                      <Text style={[styles.painScaleText, i === 0 && { color: palette.textSecondary }]}>{i}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
            </Section>

            <Section icon="note-text-outline" title={t('checkin.section.notes')} summary={notesSummary} open={openSection === 'notes'} onToggle={() => toggle('notes')}>
            <TextInput
              mode="outlined"
              value={notes}
              onChangeText={setNotes}
              placeholder={t('checkin.sheet.notes.placeholder')}
              multiline
              numberOfLines={2}
              style={styles.notes}
            />

            {/* Training photo */}
            <Text style={styles.label}>{t('checkin.sheet.photo')}</Text>
            {photo ? (
              <View style={styles.photoWrap}>
                <Image source={{ uri: photo.uri }} style={styles.photo} />
                <Pressable style={styles.photoRemove} onPress={() => setPhoto(null)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('a11y.remove')}>
                  <MaterialCommunityIcons name="close" size={16} color="#fff" />
                </Pressable>
              </View>
            ) : (
              <Pressable style={styles.photoAdd} onPress={pickPhoto} disabled={uploading}>
                {uploading ? (
                  <ActivityIndicator color={palette.primary} />
                ) : (
                  <>
                    <MaterialCommunityIcons name="camera-plus-outline" size={22} color={palette.textSecondary} />
                    <Text style={styles.photoAddText}>{t('checkin.sheet.photo.add')}</Text>
                  </>
                )}
              </Pressable>
            )}
            </Section>

            {/* Visibility */}
            <Text style={styles.label}>{t('checkin.sheet.visibility')}</Text>
            <View style={styles.visToggle}>
              {(['PUBLIC', 'PRIVATE'] as Visibility[]).map((v) => (
                <Pressable
                  key={v}
                  style={[styles.segBtn, visibility === v && styles.segBtnOn]}
                  onPress={() => chooseVisibility(v)}>
                  <MaterialCommunityIcons
                    name={v === 'PUBLIC' ? 'earth' : 'lock'}
                    size={15}
                    color={visibility === v ? palette.textPrimary : palette.textSecondary}
                  />
                  <Text style={[styles.segText, visibility === v && styles.segTextOn]}>
                    {v === 'PUBLIC' ? t('checkin.sheet.visibility.public') : t('checkin.sheet.visibility.private')}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.visHint}>
              {visibility === 'PUBLIC' ? t('checkin.sheet.visibility.publicHint') : t('checkin.sheet.visibility.privateHint')}
            </Text>
          </ScrollView>

          <Button
            mode="contained"
            icon="check"
            loading={save.isPending}
            disabled={save.isPending}
            onPress={() => save.mutate()}
            contentStyle={styles.saveContent}
            style={styles.save}>
            {t('checkin.sheet.save')}
          </Button>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = makeStyles(() => ({
  kav: { flex: 1 },
  // Fills the space above the sheet (which sits at the bottom of the column).
  dismissArea: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: palette.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 28,
    maxHeight: '88%',
  },
  handle: { width: 36, height: 4, borderRadius: 999, backgroundColor: palette.outline, alignSelf: 'center', marginBottom: 12 },
  title: { color: palette.textPrimary, fontSize: 16, fontWeight: 'bold', textAlign: 'center', marginBottom: 14 },
  // flexShrink lets the list shrink to fit the maxHeight-capped sheet so it can
  // actually scroll (and keeps the Save button visible) when the form is tall.
  scroll: { flexShrink: 1 },
  label: { color: palette.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 8, marginTop: 6 },
  section: { borderTopWidth: 1, borderTopColor: palette.surfaceVariant },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, minHeight: 48 },
  sectionTitle: { color: palette.textPrimary, fontSize: 14, fontWeight: '600' },
  sectionSummary: { flex: 1, color: palette.textSecondary, fontSize: 13, textAlign: 'right' },
  sectionBody: { paddingBottom: 12 },
  chips: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: palette.surfaceVariant },
  chipOn: { backgroundColor: palette.primary },
  chipText: { color: palette.textSecondary, fontSize: 13, fontWeight: '600' },
  chipTextOn: { color: '#fff' },
  subToggle: { flexDirection: 'row', backgroundColor: palette.surfaceVariant, borderRadius: 10, padding: 3, marginBottom: 10 },
  segBtn: { flex: 1, flexDirection: 'row', gap: 6, paddingVertical: 8, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  segBtnOn: { backgroundColor: palette.surface },
  segText: { color: palette.textSecondary, fontSize: 12, fontWeight: '600' },
  segTextOn: { color: palette.textPrimary },
  subList: { gap: 2 },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  subDot: { width: 10, height: 10, borderRadius: 5 },
  subLabel: { color: palette.textSecondary, fontSize: 13, flex: 1 },
  subLabelOn: { color: palette.textPrimary, fontWeight: '600' },
  stepBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: palette.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNum: { color: palette.textPrimary, fontSize: 14, fontWeight: 'bold', minWidth: 18, textAlign: 'center' },
  painChips: { gap: 8, paddingVertical: 6, paddingRight: 8 },
  painChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 20, borderWidth: 1, borderColor: palette.outline, backgroundColor: palette.surfaceVariant },
  painChipSelected: { borderColor: palette.primary, backgroundColor: palette.surface },
  painChipDot: { width: 8, height: 8, borderRadius: 4 },
  painChipText: { color: palette.textSecondary, fontSize: 13, fontWeight: '600' },
  painChipTextOn: { color: palette.textPrimary },
  painChipNum: { fontWeight: '800', fontSize: 13 },
  painPicker: { marginTop: 8 },
  painPickerTitle: { color: palette.textPrimary, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  painScale: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, justifyContent: 'center' },
  painScaleBtn: { width: 26, height: 32, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  painScaleText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  painHint: { color: palette.textSecondary, fontSize: 11, textAlign: 'center', marginTop: 4, marginBottom: 4 },
  notes: { backgroundColor: palette.surface, marginBottom: 10 },
  photoWrap: { marginBottom: 6, borderRadius: 12, overflow: 'hidden' },
  photo: { width: '100%', height: 170, borderRadius: 12 },
  photoRemove: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoAdd: {
    height: 88,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.outline,
    borderStyle: 'dashed',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 6,
  },
  photoAddText: { color: palette.textSecondary, fontSize: 13, fontWeight: '600' },
  visToggle: { flexDirection: 'row', backgroundColor: palette.surfaceVariant, borderRadius: 10, padding: 3, marginBottom: 6, marginTop: 4 },
  visHint: { color: palette.textSecondary, fontSize: 11, marginBottom: 4 },
  save: { marginTop: 16 },
  saveContent: { paddingVertical: 6 },
}));
