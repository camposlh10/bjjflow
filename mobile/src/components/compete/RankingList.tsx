import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Platform, Pressable, View } from 'react-native';
import { Text } from 'react-native-paper';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { MyRating, Player, RankingEntry, RankingScope, getMyRating, getRanking } from '../../api/compete';
import { rankBarColorFor } from '../../constants/belts';
import { t, tf } from '../../i18n';
import { makeStyles, palette } from '../../theme/theme';
import BeltVisual from '../BeltVisual';
import { ArrowLink, Avatar } from '../CommunityFeed';
import Icon from '../Icon';
import { signed } from './MatchParts';
import { useCompeteActions } from './useCompete';

const PODIUM: Record<number, { bg: string; fg: string }> = {
  1: { bg: '#FACC15', fg: '#422006' },
  2: { bg: '#9CA3AF', fg: '#1F2937' },
  3: { bg: '#B45309', fg: '#FEF3C7' },
};

const GOLD_GRADIENT = ['#FFD700', '#FFF6CC', '#FACC15', '#B8860B', '#FFD700'] as const;
const AnimatedGradient = Animated.createAnimatedComponent(LinearGradient);

/**
 * The slowly turning gold border around first place. On web Reanimated can't
 * animate a gradient's props, so the border stays still there.
 */
function FirstPlaceRing({ children }: { children: React.ReactNode }) {
  if (Platform.OS === 'web') {
    return (
      <LinearGradient colors={GOLD_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.firstRing}>
        <View style={styles.firstRingInner}>{children}</View>
      </LinearGradient>
    );
  }
  return <TurningRing>{children}</TurningRing>;
}

function TurningRing({ children }: { children: React.ReactNode }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 4000, easing: Easing.linear }), -1, false);
  }, [progress]);
  const animatedProps = useAnimatedProps(() => {
    const angle = progress.value * Math.PI * 2;
    return {
      start: { x: 0.5 + 0.5 * Math.cos(angle), y: 0.5 + 0.5 * Math.sin(angle) },
      end: { x: 0.5 - 0.5 * Math.cos(angle), y: 0.5 - 0.5 * Math.sin(angle) },
    };
  });
  return (
    <AnimatedGradient colors={GOLD_GRADIENT} animatedProps={animatedProps} style={styles.firstRing}>
      <View style={styles.firstRingInner}>{children}</View>
    </AnimatedGradient>
  );
}

