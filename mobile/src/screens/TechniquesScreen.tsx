import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text, TextInput } from 'react-native-paper';

import { resolveMediaUrl } from '../api/posts';
import {
  Technique,
  getFavoriteTechniques,
  getPersonalTechniques,
  getTechniques,
  toggleTechniqueFavorite,
} from '../api/techniques';
import VideoModal from '../components/VideoModal';
import { CATEGORY_COLORS, DIFFICULTY_LABELS, categoryLabel } from '../constants/techniques';
import { t } from '../i18n';
import type { HomeStackParamList } from '../navigation/HomeNavigator';
import { makeStyles, palette } from '../theme/theme';

type Nav = NativeStackNavigationProp<HomeStackParamList>;
const FAV = '__FAV__';

export default function TechniquesScreen() {
  const navigation = useNavigation<Nav>();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'library' | 'mine'>('library');
  const [category, setCategory] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [playing, setPlaying] = useState<string | null>(null);
  const [mineCategory, setMineCategory] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ['techniques', category === FAV ? null : category, search.trim()],
    queryFn: () => getTechniques({ category: category && category !== FAV ? category : undefined, q: search.trim() || undefined }),
  });
  const favorites = useQuery({ queryKey: ['favoriteTechniques'], queryFn: getFavoriteTechniques, enabled: category === FAV });
  const personal = useQuery({ queryKey: ['personalTechniques'], queryFn: getPersonalTechniques, enabled: tab === 'mine' });

  const fav = useMutation({
    mutationFn: (id: number) => toggleTechniqueFavorite(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['techniques'] });
      qc.invalidateQueries({ queryKey: ['favoriteTechniques'] });
    },
  });

  const items: Technique[] = category === FAV ? favorites.data ?? [] : list.data?.items ?? [];
  const categories = list.data?.categories ?? [];

  // Personal library organized by the category names the user assigns ("files").
  const mineData = personal.data ?? [];
  const mineCategories = Array.from(new Set(mineData.map((p) => p.category).filter((c): c is string => !!c)));
  const mineItems = mineCategory ? mineData.filter((p) => p.category === mineCategory) : mineData;

  return (
    <View style={styles.screen}>
      <View style={styles.segment}>
        {(['library', 'mine'] as const).map((key) => (
          <Pressable
            key={key}
            onPress={() => setTab(key)}
            style={[styles.segmentBtn, tab === key && styles.segmentActive]}>
            <Text style={[styles.segmentText, tab === key && styles.segmentTextActive]}>
              {t(key === 'library' ? 'techniques.tab.library' : 'techniques.tab.mine')}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'library' ? (
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <TextInput
            mode="outlined"
            dense
            placeholder={t('techniques.search')}
            value={search}
            onChangeText={setSearch}
            left={<TextInput.Icon icon="magnify" />}
            style={styles.search}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            <Chip label={t('techniques.all')} active={category === null} onPress={() => setCategory(null)} />
            <Chip label={t('techniques.favorites')} icon="star" active={category === FAV} onPress={() => setCategory(FAV)} />
            {categories.map((c) => (
              <Chip
                key={c.category}
                label={`${categoryLabel(c.category)} ${c.count}`}
                color={CATEGORY_COLORS[c.category]}
                active={category === c.category}
                onPress={() => setCategory(c.category)}
              />
            ))}
          </ScrollView>

          {list.isLoading || (category === FAV && favorites.isLoading) ? (
            <ActivityIndicator style={{ marginTop: 32 }} color={palette.primary} />
          ) : items.length === 0 ? (
            <Text style={styles.empty}>{t('techniques.empty')}</Text>
          ) : (
            items.map((tech) => (
              <Pressable
                key={tech.id}
                style={styles.row}
                onPress={() => navigation.navigate('TechniqueDetail', { id: tech.id })}>
                <View style={[styles.dot, { backgroundColor: CATEGORY_COLORS[tech.category] ?? palette.primary }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowName}>{tech.name}</Text>
                  <Text style={styles.rowSub}>
                    {categoryLabel(tech.category)}
                    {tech.position ? ` · ${tech.position}` : ''} · {DIFFICULTY_LABELS[tech.difficulty]}
                  </Text>
                </View>
                <Pressable hitSlop={10} onPress={() => fav.mutate(tech.id)}>
                  <MaterialCommunityIcons
                    name={tech.favorite ? 'star' : 'star-outline'}
                    size={22}
                    color={tech.favorite ? palette.pro : palette.textSecondary}
                  />
                </Pressable>
              </Pressable>
            ))
          )}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          <Pressable
            style={styles.addBtn}
            onPress={() => navigation.navigate('PersonalTechniqueEditor', {})}>
            <MaterialCommunityIcons name="plus-circle" size={20} color={palette.primary} />
            <Text style={styles.addText}>{t('techniques.mine.add')}</Text>
          </Pressable>
          {mineCategories.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              <Chip label={t('techniques.all')} active={mineCategory === null} onPress={() => setMineCategory(null)} />
              {mineCategories.map((c) => (
                <Chip
                  key={c}
                  label={c}
                  active={mineCategory === c}
                  onPress={() => setMineCategory(mineCategory === c ? null : c)}
                />
              ))}
            </ScrollView>
          )}
          {personal.isLoading ? (
            <ActivityIndicator style={{ marginTop: 32 }} color={palette.primary} />
          ) : mineData.length === 0 ? (
            <Text style={styles.empty}>{t('techniques.mine.empty')}</Text>
          ) : (
            mineItems.map((p) => (
              <Pressable
                key={p.id}
                style={styles.row}
                onPress={() => navigation.navigate('PersonalTechniqueEditor', { technique: p })}>
                <View style={[styles.dot, { backgroundColor: p.color ?? palette.primary }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowName}>{p.name}</Text>
                  {!!(p.category || p.notes) && (
                    <Text style={styles.rowSub} numberOfLines={1}>
                      {[p.category && categoryLabel(p.category), p.notes].filter(Boolean).join(' · ')}
                    </Text>
                  )}
                </View>
                {!!(p.mediaUrl || p.videoUrl) && (
                  <Pressable
                    hitSlop={8}
                    onPress={() => {
                      if (p.mediaUrl) setPlaying(resolveMediaUrl(p.mediaUrl));
                      else if (p.videoUrl) Linking.openURL(p.videoUrl);
                    }}>
                    <MaterialCommunityIcons
                      name={p.mediaUrl ? 'play-circle' : 'open-in-new'}
                      size={24}
                      color={palette.primary}
                    />
                  </Pressable>
                )}
              </Pressable>
            ))
          )}
        </ScrollView>
      )}

      {playing && <VideoModal url={playing} onClose={() => setPlaying(null)} />}
    </View>
  );
}

function Chip({
  label,
  active,
  onPress,
  icon,
  color,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  icon?: string;
  color?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && { backgroundColor: (color ?? palette.primary) + '26', borderColor: color ?? palette.primary }]}>
      {icon && (
        <MaterialCommunityIcons name={icon as never} size={13} color={active ? color ?? palette.primary : palette.textSecondary} />
      )}
      <Text style={[styles.chipText, active && { color: color ?? palette.primary }]}>{label}</Text>
    </Pressable>
  );
}

