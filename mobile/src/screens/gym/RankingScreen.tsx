import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import Animated, { Easing, useAnimatedProps, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useQuery } from '@tanstack/react-query';

import { RankingEntry, getRanking } from '../../api/gyms';
import BeltVisual from '../../components/BeltVisual';
import { rankBarColorFor } from '../../constants/belts';
import { t, tf } from '../../i18n';
import { useAuthStore } from '../../store/authStore';
import { makeStyles, palette } from '../../theme/theme';

const PODIUM: Record<number, { bg: string; fg: string }> = {
  1: { bg: '#FACC15', fg: '#422006' },
  2: { bg: '#9CA3AF', fg: '#1F2937' },
  3: { bg: '#B45309', fg: '#FEF3C7' },
};

const GOLD_GRADIENT = ['#FFD700', '#FFF6CC', '#FACC15', '#B8860B', '#FFD700'] as const;

const AnimatedGradient = Animated.createAnimatedComponent(LinearGradient);

function FirstPlaceRing({ children }: { children: React.ReactNode }) {
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

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export default function RankingScreen() {
  const myUserId = useAuthStore((s) => s.user?.id);
  const ranking = useQuery({ queryKey: ['gymRanking'], queryFn: getRanking });

  if (ranking.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  const hasClasses = (ranking.data ?? []).some((e) => e.classes > 0);

  return (
    <FlatList
      data={ranking.data ?? []}
      keyExtractor={(e) => String(e.userId)}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={<Text style={styles.title}>{t('ranking.title')}</Text>}
      ListEmptyComponent={<Text style={styles.empty}>{t('ranking.empty')}</Text>}
      ListFooterComponent={
        !hasClasses && (ranking.data?.length ?? 0) > 0 ? (
          <Text style={styles.empty}>{t('ranking.empty')}</Text>
        ) : null
      }
      renderItem={({ item }: { item: RankingEntry }) => {
        const podium = PODIUM[item.position];
        const isMe = item.userId === myUserId;
        const content = (
          <View style={[styles.rowContent, isMe && styles.rowMe, item.position === 1 && styles.rowContentFirst]}>
            {podium ? (
              <View style={[styles.posBadge, { backgroundColor: podium.bg }]}>
                <Text style={[styles.posBadgeText, { color: podium.fg }]}>{item.position}</Text>
              </View>
            ) : (
              <Text style={styles.pos}>{item.position}</Text>
            )}
            <View style={[styles.avatar, isMe && styles.avatarMe]}>
              <Text style={[styles.avatarText, isMe && styles.avatarTextMe]}>
                {initialsOf(item.displayName)}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>
                {isMe ? t('ranking.you') : item.displayName}
              </Text>
              {item.belt && (
                <View style={styles.beltMini}>
                  <BeltVisual
                    color={item.belt.colorHex}
                    rankBarColor={rankBarColorFor(item.belt.slug)}
                    stripes={item.belt.stripes}
                    height={10}
                  />
                </View>
              )}
            </View>
            <Text style={styles.classes}>
              {item.classes === 1
                ? t('ranking.classes.one')
                : tf('ranking.classes.many', { n: item.classes })}
            </Text>
          </View>
        );

        if (item.position === 1) {
          return <FirstPlaceRing>{content}</FirstPlaceRing>;
        }
        return content;
      }}
    />
  );
}

const styles = makeStyles(() => ({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  content: { paddingBottom: 24 },
  title: { color: palette.textSecondary, fontSize: 11, marginBottom: 10 },
  empty: { color: palette.textSecondary, textAlign: 'center', paddingVertical: 24 },
  rowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#1A1A20',
  },
  rowContentFirst: {
    borderBottomWidth: 0,
    borderRadius: 14,
  },
  rowMe: {
    backgroundColor: palette.surface,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: palette.primary,
    borderBottomWidth: 0.5,
  },
  firstRing: { borderRadius: 16, padding: 2, marginVertical: 6 },
  firstRingInner: {
    borderRadius: 14,
    backgroundColor: palette.background,
    overflow: 'hidden',
  },
  pos: { width: 32, textAlign: 'center', color: palette.textSecondary, fontSize: 14 },
  posBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  posBadgeText: { fontSize: 14, fontWeight: 'bold' },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: palette.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarMe: { backgroundColor: palette.primary },
  avatarText: { color: palette.textPrimary, fontWeight: 'bold', fontSize: 13 },
  avatarTextMe: { color: '#fff' },
  name: { color: palette.textPrimary, fontSize: 14, fontWeight: 'bold' },
  beltMini: { width: 48, marginTop: 5 },
  classes: { color: palette.textPrimary, fontSize: 13, fontWeight: 'bold' },
}));
