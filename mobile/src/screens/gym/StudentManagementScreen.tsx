import { MaterialCommunityIcons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';

import { apiErrorMessage } from '../../api/auth';
import { promoteMember } from '../../api/gyms';
import { resolveMediaUrl } from '../../api/posts';
import {
  StudentAdmin,
  addStudentNote,
  deleteStudentNote,
  getStudentAdmin,
  getStudentNotes,
  getStudentPainAssessment,
  getStudentPainAssessments,
} from '../../api/students';
import BeltVisual from '../../components/BeltVisual';
import BodyMap from '../../components/BodyMap';
import Skeleton from '../../components/Skeleton';
import { ADULT_BELTS, KIDS_BELTS, maxStripesFor, rankBarColorFor } from '../../constants/belts';
import { BodyView, bodyRegionLabel, intensityColor } from '../../constants/body';
import { frequencyLabel, painTypeLabel, trendLabel } from '../../constants/painTypes';
import { t, tf } from '../../i18n';
import { makeStyles, palette } from '../../theme/theme';

const ALL_BELTS = [...ADULT_BELTS, ...KIDS_BELTS];

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

function fmtDate(d: string | null): string {
  if (!d) return '—';
  if (d.length === 10) {
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
  }
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
}

export default function StudentManagementScreen() {
  const route = useRoute<RouteProp<Record<string, { userId: number }>, string>>();
  const userId = route.params.userId;
  const student = useQuery({ queryKey: ['studentAdmin', userId], queryFn: () => getStudentAdmin(userId) });

  if (student.isLoading || !student.data) {
    return (
      <View style={styles.skeleton}>
        <Skeleton width={72} height={72} radius={36} style={{ alignSelf: 'center' }} />
        <Skeleton width="50%" height={18} style={{ alignSelf: 'center', marginTop: 12 }} />
        <Skeleton height={140} radius={16} style={{ marginTop: 20 }} />
        <Skeleton height={90} radius={16} style={{ marginTop: 14 }} />
      </View>
    );
  }
  return <Body s={student.data} />;
}

function Body({ s }: { s: StudentAdmin }) {
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const [gradOpen, setGradOpen] = useState(false);
  const [note, setNote] = useState('');
  const [painId, setPainId] = useState<number | null>(null);

  const notes = useQuery({ queryKey: ['studentNotes', s.userId], queryFn: () => getStudentNotes(s.userId) });
  const pain = useQuery({ queryKey: ['studentPain', s.userId], queryFn: () => getStudentPainAssessments(s.userId) });

  const addNote = useMutation({
    mutationFn: () => addStudentNote(s.userId, note.trim()),
    onSuccess: () => {
      setNote('');
      queryClient.invalidateQueries({ queryKey: ['studentNotes', s.userId] });
    },
  });
  const removeNote = useMutation({
    mutationFn: (noteId: number) => deleteStudentNote(s.userId, noteId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['studentNotes', s.userId] }),
  });

  // Defensive against older/partial backend payloads (multiple backend versions
  // have been in play) — never index/.map a field that might be missing.
  const g = s.graduation ?? { classesSincePromotion: 0, graduationTarget: 0, ready: false, daysInBelt: null, lastPromotedAt: null };
  const history = Array.isArray(s.history) ? s.history : [];
  const recentAttendance = Array.isArray(s.recentAttendance) ? s.recentAttendance : [];
  const progress = g.graduationTarget > 0 ? Math.min(1, g.classesSincePromotion / g.graduationTarget) : 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets>
      {/* Header */}
      <View style={styles.header}>
        {s.avatarUrl ? (
          <Image source={{ uri: resolveMediaUrl(s.avatarUrl) }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarText}>{initialsOf(s.displayName)}</Text>
          </View>
        )}
        <Text style={styles.name}>{s.displayName}</Text>
        {s.username ? <Text style={styles.handle}>@{s.username}</Text> : null}
        {s.belt && (
          <View style={styles.beltRow}>
            <View style={{ width: 70 }}>
              <BeltVisual
                color={s.belt.colorHex}
                rankBarColor={rankBarColorFor(s.belt.slug)}
                stripes={s.belt.stripes}
                height={14}
              />
            </View>
            <Text style={styles.beltName}>
              {s.belt.namePt} ·{' '}
              {s.role === 'OWNER'
                ? t('gym.role.OWNER')
                : s.role === 'INSTRUCTOR'
                  ? t('gym.role.INSTRUCTOR')
                  : t('gym.role.MEMBER')}
            </Text>
          </View>
        )}
        <Button
          mode="outlined"
          icon="message-outline"
          compact
          style={{ marginTop: 14 }}
          onPress={() =>
            navigation.navigate('Conversation', {
              userId: s.userId,
              title: s.displayName,
              username: s.username,
              avatarUrl: s.avatarUrl,
            })
          }>
          {t('profile.message')}
        </Button>
      </View>

      {/* Graduação */}
      <View style={styles.card}>
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle}>{t('student.graduation')}</Text>
          {g.ready && (
            <View style={styles.readyPill}>
              <Text style={styles.readyText}>{t('student.ready')}</Text>
            </View>
          )}
        </View>
        <Text style={styles.counter}>
          {g.classesSincePromotion}
          <Text style={styles.counterTarget}> / {g.graduationTarget} {t('student.classes')}</Text>
        </Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${progress * 100}%` }, g.ready && styles.fillReady]} />
        </View>
        <Text style={styles.sub}>
          {g.daysInBelt != null ? tf('student.daysInBelt', { n: g.daysInBelt }) : t('student.noBeltDate')}
          {g.lastPromotedAt ? ` · ${tf('student.lastPromo', { date: fmtDate(g.lastPromotedAt) })}` : ''}
        </Text>
        <Button mode="contained" icon="arrow-up-bold" style={{ marginTop: 14 }} onPress={() => setGradOpen(true)}>
          {t('student.graduate')}
        </Button>
      </View>

      {/* Frequência */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('student.attendance')}</Text>
        <View style={styles.statRow}>
          <Stat value={String(s.attendance.totalClasses)} label={t('student.totalClasses')} />
          <Stat value={String(s.attendance.last30Days)} label={t('student.last30')} />
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>{t('student.lastAttended')}</Text>
          <Text style={styles.metaValue}>{fmtDate(s.attendance.lastAttended)}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>{t('student.memberSince')}</Text>
          <Text style={styles.metaValue}>{fmtDate(s.attendance.memberSince)}</Text>
        </View>
      </View>

      {/* Relatório de dor — student's 5 most recent pain assessments */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('student.pain')}</Text>
        {pain.isLoading ? (
          <Text style={styles.empty}>{t('picker.loading')}</Text>
        ) : (pain.data ?? []).length === 0 ? (
          <Text style={styles.empty}>{t('student.pain.empty')}</Text>
        ) : (
          (pain.data ?? []).map((a) => (
            <Pressable key={a.id} style={styles.painRow} onPress={() => setPainId(a.id)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.painDate}>{fmtDate(a.assessedOn)}</Text>
                <Text style={styles.painSub}>
                  {tf('student.pain.areas', { n: a.areaCount })} · {tf('student.pain.avg', { v: a.avgIntensity })}
                  {a.trend ? ` · ${trendLabel(a.trend)}` : ''}
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={18} color={palette.textSecondary} />
            </Pressable>
          ))
        )}
      </View>

      {/* Histórico de graduações */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('student.history')}</Text>
        {history.length === 0 ? (
          <Text style={styles.empty}>{t('student.history.empty')}</Text>
        ) : (
          history.map((p, i) => (
            <View key={i} style={styles.histRow}>
              <View style={{ width: 44 }}>
                <BeltVisual
                  color={p.colorHex}
                  rankBarColor={p.beltSlug ? rankBarColorFor(p.beltSlug) : '#18181B'}
                  stripes={p.stripes}
                  height={9}
                />
              </View>
              <Text style={styles.histName}>{p.beltNamePt}</Text>
              <Text style={styles.histDate}>{fmtDate(p.date)}</Text>
            </View>
          ))
        )}
      </View>

      {/* Log de presença (BJJ Control-style attendance history) */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('student.attendanceLog')}</Text>
        {recentAttendance.length === 0 ? (
          <Text style={styles.empty}>{t('student.attendanceLog.empty')}</Text>
        ) : (
          recentAttendance.map((a, i) => (
            <View key={i} style={styles.logRow}>
              <MaterialCommunityIcons name="check-circle" size={16} color="#16A34A" />
              <Text style={styles.logClass}>{a.className}</Text>
              <Text style={styles.logDate}>{fmtDate(a.date)}</Text>
            </View>
          ))
        )}
      </View>

      {/* Notas do instrutor */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('student.notes')}</Text>
        <Text style={styles.notesHint}>{t('student.notes.hint')}</Text>
        <View style={styles.noteCompose}>
          <TextInput
            mode="outlined"
            value={note}
            onChangeText={setNote}
            placeholder={t('student.notes.placeholder')}
            multiline
            dense
            style={styles.noteInput}
          />
          <Button
            mode="contained"
            compact
            disabled={note.trim().length === 0 || addNote.isPending}
            loading={addNote.isPending}
            onPress={() => addNote.mutate()}>
            {t('student.notes.add')}
          </Button>
        </View>
        {(notes.data ?? []).map((n) => (
          <View key={n.id} style={styles.note}>
            <View style={{ flex: 1 }}>
              <Text style={styles.noteContent}>{n.content}</Text>
              <Text style={styles.noteMeta}>
                {n.authorName} · {fmtDate(n.createdAt)}
              </Text>
            </View>
            <Pressable onPress={() => removeNote.mutate(n.id)} hitSlop={8}>
              <MaterialCommunityIcons name="trash-can-outline" size={18} color={palette.textSecondary} />
            </Pressable>
          </View>
        ))}
      </View>

      <GraduateSheet
        visible={gradOpen}
        student={s}
        onClose={() => setGradOpen(false)}
        onDone={() => {
          queryClient.invalidateQueries({ queryKey: ['studentAdmin', s.userId] });
          queryClient.invalidateQueries({ queryKey: ['gymMembers'] });
          queryClient.invalidateQueries({ queryKey: ['userProfile', s.userId] });
        }}
      />

      {painId != null && <PainDetail userId={s.userId} assessmentId={painId} onClose={() => setPainId(null)} />}
    </ScrollView>
  );
}

function PainDetail({ userId, assessmentId, onClose }: { userId: number; assessmentId: number; onClose: () => void }) {
  const [view, setView] = useState<BodyView>('front');
  const q = useQuery({
    queryKey: ['studentPainDetail', userId, assessmentId],
    queryFn: () => getStudentPainAssessment(userId, assessmentId),
  });
  const a = q.data;
  const painMap = useMemo(() => {
    const m: Record<string, number> = {};
    (a?.areas ?? []).forEach((ar) => (m[ar.region] = ar.intensity));
    return m;
  }, [a]);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => undefined}>
          <View style={styles.sheetHandle} />
          {!a ? (
            <Text style={styles.empty}>{t('picker.loading')}</Text>
          ) : (
            <ScrollView style={{ maxHeight: 480 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.sheetTitle}>{fmtDate(a.assessedOn)}</Text>

              {/* Body map — same mannequin view the student sees */}
              <View style={styles.bodyToggle}>
                {(['front', 'back'] as const).map((v) => (
                  <Pressable key={v} style={[styles.bodyToggleBtn, view === v && styles.bodyToggleOn]} onPress={() => setView(v)}>
                    <Text style={[styles.bodyToggleText, view === v && styles.bodyToggleTextOn]}>
                      {t(v === 'front' ? 'body.front' : 'body.back')}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View style={{ alignItems: 'center', marginBottom: 12 }}>
                <BodyMap view={view} pain={painMap} onRegionPress={() => undefined} width={230} />
              </View>

              {a.areas.map((ar, i) => (
                <View key={i} style={styles.painArea}>
                  <View style={[styles.painDot, { backgroundColor: intensityColor(ar.intensity) }]} />
                  <Text style={styles.painAreaName}>{bodyRegionLabel(ar.region)}</Text>
                  <Text style={styles.painAreaMeta}>
                    {ar.painType ? `${painTypeLabel(ar.painType)} · ` : ''}
                    {ar.intensity}/10
                  </Text>
                </View>
              ))}
              {a.onsetDate ? <PainCtx label={t('pain.assess.onset')} value={fmtDate(a.onsetDate)} /> : null}
              {a.trend ? <PainCtx label={t('pain.assess.trend')} value={trendLabel(a.trend)} /> : null}
              {a.frequency ? <PainCtx label={t('pain.assess.frequency')} value={frequencyLabel(a.frequency)} /> : null}
              {a.relieves ? <PainCtx label={t('pain.assess.relieves')} value={a.relieves} /> : null}
              {a.worsens ? <PainCtx label={t('pain.assess.worsens')} value={a.worsens} /> : null}
              {a.notes ? <PainCtx label={t('pain.assess.notes')} value={a.notes} /> : null}
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function PainCtx({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.painCtx}>
      <Text style={styles.painCtxLabel}>{label}</Text>
      <Text style={styles.painCtxValue}>{value}</Text>
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function GraduateSheet({
  visible,
  student,
  onClose,
  onDone,
}: {
  visible: boolean;
  student: StudentAdmin;
  onClose: () => void;
  onDone: () => void;
}) {
  const [slug, setSlug] = useState(student.belt?.slug ?? 'adult-white');
  const [stripes, setStripes] = useState(student.belt?.stripes ?? 0);
  const belt = ALL_BELTS.find((b) => b.slug === slug) ?? ALL_BELTS[0];
  const maxStripes = maxStripesFor(slug);
  const cappedStripes = Math.min(stripes, maxStripes);

  const promote = useMutation({
    mutationFn: () => promoteMember(student.userId, slug, cappedStripes),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onDone();
      onClose();
    },
    onError: (e) => Alert.alert(apiErrorMessage(e)),
  });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => undefined}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>{tf('student.graduateTitle', { name: student.displayName.split(' ')[0] })}</Text>
          <View style={styles.preview}>
            <BeltVisual color={belt.color} rankBarColor={rankBarColorFor(slug)} stripes={cappedStripes} height={26} />
          </View>
          <Text style={styles.label}>{t('student.belt')}</Text>
          <View style={styles.beltChips}>
            {ALL_BELTS.map((b) => (
              <Pressable
                key={b.slug}
                onPress={() => setSlug(b.slug)}
                style={[styles.beltChip, { backgroundColor: b.color }, slug === b.slug && styles.beltChipOn]}>
                <Text style={[styles.beltChipText, b.darkText && { color: '#111' }]}>{b.namePt}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.label}>{t('student.stripes')}</Text>
          <View style={styles.stripeRow}>
            <Pressable
              style={styles.stripeBtn}
              onPress={() => setStripes((n) => Math.max(0, n - 1))}
              hitSlop={6}>
              <MaterialCommunityIcons name="minus" size={18} color={palette.textPrimary} />
            </Pressable>
            <Text style={styles.stripeNum}>{cappedStripes}</Text>
            <Pressable
              style={styles.stripeBtn}
              onPress={() => setStripes((n) => Math.min(maxStripes, n + 1))}
              hitSlop={6}>
              <MaterialCommunityIcons name="plus" size={18} color={palette.primary} />
            </Pressable>
          </View>
          <Button
            mode="contained"
            icon="check"
            style={{ marginTop: 18 }}
            loading={promote.isPending}
            disabled={promote.isPending}
            onPress={() => promote.mutate()}>
            {t('student.confirmGraduate')}
          </Button>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = makeStyles(() => ({
  container: { flex: 1, backgroundColor: palette.background },
  content: { padding: 16, paddingBottom: 40, gap: 14 },
  skeleton: { flex: 1, backgroundColor: palette.background, padding: 16 },

  header: { alignItems: 'center', paddingVertical: 8 },
  avatar: { width: 72, height: 72, borderRadius: 36 },
  avatarFallback: { backgroundColor: palette.surfaceVariant, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: palette.textPrimary, fontWeight: 'bold', fontSize: 22 },
  name: { color: palette.textPrimary, fontSize: 18, fontWeight: 'bold', marginTop: 10 },
  handle: { color: palette.textSecondary, fontSize: 13, marginTop: 2 },
  beltRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  beltName: { color: palette.textSecondary, fontSize: 13 },

  card: { backgroundColor: palette.surface, borderRadius: 16, padding: 16 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { color: palette.textPrimary, fontSize: 15, fontWeight: 'bold' },
  readyPill: { backgroundColor: '#16A34A', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  readyText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  counter: { color: palette.textPrimary, fontSize: 26, fontWeight: 'bold', marginTop: 10 },
  counterTarget: { color: palette.textSecondary, fontSize: 14, fontWeight: 'normal' },
  track: { height: 8, borderRadius: 999, backgroundColor: palette.surfaceVariant, overflow: 'hidden', marginTop: 8 },
  fill: { height: '100%', borderRadius: 999, backgroundColor: palette.primary },
  fillReady: { backgroundColor: '#16A34A' },
  sub: { color: palette.textSecondary, fontSize: 12, marginTop: 8 },

  statRow: { flexDirection: 'row', marginTop: 12, marginBottom: 6 },
  stat: { flex: 1 },
  statValue: { color: palette.textPrimary, fontSize: 22, fontWeight: 'bold' },
  statLabel: { color: palette.textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.surfaceVariant },
  metaLabel: { color: palette.textSecondary, fontSize: 13 },
  metaValue: { color: palette.textPrimary, fontSize: 13, fontWeight: '600' },

  histRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  histName: { color: palette.textPrimary, fontSize: 14, flex: 1 },
  histDate: { color: palette.textSecondary, fontSize: 12 },
  empty: { color: palette.textSecondary, fontSize: 13, marginTop: 8 },
  logRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  logClass: { color: palette.textPrimary, fontSize: 14, flex: 1 },
  logDate: { color: palette.textSecondary, fontSize: 12 },

  notesHint: { color: palette.textSecondary, fontSize: 12, marginTop: 2, marginBottom: 10 },
  noteCompose: { gap: 8 },
  noteInput: { backgroundColor: palette.surface },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.surfaceVariant, marginTop: 10 },
  noteContent: { color: palette.textPrimary, fontSize: 14, lineHeight: 19 },
  noteMeta: { color: palette.textSecondary, fontSize: 11, marginTop: 4 },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: palette.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 28 },
  sheetHandle: { width: 36, height: 4, borderRadius: 999, backgroundColor: palette.outline, alignSelf: 'center', marginBottom: 12 },
  sheetTitle: { color: palette.textPrimary, fontSize: 16, fontWeight: 'bold', textAlign: 'center', marginBottom: 14 },
  preview: { alignItems: 'center', marginBottom: 8 },
  label: { color: palette.textSecondary, fontSize: 12, fontWeight: '600', marginTop: 12, marginBottom: 8 },
  beltChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  beltChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 2, borderColor: 'transparent' },
  beltChipOn: { borderColor: palette.primary },
  beltChipText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  stripeRow: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  stripeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: palette.surfaceVariant, alignItems: 'center', justifyContent: 'center' },
  stripeNum: { color: palette.textPrimary, fontSize: 20, fontWeight: 'bold', minWidth: 24, textAlign: 'center' },

  painRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.surfaceVariant },
  painDate: { color: palette.textPrimary, fontSize: 14, fontWeight: '600' },
  painSub: { color: palette.textSecondary, fontSize: 12, marginTop: 2 },
  painArea: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.surfaceVariant },
  painDot: { width: 12, height: 12, borderRadius: 6 },
  painAreaName: { color: palette.textPrimary, fontSize: 14, flex: 1 },
  painAreaMeta: { color: palette.textSecondary, fontSize: 12 },
  painCtx: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 6, marginTop: 2 },
  painCtxLabel: { color: palette.textSecondary, fontSize: 12 },
  painCtxValue: { color: palette.textPrimary, fontSize: 12, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  bodyToggle: { flexDirection: 'row', alignSelf: 'center', backgroundColor: palette.surfaceVariant, borderRadius: 10, padding: 3, marginVertical: 12 },
  bodyToggleBtn: { paddingHorizontal: 22, paddingVertical: 7, borderRadius: 8 },
  bodyToggleOn: { backgroundColor: palette.surface },
  bodyToggleText: { color: palette.textSecondary, fontSize: 13, fontWeight: '600' },
  bodyToggleTextOn: { color: palette.textPrimary },
}));