const styles = makeStyles(() => ({
  screen: { flex: 1, backgroundColor: palette.background },
  segment: {
    flexDirection: 'row',
    margin: 16,
    marginBottom: 8,
    backgroundColor: palette.surface,
    borderRadius: 12,
    padding: 4,
  },
  segmentBtn: { flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: 'center' },
  segmentActive: { backgroundColor: palette.surfaceVariant },
  segmentText: { color: palette.textSecondary, fontWeight: '600' },
  segmentTextActive: { color: palette.textPrimary },
  body: { paddingHorizontal: 16, paddingBottom: 32 },
  search: { backgroundColor: palette.surface, marginBottom: 10 },
  chips: { gap: 8, paddingVertical: 4, paddingRight: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.outline,
    backgroundColor: palette.surface,
  },
  chipText: { color: palette.textSecondary, fontSize: 12, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: palette.surface,
    borderRadius: 12,
    padding: 14,
    marginTop: 10,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  rowName: { color: palette.textPrimary, fontWeight: '600', fontSize: 15 },
  rowSub: { color: palette.textSecondary, fontSize: 12, marginTop: 2 },
  empty: { color: palette.textSecondary, textAlign: 'center', marginTop: 40 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: palette.primary,
    marginTop: 4,
  },
  addText: { color: palette.primary, fontWeight: '700' },
}));
