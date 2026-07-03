import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Text } from 'react-native-paper';

import { getTechnique, toggleTechniqueFavorite } from '../api/techniques';
import QueryState from '../components/QueryState';
import { CATEGORY_COLORS, DIFFICULTY_LABELS, categoryLabel } from '../constants/techniques';
import { t } from '../i18n';
import type { HomeStackParamList } from '../navigation/HomeNavigator';
import { makeStyles, palette } from '../theme/theme';

const BELT_LABELS: Record<string, string> = {
  white: 'Branca',
  grey: 'Cinza',
  yellow: 'Amarela',
  orange: 'Laranja',
  green: 'Verde',
  blue: 'Azul',
  purple: 'Roxa',
  brown: 'Marrom',
  black: 'Preta',
};

function beltLabel(slug: string | null): string | null {
  if (!slug) return null;
  const color = slug.split('-').pop() ?? slug;
  return BELT_LABELS[color] ?? slug;
}

export default function TechniqueDetailScreen() {
  const route = useRoute<RouteProp<HomeStackParamList, 'TechniqueDetail'>>();
  const navigation = useNavigation();
  const qc = useQueryClient();
  const { id } = route.params;

  const { data: tech, isLoading, isError, refetch } = useQuery({ queryKey: ['technique', id], queryFn: () => getTechnique(id) });

  const fav = useMutation({
    mutationFn: () => toggleTechniqueFavorite(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['technique', id] });
      qc.invalidateQueries({ queryKey: ['techniques'] });
      qc.invalidateQueries({ queryKey: ['favoriteTechniques'] });
    },
  });

  if (isLoading || !tech) {
    return <QueryState isLoading={isLoading} isError={isError} onRetry={() => refetch()} />;
  }

  const belt = beltLabel(tech.beltSlug);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.body}>
      <View style={styles.headRow}>
        <View style={[styles.tag, { backgroundColor: (CATEGORY_COLORS[tech.category] ?? palette.primary) + '26' }]}>
          <Text style={[styles.tagText, { color: CATEGORY_COLORS[tech.category] ?? palette.primary }]}>
            {categoryLabel(tech.category)}
          </Text>
        </View>
        <MaterialCommunityIcons
          name={tech.favorite ? 'star' : 'star-outline'}
          size={26}
          color={tech.favorite ? palette.pro : palette.textSecondary}
          onPress={() => fav.mutate()}
        />
      </View>

      <Text style={styles.name}>{tech.name}</Text>

      <View style={styles.metaRow}>
        {tech.position && <Meta icon="map-marker" label={t('techniques.position')} value={tech.position} />}
        <Meta icon="signal-cellular-2" label={t('techniques.difficulty')} value={DIFFICULTY_LABELS[tech.difficulty]} />
        {belt && <Meta icon="karate" label={t('techniques.suggestedBelt')} value={belt} />}
      </View>

      {tech.description && <Text style={styles.desc}>{tech.description}</Text>}

      {tech.videoUrl ? (
        <Button mode="contained" icon="play" style={styles.video} onPress={() => Linking.openURL(tech.videoUrl!)}>
          {t('techniques.watchVideo')}
        </Button>
      ) : (
        <View style={styles.noVideo}>
          <MaterialCommunityIcons name="video-off-outline" size={18} color={palette.textSecondary} />
          <Text style={styles.noVideoText}>{t('techniques.noVideo')}</Text>
        </View>
      )}
    </ScrollView>
  );
}

function Meta({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.meta}>
      <MaterialCommunityIcons name={icon as never} size={16} color={palette.primary} />
      <View>
        <Text style={styles.metaLabel}>{label}</Text>
        <Text style={styles.metaValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = makeStyles(() => ({
  screen: { flex: 1, backgroundColor: palette.background },
  body: { padding: 16 },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  tagText: { fontSize: 12, fontWeight: '700' },
  name: { color: palette.textPrimary, fontSize: 24, fontWeight: '800', marginTop: 12 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 18, marginTop: 16 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaLabel: { color: palette.textSecondary, fontSize: 11 },
  metaValue: { color: palette.textPrimary, fontWeight: '600', fontSize: 13 },
  desc: { color: palette.textPrimary, lineHeight: 22, marginTop: 20, fontSize: 15 },
  video: { marginTop: 24, borderRadius: 12 },
  noVideo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
    padding: 14,
    borderRadius: 12,
    backgroundColor: palette.surface,
  },
  noVideoText: { color: palette.textSecondary },
}));
