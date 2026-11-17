import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { Text } from 'react-native-paper';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Match, Player, getMatches } from '../../api/compete';
import { ArrowLink } from '../../components/CommunityFeed';
import Icon from '../../components/Icon';
import { MatchCard, SectionTitle } from '../../components/compete/MatchParts';
import { RankingWithMine } from '../../components/compete/RankingList';
import { t } from '../../i18n';
import { makeStyles, palette } from '../../theme/theme';

type Tab = 'ranking' | 'matches';

type Props = {
  route: { params?: { tab?: Tab } };
  navigation: {
    navigate: (screen: 'Match' | 'UserProfile', params: { matchId: number } | { userId: number }) => void;
    setOptions: (o: object) => void;
  };
};

/** Ranking (by rating) and the member's matches, side by side. */
export default function CompeteScreen({ route, navigation }: Props) {
  const [tab, setTab] = useState<Tab>(route.params?.tab ?? 'ranking');
  const matches = useQuery({ queryKey: ['matches'], queryFn: getMatches });

  useEffect(() => {
    navigation.setOptions({ title: t('compete.title') });
  }, [navigation]);

  const openMatch = (m: Match) => navigation.navigate('Match', { matchId: m.id });
  const openPlayer = (p: Player) => navigation.navigate('UserProfile', { userId: p.id });
  const incoming = matches.data?.incoming.length ?? 0;

  const Tabs = (
    <View style={styles.tabs} accessibilityRole="tablist">
      {(['ranking', 'matches'] as const).map((key) => {
        const active = tab === key;
        return (
          <Pressable
            key={key}
            onPress={() => setTab(key)}
            style={styles.tab}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}>
            <View style={styles.tabLabelRow}>
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {key === 'ranking' ? t('compete.tab.ranking') : t('compete.tab.matches')}
              </Text>
              {key === 'matches' && incoming > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{incoming}</Text>
                </View>
              )}
            </View>
            <View style={[styles.tabBar, active && styles.tabBarActive]} />
          </Pressable>
        );
      })}
    </View>
  );

  if (tab === 'ranking') {
    return (
      <View style={styles.screen}>
        <View style={styles.pad}>{Tabs}</View>
        <RankingWithMine onPressPlayer={openPlayer} />
      </View>
    );
  }

  const data = matches.data;
  const empty = data && !data.incoming.length && !data.outgoing.length && !data.active.length && !data.finished.length;
  const sections: [string, Match[], boolean][] = data
    ? [
        [t('compete.matches.incoming'), data.incoming, true],
        [t('compete.matches.active'), data.active, false],
        [t('compete.matches.outgoing'), data.outgoing, false],
        [t('compete.matches.finished'), data.finished, false],
      ]
    : [];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.pad, { paddingBottom: 32 }]}
      refreshControl={<RefreshControl refreshing={matches.isRefetching} onRefresh={() => matches.refetch()} tintColor={palette.primary} />}>
      {Tabs}
      {matches.isLoading && <ActivityIndicator style={{ marginTop: 28 }} color={palette.primary} />}
      {empty && (
        <View style={styles.empty}>
          <Icon name="karate" size={40} color={palette.surfaceVariant} />
          <Text style={styles.emptyTitle}>{t('compete.matches.empty.title')}</Text>
          <Text style={styles.emptySub}>{t('compete.matches.empty.sub')}</Text>
          <ArrowLink label={t('compete.matches.empty.button')} onPress={() => setTab('ranking')} />
        </View>
      )}
      {sections
        .filter(([, list]) => list.length > 0)
        .map(([title, list, highlight]) => (
          <View key={title}>
            <SectionTitle>{title}</SectionTitle>
            <View style={{ gap: 8 }}>
              {list.map((m, i) => (
                <Animated.View key={m.id} entering={FadeInDown.delay(i * 40).duration(240)}>
                  <MatchCard match={m} highlight={highlight} onPress={() => openMatch(m)} />
                </Animated.View>
              ))}
            </View>
          </View>
        ))}
    </ScrollView>
  );
}

const styles = makeStyles(() => ({
  screen: { flex: 1, backgroundColor: palette.background },
  pad: { paddingHorizontal: 18 },
  tabs: {
    flexDirection: 'row',
    gap: 28,
    marginTop: 8,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: palette.surfaceVariant,
  },
  tab: { paddingTop: 4 },
  tabLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingBottom: 10, paddingHorizontal: 2 },
  tabText: { color: palette.textSecondary, fontSize: 17, fontWeight: '500' },
  tabTextActive: { color: palette.textPrimary, fontWeight: 'bold' },
  tabBar: { height: 3, borderRadius: 2, marginBottom: -1 },
  tabBarActive: { backgroundColor: palette.primary },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: 'bold' },
  empty: { alignItems: 'center', gap: 10, paddingTop: 36, paddingHorizontal: 16 },
  emptyTitle: { color: palette.textPrimary, fontSize: 16, fontWeight: 'bold' },
  emptySub: { color: palette.textSecondary, fontSize: 13, textAlign: 'center', lineHeight: 19 },
}));
