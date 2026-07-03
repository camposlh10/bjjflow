import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { ReactNode, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { ActivityIndicator, Button, Text, TextInput } from 'react-native-paper';

import { apiErrorMessage } from '../api/auth';
import {
  AssessmentSummary,
  CreateAssessmentBody,
  PainAssessment,
  createAssessment,
  deleteAssessment,
  getAssessment,
  getLatestAssessment,
  listAssessments,
} from '../api/pain';
import BodyMap from '../components/BodyMap';
import DateField from '../components/DateField';
import { BodyView, bodyRegionLabel, intensityColor } from '../constants/body';
import {
  FREQUENCIES,
  PAIN_TYPES,
  PainTypeKey,
  TRENDS,
  frequencyLabel,
  painTypeDesc,
  painTypeLabel,
  painTypeMeta,
  trendColor,
  trendLabel,
} from '../constants/painTypes';
import { t, tf } from '../i18n';
import { makeStyles, palette } from '../theme/theme';

type AreaState = { painType: string | null; intensity: number; note: string };
type AreaMap = Record<string, AreaState>;

function intensityWord(v: number): string {
  if (v <= 0) return t('body.legend.low');
  if (v < 4) return t('body.legend.low');
  if (v < 7) return t('body.legend.mid');
  return t('body.legend.high');
}

function formatDay(iso: string): string {
  const [y, m, d] = iso.split('-');
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

const pad2 = (n: number) => String(n).padStart(2, '0');
const toISODate = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const parseISODate = (iso: string): Date => new Date(`${iso}T00:00:00`);

function summarize(areas: AreaMap) {
  const entries = Object.entries(areas);
  const count = entries.length;
  const avg = count ? Math.round((entries.reduce((s, [, a]) => s + a.intensity, 0) / count) * 10) / 10 : 0;
  const counts: Record<string, number> = {};
  for (const [, a] of entries) if (a.painType) counts[a.painType] = (counts[a.painType] ?? 0) + 1;
  let predominant: string | null = null;
  let best = 0;
  for (const [k, n] of Object.entries(counts)) if (n > best) { predominant = k; best = n; }
  return { count, avg, predominant };
}

export default function BodyMapScreen() {
  const qc = useQueryClient();
  const { width: screenW } = useWindowDimensions();
  const bodyWidth = Math.min(screenW - 48, 320);

  const [tab, setTab] = useState<'new' | 'history'>('new');
  const [view, setView] = useState<BodyView>('front');
  const [areas, setAreas] = useState<AreaMap>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);

  // Assessment-level context.
  const [onset, setOnset] = useState<Date | null>(null);
  const [trend, setTrend] = useState<string | null>(null);
  const [frequency, setFrequency] = useState<string | null>(null);
  const [relieves, setRelieves] = useState('');
  const [worsens, setWorsens] = useState('');
  const [notes, setNotes] = useState('');

  const history = useQuery({ queryKey: ['painAssessments'], queryFn: () => listAssessments() });
  const latest = useQuery({ queryKey: ['painAssessmentLatest'], queryFn: getLatestAssessment });

  const painByRegion: Record<string, number> = {};
  Object.entries(areas).forEach(([r, a]) => (painByRegion[r] = a.intensity));
  const areaEntries = Object.entries(areas).sort((a, b) => b[1].intensity - a[1].intensity);
  const summary = summarize(areas);

  const resetForm = () => {
    setAreas({});
    setOnset(null);
    setTrend(null);
    setFrequency(null);
    setRelieves('');
    setWorsens('');
    setNotes('');
  };

  const save = useMutation({
    mutationFn: () => {
      const body: CreateAssessmentBody = {
        onsetDate: onset ? toISODate(onset) : null,
        trend,
        frequency,
        relieves: relieves.trim() || null,
        worsens: worsens.trim() || null,
        notes: notes.trim() || null,
        areas: areaEntries.map(([region, a]) => ({
          region,
          painType: a.painType,
          intensity: a.intensity,
          note: a.note.trim() || null,
        })),
      };
      return createAssessment(body);
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: ['painAssessments'] });
      qc.invalidateQueries({ queryKey: ['painAssessmentLatest'] });
      resetForm();
      setTab('history');
      Alert.alert(t('pain.assess.saved'));
    },
    onError: (e) => Alert.alert(apiErrorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: deleteAssessment,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['painAssessments'] }),
    onError: (e) => Alert.alert(apiErrorMessage(e)),
  });

  const copyLast = () => {
    const a = latest.data;
    if (!a) return;
    const next: AreaMap = {};
    a.areas.forEach((x) => (next[x.region] = { painType: x.painType, intensity: x.intensity, note: x.note ?? '' }));
    setAreas(next);
    setOnset(a.onsetDate ? parseISODate(a.onsetDate) : null);
    setTrend(a.trend);
    setFrequency(a.frequency);
    setRelieves(a.relieves ?? '');
    setWorsens(a.worsens ?? '');
    setNotes(a.notes ?? '');
    Haptics.selectionAsync();
  };

  const onSave = () => {
    if (areaEntries.length === 0) {
      Alert.alert(t('pain.assess.needAreas'));
      return;
    }
    save.mutate();
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.body}>
      {/* New vs History */}
      <View style={styles.segment}>
        {(['new', 'history'] as const).map((m) => (
          <Pressable key={m} style={[styles.segBtn, tab === m && styles.segOn]} onPress={() => setTab(m)}>
            <Text style={[styles.segText, tab === m && styles.segTextOn]}>
              {t(m === 'new' ? 'pain.assess.tab.new' : 'pain.assess.tab.history')}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'new' ? (
        <>
          {/* Body + controls */}
          <View style={styles.toolRow}>
            <View style={styles.viewToggle}>
              {(['front', 'back'] as const).map((v) => (
                <Pressable key={v} style={[styles.toggleBtn, view === v && styles.toggleActive]} onPress={() => setView(v)}>
                  <Text style={[styles.toggleText, view === v && styles.toggleTextActive]}>
                    {t(v === 'front' ? 'body.front' : 'body.back')}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.toolBtns}>
              {latest.data && (
                <Pressable style={styles.ghostBtn} onPress={copyLast} hitSlop={6}>
                  <MaterialCommunityIcons name="content-copy" size={14} color={palette.textSecondary} />
                  <Text style={styles.ghostText}>{t('pain.assess.copyLast')}</Text>
                </Pressable>
              )}
              {areaEntries.length > 0 && (
                <Pressable style={styles.ghostBtn} onPress={() => setAreas({})} hitSlop={6}>
                  <MaterialCommunityIcons name="trash-can-outline" size={14} color={palette.primary} />
                  <Text style={[styles.ghostText, { color: palette.primary }]}>{t('pain.assess.clear')}</Text>
                </Pressable>
              )}
            </View>
          </View>

          <View style={styles.bodyWrap}>
            <BodyMap view={view} pain={painByRegion} onRegionPress={(r) => setEditing(r)} width={bodyWidth} />
          </View>

          <View style={styles.legend}>
            <Legend color="#E0A82E" label={t('body.legend.low')} />
            <Legend color="#F76808" label={t('body.legend.mid')} />
            <Legend color="#E5484D" label={t('body.legend.high')} />
          </View>
          <Text style={styles.hint}>{t('pain.assess.addHint')}</Text>

          {/* Selected areas */}
          <View style={styles.sectionHead}>
            <Text style={styles.section}>{t('pain.assess.areas')}</Text>
            {areaEntries.length > 0 && <Text style={styles.countPill}>{areaEntries.length}</Text>}
          </View>
          {areaEntries.length === 0 ? (
            <Text style={styles.none}>{t('pain.assess.empty')}</Text>
          ) : (
            areaEntries.map(([region, a]) => {
              const meta = painTypeMeta(a.painType);
              return (
                <View key={region} style={styles.areaRow}>
                  <View style={[styles.dot, { backgroundColor: intensityColor(a.intensity) }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.areaName} numberOfLines={1}>{bodyRegionLabel(region)}</Text>
                    {a.painType && (
                      <View style={styles.areaTypeRow}>
                        {meta && <MaterialCommunityIcons name={meta.icon} size={12} color={meta.color} />}
                        <Text style={styles.areaType}>{painTypeLabel(a.painType)}</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.areaMeter}>
                    <View style={styles.meterTrack}>
                      <View style={[styles.meterFill, { width: `${a.intensity * 10}%`, backgroundColor: intensityColor(a.intensity) }]} />
                    </View>
                    <Text style={[styles.areaVal, { color: intensityColor(a.intensity) }]}>{a.intensity}</Text>
                  </View>
                  <Pressable onPress={() => setEditing(region)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('a11y.edit')} style={styles.iconBtn}>
                    <MaterialCommunityIcons name="pencil" size={16} color={palette.textSecondary} />
                  </Pressable>
                  <Pressable
                    onPress={() => setAreas((p) => { const n = { ...p }; delete n[region]; return n; })}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={t('a11y.delete')}
                    style={styles.iconBtn}>
                    <MaterialCommunityIcons name="trash-can-outline" size={16} color={palette.primary} />
                  </Pressable>
                </View>
              );
            })
          )}

          {/* Details */}
          <Text style={[styles.section, { marginTop: 18 }]}>{t('pain.assess.details')}</Text>
          <View style={styles.card}>
            <Text style={styles.label}>{t('pain.assess.onset')}</Text>
            {onset ? (
              <View style={styles.onsetRow}>
                <View style={{ flex: 1 }}>
                  <DateField value={onset} onChange={setOnset} maximumDate={new Date()} />
                </View>
                <Pressable
                  onPress={() => setOnset(null)}
                  accessibilityRole="button"
                  accessibilityLabel={t('a11y.remove')}>
                  <MaterialCommunityIcons name="close-circle" size={22} color={palette.textSecondary} />
                </Pressable>
              </View>
            ) : (
              <Pressable style={styles.onsetAdd} onPress={() => setOnset(new Date())} accessibilityRole="button">
                <MaterialCommunityIcons name="calendar-plus" size={18} color={palette.textSecondary} />
                <Text style={styles.onsetAddText}>{t('pain.assess.onset.add')}</Text>
              </Pressable>
            )}

            <Text style={styles.label}>{t('pain.assess.trend')}</Text>
            <View style={styles.trendRow}>
              {TRENDS.map((tr) => {
                const on = trend === tr;
                return (
                  <Pressable key={tr} style={[styles.trendBtn, on && { backgroundColor: trendColor(tr) }]} onPress={() => setTrend(on ? null : tr)}>
                    <Text style={[styles.trendText, on && { color: '#fff' }]}>{trendLabel(tr)}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.label}>{t('pain.assess.frequency')}</Text>
            <View style={styles.chips}>
              {FREQUENCIES.map((f) => {
                const on = frequency === f;
                return (
                  <Pressable key={f} style={[styles.chip, on && styles.chipOn]} onPress={() => setFrequency(on ? null : f)}>
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>{frequencyLabel(f)}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.label}>{t('pain.assess.relieves')}</Text>
            <TextInput mode="outlined" dense value={relieves} onChangeText={setRelieves} placeholder={t('pain.assess.relieves.ph')} style={styles.input} />
            <Text style={styles.label}>{t('pain.assess.worsens')}</Text>
            <TextInput mode="outlined" dense value={worsens} onChangeText={setWorsens} placeholder={t('pain.assess.worsens.ph')} style={styles.input} />
            <Text style={styles.label}>{t('pain.assess.notes')}</Text>
            <TextInput mode="outlined" value={notes} onChangeText={setNotes} placeholder={t('pain.assess.notes.ph')} multiline numberOfLines={3} style={styles.input} />
          </View>

          {/* Summary */}
          <Text style={[styles.section, { marginTop: 18 }]}>{t('pain.assess.summary')}</Text>
          <View style={styles.summaryGrid}>
            <SummaryCard label={t('pain.assess.summary.avg')}>
              <Text style={styles.summaryBig}>{summary.avg.toFixed(1)}<Text style={styles.summaryUnit}>/10</Text></Text>
              <Text style={[styles.summarySub, { color: intensityColor(Math.round(summary.avg)) }]}>{summary.count ? intensityWord(summary.avg) : t('pain.assess.none')}</Text>
            </SummaryCard>
            <SummaryCard label={t('pain.assess.summary.areas')}>
              <Text style={styles.summaryBig}>{summary.count}</Text>
              <Text style={styles.summarySub}>{t('pain.assess.summary.regions')}</Text>
            </SummaryCard>
            <SummaryCard label={t('pain.assess.summary.type')}>
              {summary.predominant ? (
                <View style={styles.summaryTypeRow}>
                  {painTypeMeta(summary.predominant) && (
                    <MaterialCommunityIcons name={painTypeMeta(summary.predominant)!.icon} size={18} color={painTypeMeta(summary.predominant)!.color} />
                  )}
                  <Text style={styles.summaryMid}>{painTypeLabel(summary.predominant)}</Text>
                </View>
              ) : (
                <Text style={styles.summaryMid}>{t('pain.assess.none')}</Text>
              )}
            </SummaryCard>
            <SummaryCard label={t('pain.assess.summary.freq')}>
              <Text style={styles.summaryMid}>{frequency ? frequencyLabel(frequency) : t('pain.assess.none')}</Text>
            </SummaryCard>
          </View>

          <Button
            mode="contained"
            icon="check"
            loading={save.isPending}
            disabled={save.isPending}
            onPress={onSave}
            contentStyle={{ paddingVertical: 5 }}
            style={{ marginTop: 18, borderRadius: 12 }}>
            {t('pain.assess.save')}
          </Button>
        </>
      ) : (
        <HistoryList
          summaries={history.data ?? []}
          loading={history.isLoading}
          onOpen={setDetailId}
          onDelete={(id) =>
            Alert.alert(t('pain.assess.history.delete'), t('pain.assess.history.deleteMsg'), [
              { text: t('common.cancel'), style: 'cancel' },
              { text: t('pain.assess.history.delete'), style: 'destructive', onPress: () => remove.mutate(id) },
            ])
          }
        />
      )}

      <AreaEditorSheet
        region={editing}
        initial={editing ? areas[editing] : undefined}
        onClose={() => setEditing(null)}
        onSave={(region, next) => {
          setAreas((p) => {
            const n = { ...p };
            if (next.intensity <= 0) delete n[region];
            else n[region] = next;
            return n;
          });
          setEditing(null);
        }}
      />

      <AssessmentDetailModal id={detailId} onClose={() => setDetailId(null)} bodyWidth={bodyWidth} />
    </ScrollView>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

function SummaryCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryLabel}>{label}</Text>
      {children}
    </View>
  );
}

/** Bottom sheet to set a region's intensity (0-10), pain type and note. */
function AreaEditorSheet({
  region,
  initial,
  onClose,
  onSave,
}: {
  region: string | null;
  initial?: AreaState;
  onClose: () => void;
  onSave: (region: string, next: AreaState) => void;
}) {
  const [intensity, setIntensity] = useState(initial?.intensity ?? 5);
  const [painType, setPainType] = useState<string | null>(initial?.painType ?? null);
  const [note, setNote] = useState(initial?.note ?? '');

  // Re-seed local state each time a region opens.
  const [seeded, setSeeded] = useState<string | null>(null);
  if (region && seeded !== region) {
    setSeeded(region);
    setIntensity(initial?.intensity ?? 5);
    setPainType(initial?.painType ?? null);
    setNote(initial?.note ?? '');
  }
  if (!region && seeded) setSeeded(null);

  return (
    <Modal visible={!!region} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => undefined}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>{region ? bodyRegionLabel(region) : ''}</Text>

          <Text style={styles.label}>{t('body.intensity')}</Text>
          <View style={styles.scale}>
            {Array.from({ length: 11 }).map((_, i) => (
              <Pressable
                key={i}
                onPress={() => setIntensity(i)}
                style={[styles.scaleBtn, { backgroundColor: i === intensity ? (i === 0 ? palette.outline : intensityColor(i)) : palette.surfaceVariant }]}>
                <Text style={[styles.scaleText, i === intensity && { color: '#fff', fontWeight: '800' }]}>{i}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>{t('pain.assess.area.type')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeRow}>
            {PAIN_TYPES.map((pt) => {
              const on = painType === pt.key;
              return (
                <Pressable
                  key={pt.key}
                  onPress={() => setPainType(on ? null : pt.key)}
                  style={[styles.typeChip, on && { borderColor: pt.color, backgroundColor: pt.color + '22' }]}>
                  <MaterialCommunityIcons name={pt.icon} size={16} color={on ? pt.color : palette.textSecondary} />
                  <Text style={[styles.typeLabel, on && { color: palette.textPrimary }]}>{painTypeLabel(pt.key)}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {painType && <Text style={styles.typeDesc}>{painTypeDesc(painType as PainTypeKey)}</Text>}

          <TextInput
            mode="outlined"
            dense
            value={note}
            onChangeText={setNote}
            placeholder={t('pain.assess.area.note.ph')}
            style={[styles.input, { marginTop: 10 }]}
          />

          <View style={styles.sheetActions}>
            {initial && (
              <Button mode="text" textColor={palette.primary} onPress={() => region && onSave(region, { painType, intensity: 0, note })}>
                {t('pain.assess.area.remove')}
              </Button>
            )}
            <Button mode="contained" style={{ flex: 1, borderRadius: 12 }} onPress={() => region && onSave(region, { painType, intensity, note })}>
              {t('pain.assess.area.save')}
            </Button>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function HistoryList({
  summaries,
  loading,
  onOpen,
  onDelete,
}: {
  summaries: AssessmentSummary[];
  loading: boolean;
  onOpen: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} color={palette.primary} />;
  if (summaries.length === 0) return <Text style={styles.none}>{t('pain.assess.history.empty')}</Text>;
  return (
    <View style={{ marginTop: 4 }}>
      {summaries.map((s) => (
        <Pressable key={s.id} style={styles.histRow} onPress={() => onOpen(s.id)}>
          <View style={[styles.histAvg, { borderColor: intensityColor(Math.round(s.avgIntensity)) }]}>
            <Text style={[styles.histAvgVal, { color: intensityColor(Math.round(s.avgIntensity)) }]}>{s.avgIntensity.toFixed(1)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.histDate}>{formatDay(s.assessedOn)}</Text>
            <Text style={styles.histMeta} numberOfLines={1}>
              {tf('pain.assess.history.areas', { n: s.areaCount })}
              {s.predominantType ? ` · ${painTypeLabel(s.predominantType)}` : ''}
            </Text>
          </View>
          {s.trend && (
            <View style={[styles.trendTag, { backgroundColor: trendColor(s.trend) + '22' }]}>
              <MaterialCommunityIcons
                name={s.trend === 'BETTER' ? 'arrow-down' : s.trend === 'WORSE' ? 'arrow-up' : 'minus'}
                size={12}
                color={trendColor(s.trend)}
              />
              <Text style={[styles.trendTagText, { color: trendColor(s.trend) }]}>{trendLabel(s.trend)}</Text>
            </View>
          )}
          <Pressable onPress={() => onDelete(s.id)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('a11y.delete')} style={styles.iconBtn}>
            <MaterialCommunityIcons name="trash-can-outline" size={16} color={palette.primary} />
          </Pressable>
        </Pressable>
      ))}
    </View>
  );
}

function AssessmentDetailModal({ id, onClose, bodyWidth }: { id: number | null; onClose: () => void; bodyWidth: number }) {
  const [view, setView] = useState<BodyView>('front');
  const detail = useQuery({ queryKey: ['painAssessment', id], queryFn: () => getAssessment(id as number), enabled: id != null });
  const a: PainAssessment | undefined = detail.data;
  const painByRegion: Record<string, number> = {};
  a?.areas.forEach((x) => (painByRegion[x.region] = x.intensity));

  return (
    <Modal visible={id != null} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.detailScreen}>
        <View style={styles.detailHead}>
          <Text style={styles.detailTitle}>{a ? formatDay(a.assessedOn) : t('pain.assess.detail.title')}</Text>
          <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('a11y.close')}>
            <MaterialCommunityIcons name="close" size={24} color={palette.textPrimary} />
          </Pressable>
        </View>
        {!a ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={palette.primary} />
        ) : (
          <ScrollView contentContainerStyle={styles.body}>
            <View style={styles.viewToggle}>
              {(['front', 'back'] as const).map((v) => (
                <Pressable key={v} style={[styles.toggleBtn, view === v && styles.toggleActive]} onPress={() => setView(v)}>
                  <Text style={[styles.toggleText, view === v && styles.toggleTextActive]}>
                    {t(v === 'front' ? 'body.front' : 'body.back')}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.bodyWrap}>
              <BodyMap view={view} pain={painByRegion} onRegionPress={() => undefined} width={bodyWidth} />
            </View>

            {a.areas.map((x) => {
              const meta = painTypeMeta(x.painType);
              return (
                <View key={x.region} style={styles.areaRow}>
                  <View style={[styles.dot, { backgroundColor: intensityColor(x.intensity) }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.areaName}>{bodyRegionLabel(x.region)}</Text>
                    {x.painType && (
                      <View style={styles.areaTypeRow}>
                        {meta && <MaterialCommunityIcons name={meta.icon} size={12} color={meta.color} />}
                        <Text style={styles.areaType}>{painTypeLabel(x.painType)}{x.note ? ` · ${x.note}` : ''}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.areaVal, { color: intensityColor(x.intensity) }]}>{x.intensity}/10</Text>
                </View>
              );
            })}

            <View style={[styles.card, { marginTop: 14 }]}>
              <DetailRow label={t('pain.assess.onset')} value={a.onsetDate ? formatDay(a.onsetDate) : t('pain.assess.none')} />
              <DetailRow label={t('pain.assess.trend')} value={a.trend ? trendLabel(a.trend) : t('pain.assess.none')} />
              <DetailRow label={t('pain.assess.frequency')} value={a.frequency ? frequencyLabel(a.frequency) : t('pain.assess.none')} />
              {a.relieves ? <DetailRow label={t('pain.assess.relieves')} value={a.relieves} /> : null}
              {a.worsens ? <DetailRow label={t('pain.assess.worsens')} value={a.worsens} /> : null}
              {a.notes ? <DetailRow label={t('pain.assess.notes')} value={a.notes} /> : null}
            </View>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = makeStyles(() => ({
  screen: { flex: 1, backgroundColor: palette.background },
  body: { padding: 16, paddingBottom: 48 },
  segment: { flexDirection: 'row', alignSelf: 'center', backgroundColor: palette.surface, borderRadius: 12, padding: 4, marginBottom: 14 },
  segBtn: { paddingVertical: 8, paddingHorizontal: 30, borderRadius: 9 },
  segOn: { backgroundColor: palette.primary },
  segText: { color: palette.textSecondary, fontWeight: '700' },
  segTextOn: { color: '#fff' },

  toolRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8 },
  viewToggle: { flexDirection: 'row', backgroundColor: palette.surface, borderRadius: 12, padding: 4 },
  toggleBtn: { paddingVertical: 7, paddingHorizontal: 20, borderRadius: 9 },
  toggleActive: { backgroundColor: palette.surfaceVariant },
  toggleText: { color: palette.textSecondary, fontWeight: '600' },
  toggleTextActive: { color: palette.textPrimary },
  toolBtns: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1, flexWrap: 'wrap', justifyContent: 'flex-end' },
  ghostBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 8, borderRadius: 8, backgroundColor: palette.surface },
  ghostText: { color: palette.textSecondary, fontSize: 12, fontWeight: '600' },

  bodyWrap: { alignItems: 'center', marginVertical: 4 },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 6, marginBottom: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: palette.textSecondary, fontSize: 12 },
  hint: { color: palette.textSecondary, fontSize: 12, textAlign: 'center', marginBottom: 14 },

  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  section: { color: palette.textSecondary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  countPill: { color: '#fff', backgroundColor: palette.primary, fontSize: 11, fontWeight: '800', minWidth: 20, textAlign: 'center', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1, overflow: 'hidden' },
  none: { color: palette.textSecondary, textAlign: 'center', paddingVertical: 16 },

  areaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: palette.surface, borderRadius: 12, padding: 12, marginBottom: 8 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  areaName: { color: palette.textPrimary, fontWeight: '600', fontSize: 14 },
  areaTypeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  areaType: { color: palette.textSecondary, fontSize: 12 },
  areaMeter: { alignItems: 'flex-end', gap: 3, width: 64 },
  meterTrack: { width: '100%', height: 5, borderRadius: 999, backgroundColor: palette.surfaceVariant, overflow: 'hidden' },
  meterFill: { height: '100%', borderRadius: 999 },
  areaVal: { fontWeight: '800', fontSize: 13 },
  iconBtn: { padding: 4 },

  card: { backgroundColor: palette.surface, borderRadius: 14, padding: 14 },
  label: { color: palette.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 10 },
  input: { backgroundColor: palette.surface },
  onsetRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  onsetAdd: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: palette.surfaceVariant, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, alignSelf: 'flex-start' },
  onsetAddText: { color: palette.textSecondary, fontSize: 14 },
  trendRow: { flexDirection: 'row', gap: 8 },
  trendBtn: { flex: 1, paddingVertical: 9, borderRadius: 10, backgroundColor: palette.surfaceVariant, alignItems: 'center' },
  trendText: { color: palette.textSecondary, fontWeight: '700', fontSize: 13 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: palette.surfaceVariant },
  chipOn: { backgroundColor: palette.primary },
  chipText: { color: palette.textSecondary, fontSize: 12, fontWeight: '600' },
  chipTextOn: { color: '#fff' },

  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  summaryCard: { flexGrow: 1, flexBasis: '46%', backgroundColor: palette.surface, borderRadius: 14, padding: 14, minHeight: 84, justifyContent: 'center' },
  summaryLabel: { color: palette.textSecondary, fontSize: 11, marginBottom: 8 },
  summaryBig: { color: palette.textPrimary, fontSize: 26, fontWeight: '800' },
  summaryUnit: { color: palette.textSecondary, fontSize: 13, fontWeight: '600' },
  summaryMid: { color: palette.textPrimary, fontSize: 16, fontWeight: '700' },
  summarySub: { color: palette.textSecondary, fontSize: 12, marginTop: 2 },
  summaryTypeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  // History
  histRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: palette.surface, borderRadius: 12, padding: 12, marginBottom: 10 },
  histAvg: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  histAvgVal: { fontWeight: '800', fontSize: 14 },
  histDate: { color: palette.textPrimary, fontWeight: '700', fontSize: 14 },
  histMeta: { color: palette.textSecondary, fontSize: 12, marginTop: 2 },
  trendTag: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  trendTagText: { fontSize: 11, fontWeight: '700' },

  // Editor sheet
  backdrop: { flex: 1, backgroundColor: '#00000088', justifyContent: 'flex-end' },
  sheet: { backgroundColor: palette.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 30 },
  handle: { width: 36, height: 4, borderRadius: 999, backgroundColor: palette.outline, alignSelf: 'center', marginBottom: 12 },
  sheetTitle: { color: palette.textPrimary, fontSize: 18, fontWeight: '800', marginBottom: 8 },
  scale: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  scaleBtn: { width: 28, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  scaleText: { color: palette.textPrimary, fontWeight: '600' },
  typeRow: { gap: 8, paddingVertical: 2, paddingRight: 8 },
  typeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: palette.outline, backgroundColor: palette.surfaceVariant },
  typeLabel: { color: palette.textSecondary, fontSize: 13, fontWeight: '600' },
  typeDesc: { color: palette.textSecondary, fontSize: 12, marginTop: 6 },
  sheetActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18 },

  // Detail modal
  detailScreen: { flex: 1, backgroundColor: palette.background },
  detailHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 52, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.surfaceVariant },
  detailTitle: { color: palette.textPrimary, fontSize: 18, fontWeight: '800' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.surfaceVariant },
  detailLabel: { color: palette.textSecondary, fontSize: 13 },
  detailValue: { color: palette.textPrimary, fontSize: 13, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
}));