/** The rating rules, in plain words. */
export function HowRatingWorks({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const lines = [
    t('compete.how.start'),
    t('compete.how.training'),
    t('compete.how.goal'),
    t('compete.how.match'),
    t('compete.how.missing'),
  ];
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.howCard} onPress={() => undefined}>
          <Text style={styles.howTitle}>{t('compete.how.title')}</Text>
          {lines.map((line) => (
            <View key={line} style={styles.howRow}>
              <View style={styles.howBullet} />
              <Text style={styles.howText}>{line}</Text>
            </View>
          ))}
          <Pressable style={styles.howButton} onPress={onClose} accessibilityRole="button">
            <Text style={styles.howButtonText}>{t('compete.how.ok')}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Rating, month change and gym position, above the ranking. */
export function MyRatingCard({ data, onHow }: { data: MyRating | undefined; onHow: () => void }) {
  if (!data) return <View style={[styles.mine, { height: 104 }]} />;
  return (
    <View style={styles.mine}>
      <View style={{ flex: 1 }}>
        <Text style={styles.mineLabel}>{t('compete.rating')}</Text>
        <Text style={styles.mineRating}>{data.rating}</Text>
        <Text style={[styles.mineDelta, data.monthDelta > 0 && styles.up, data.monthDelta < 0 && styles.down]}>
          {tf('compete.month', { n: signed(data.monthDelta) })}
        </Text>
      </View>
      <View style={styles.mineSide}>
        {data.gymPosition != null && (
          <Text style={styles.minePos}>{tf('compete.burst.gym', { n: data.gymPosition })}</Text>
        )}
        <ArrowLink label={t('compete.ranking.how')} onPress={onHow} />
      </View>
    </View>
  );
}

type Props = {
  /** Shows the scope toggle when not fixed. */
  fixedScope?: RankingScope;
  /** Rendered above the list (e.g. the rating card). */
  header?: React.ReactElement | null;
  onPressPlayer?: (p: Player) => void;
  /** When the list scrolls inside another scroll view, render rows without a FlatList. */
  embedded?: boolean;
  /** False when the parent already pads the sides. */
  padded?: boolean;
};

/**
 * Members by rating, with this month's change. First place gets the turning gold
 * ring; your row is outlined; everyone else has a challenge button.
 */
export default function RankingList({ fixedScope, header, onPressPlayer, embedded, padded = true }: Props) {
  const [scope, setScope] = useState<RankingScope>(fixedScope ?? 'gym');
  const ranking = useQuery({ queryKey: ['ranking', scope], queryFn: () => getRanking(scope) });
  const actions = useCompeteActions();
  // Without a gym, open on the people you follow instead of an empty board.
  useEffect(() => {
    if (!fixedScope && scope === 'gym' && ranking.data && !ranking.data.available) setScope('following');
  }, [fixedScope, scope, ranking.data]);

  const entries = ranking.data?.entries ?? [];
  const Toggle = fixedScope ? null : (
    <View style={styles.toggle} accessibilityRole="tablist">
      {(['gym', 'following'] as const).map((s) => (
        <Pressable
          key={s}
          onPress={() => setScope(s)}
          style={[styles.toggleItem, scope === s && styles.toggleItemOn]}
          accessibilityRole="tab"
          accessibilityState={{ selected: scope === s }}>
          <Text style={[styles.toggleText, scope === s && styles.toggleTextOn]}>
            {s === 'gym' ? t('compete.scope.gym') : t('compete.scope.following')}
          </Text>
        </Pressable>
      ))}
    </View>
  );

  const Empty = ranking.isLoading ? (
    <ActivityIndicator style={{ marginTop: 28 }} color={palette.primary} />
  ) : (
    <Text style={styles.empty}>
      {ranking.data && !ranking.data.available ? t('compete.ranking.noGym') : t('compete.ranking.followingEmpty')}
    </Text>
  );

  const renderRow = (item: RankingEntry, index: number) => {
    const podium = PODIUM[item.position];
    const p = item.player;
    const row = (
      <Pressable
        onPress={() => onPressPlayer?.(p)}
        style={[styles.row, item.me && styles.rowMe, item.position === 1 && styles.rowFirst]}>
        {podium ? (
          <View style={[styles.posBadge, { backgroundColor: podium.bg }]}>
            <Text style={[styles.posBadgeText, { color: podium.fg }]}>{item.position}</Text>
          </View>
        ) : (
          <Text style={styles.pos}>{item.position}</Text>
        )}
        <Avatar name={p.displayName} url={p.avatarUrl} size={40} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>
            {item.me ? t('compete.you') : p.displayName}
          </Text>
          <View style={styles.meta}>
            {p.belt && (
              <View style={styles.beltMini}>
                <BeltVisual
                  color={p.belt.colorHex}
                  rankBarColor={rankBarColorFor(p.belt.slug)}
                  stripes={p.belt.stripes}
                  height={8}
                />
              </View>
            )}
            {item.monthDelta !== 0 && (
              <Text style={[styles.delta, item.monthDelta > 0 ? styles.up : styles.down]}>
                {signed(item.monthDelta)}
              </Text>
            )}
          </View>
        </View>
        <Text style={styles.rating}>{p.rating}</Text>
        {!item.me ? (
          <Pressable
            onPress={() => actions.challenge(p)}
            hitSlop={8}
            style={styles.swords}
            accessibilityRole="button"
            accessibilityLabel={`${t('compete.challenge')} ${p.displayName}`}>
            <Icon name="karate" size={18} color={palette.textSecondary} />
          </Pressable>
        ) : (
          <View style={styles.swords} />
        )}
      </Pressable>
    );
    return (
      <Animated.View key={p.id} entering={FadeInDown.delay(Math.min(index, 10) * 35).duration(260)}>
        {item.position === 1 ? <FirstPlaceRing>{row}</FirstPlaceRing> : row}
      </Animated.View>
    );
  };

  if (embedded) {
    return (
      <View>
        {header}
        {Toggle}
        {entries.length === 0 ? Empty : entries.map((e, i) => renderRow(e, i))}
      </View>
    );
  }
  return (
    <FlatList
      data={entries}
      keyExtractor={(e) => `${scope}-${e.player.id}`}
      renderItem={({ item, index }) => renderRow(item, index)}
      ListHeaderComponent={
        <View>
          {header}
          {Toggle}
        </View>
      }
      ListEmptyComponent={Empty}
      contentContainerStyle={[styles.content, !padded && { paddingHorizontal: 0 }]}
      showsVerticalScrollIndicator={false}
      onRefresh={() => ranking.refetch()}
      refreshing={ranking.isRefetching}
    />
  );
}

/** Rating card plus the ranking, with the rules one tap away. */
export function RankingWithMine(props: Omit<Props, 'header'>) {
  const [how, setHow] = useState(false);
  const mine = useQuery({ queryKey: ['myRating'], queryFn: getMyRating });
  return (
    <>
      <RankingList {...props} header={<MyRatingCard data={mine.data} onHow={() => setHow(true)} />} />
      <HowRatingWorks visible={how} onClose={() => setHow(false)} />
    </>
  );
}

const styles = makeStyles(() => ({
  content: { paddingHorizontal: 18, paddingBottom: 32 },
  toggle: {
    flexDirection: 'row',
    backgroundColor: palette.surface,
    borderRadius: 12,
    padding: 4,
    marginBottom: 12,
  },
  toggleItem: { flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: 'center' },
  toggleItemOn: { backgroundColor: palette.primary },
  toggleText: { color: palette.textSecondary, fontSize: 13, fontWeight: '600' },
  toggleTextOn: { color: '#FFFFFF' },
  empty: { color: palette.textSecondary, textAlign: 'center', paddingVertical: 28, paddingHorizontal: 20 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: palette.surfaceVariant,
  },
  rowFirst: { borderBottomWidth: 0, borderRadius: 14 },
  rowMe: {
    backgroundColor: palette.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.primary,
  },
  firstRing: { borderRadius: 16, padding: 2, marginVertical: 6 },
  firstRingInner: { borderRadius: 14, backgroundColor: palette.background, overflow: 'hidden' },
  pos: { width: 30, textAlign: 'center', color: palette.textSecondary, fontSize: 14 },
  posBadge: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  posBadgeText: { fontSize: 14, fontWeight: 'bold' },
  name: { color: palette.textPrimary, fontSize: 14, fontWeight: 'bold' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 5 },
  beltMini: { width: 44 },
  delta: { fontSize: 11, fontWeight: '600' },
  up: { color: '#22C55E' },
  down: { color: palette.primary },
  rating: { color: palette.textPrimary, fontSize: 16, fontWeight: 'bold', fontVariant: ['tabular-nums'] },
  swords: { width: 28, alignItems: 'center' },
  mine: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: palette.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
  },
  mineLabel: { color: palette.textSecondary, fontSize: 12, fontWeight: '600' },
  mineRating: { color: palette.textPrimary, fontSize: 40, fontWeight: 'bold', fontVariant: ['tabular-nums'] },
  mineDelta: { color: palette.textSecondary, fontSize: 13, fontWeight: '600' },
  mineSide: { alignItems: 'flex-end', gap: 10 },
  minePos: { color: palette.textPrimary, fontSize: 15, fontWeight: 'bold' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
  howCard: { backgroundColor: palette.surface, borderRadius: 20, padding: 20, gap: 12 },
  howTitle: { color: palette.textPrimary, fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  howRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  howBullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: palette.primary, marginTop: 8 },
  howText: { flex: 1, color: palette.textPrimary, fontSize: 14, lineHeight: 20 },
  howButton: {
    marginTop: 8,
    backgroundColor: palette.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  howButtonText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 15 },
}));
