import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, RefreshControl, TextInput, View } from 'react-native';
import { Text } from 'react-native-paper';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getStats, todayLocalDate } from '../api/checkins';
import { AgendaOccurrence, getAgenda } from '../api/classes';
import { getCommunityFeed } from '../api/feed';
import { getMyGym } from '../api/gyms';
import { getHome } from '../api/home';
import { getNotifications } from '../api/notifications';
import { resolveMediaUrl } from '../api/posts';
import { SearchUser, getUserProfile, searchUsers } from '../api/users';
import BeltVisual from '../components/BeltVisual';
import { TrainingCardSkeleton } from '../components/Skeleton';
import TodayCard from '../components/TodayCard';
import TrainingCard from '../components/TrainingCard';
import { rankBarColorFor } from '../constants/belts';
import { t } from '../i18n';
import type { HomeStackParamList } from '../navigation/HomeNavigator';
import { useAuthStore } from '../store/authStore';
import { makeStyles, palette } from '../theme/theme';

type Nav = NativeStackNavigationProp<HomeStackParamList, 'HomeMain'>;

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

/** The next class today that hasn't started yet, if any. */
function nextClassToday(occurrences: AgendaOccurrence[] | undefined): AgendaOccurrence | null {
  if (!Array.isArray(occurrences)) return null;
  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return (
    [...occurrences]
      .filter((o) => o.startTime.slice(0, 5) >= hhmm)
      .sort((a, b) => a.startTime.localeCompare(b.startTime))[0] ?? null
  );
}

/**
 * Início: today first (streak, one-tap check-in, next class), then the
 * community feed. Messages, notifications and people search live in the header.
 */
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const q = query.trim();
  const searching = searchOpen && q.length >= 2;

  // One request loads stats, gym, notifications and profile together and seeds
  // each one's cache entry; the queries below then find fresh data. They wait
  // while it runs and fall back to their own endpoints if it fails.
  const home = useQuery({
    queryKey: ['home', user?.id ?? 0],
    queryFn: async () => {
      const data = await getHome();
      queryClient.setQueryData(['stats'], data.stats);
      queryClient.setQueryData(['myGym'], data.gym);
      queryClient.setQueryData(['journey'], data.journey);
      queryClient.setQueryData(['notifications'], data.notifications);
      queryClient.setQueryData(['userProfile', data.profile.id], data.profile);
      return data;
    },
    enabled: !!user?.id,
    retry: false,
  });
  const partsReady = !home.isFetching;
  const stats = useQuery({ queryKey: ['stats'], queryFn: getStats, enabled: partsReady });
  const gym = useQuery({ queryKey: ['myGym'], queryFn: getMyGym, enabled: partsReady });
  const notifications = useQuery({
    queryKey: ['notifications'],
    queryFn: () => getNotifications(),
    enabled: partsReady,
  });
  const profile = useQuery({
    queryKey: ['userProfile', user?.id ?? 0],
    queryFn: () => getUserProfile(user!.id),
    enabled: !!user?.id && partsReady,
  });
  const today = todayLocalDate();
  const agenda = useQuery({
    queryKey: ['agenda', today, today],
    queryFn: () => getAgenda(today, today),
    enabled: !!gym.data,
  });

  const feed = useInfiniteQuery({
    queryKey: ['communityFeed'],
    queryFn: ({ pageParam }) => getCommunityFeed(pageParam),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
  const results = useQuery({ queryKey: ['userSearch', q], queryFn: () => searchUsers(q), enabled: searching });

  const unread = notifications.data?.unread ?? 0;
  const avatarUrl = profile.data?.avatarUrl ? resolveMediaUrl(profile.data.avatarUrl) : null;
  const items = feed.data?.pages.flatMap((p) => p.items) ?? [];
  const users = Array.isArray(results.data) ? results.data : [];
  const nextClass = nextClassToday(agenda.data);

  const refresh = () => {
    feed.refetch();
    home.refetch();
    if (gym.data) agenda.refetch();
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setQuery('');
  };

  const Header = (
    <View>
      <View style={styles.head}>
        <Pressable
          onPress={() => navigation.getParent()?.navigate('Profile')}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={t('tabs.profile')}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initialsOf(user?.displayName ?? '')}</Text>
            </View>
          )}
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting} numberOfLines={1}>
            {t('home.greeting')}, {user?.displayName?.split(' ')[0] ?? ''}
          </Text>
          {user?.belt && (
            <View style={styles.beltRow}>
              <View style={styles.belt}>
                <BeltVisual
                  color={user.belt.colorHex}
                  rankBarColor={rankBarColorFor(user.belt.slug)}
                  stripes={user.belt.stripes}
                  height={10}
                />
              </View>
              <Text style={styles.meta} numberOfLines={1}>
                {user.belt.namePt}
                {gym.data ? ` · ${gym.data.name}` : ''}
              </Text>
            </View>
          )}
        </View>
        <Pressable
          style={styles.iconBtn}
          onPress={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={t('feed.search')}>
          <MaterialCommunityIcons name={searchOpen ? 'close' : 'magnify'} size={22} color={palette.textPrimary} />
        </Pressable>
        <Pressable
          style={styles.iconBtn}
          onPress={() => navigation.navigate('Direct')}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={t('feed.messages')}>
          <MaterialCommunityIcons name="message-outline" size={21} color={palette.textPrimary} />
        </Pressable>
        <Pressable
          style={styles.iconBtn}
          onPress={() => navigation.navigate('NotificationCenter')}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={t('feed.notifications')}>
          <MaterialCommunityIcons name="bell-outline" size={22} color={palette.textPrimary} />
          {unread > 0 && <View style={styles.bellDot} />}
        </Pressable>
      </View>

      {searchOpen ? (
        <View style={styles.searchWrap}>
          <MaterialCommunityIcons name="magnify" size={18} color={palette.textSecondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('feed.search')}
            placeholderTextColor={palette.textSecondary}
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
          />
        </View>
      ) : (
        <>
          <TodayCard stats={stats.data} />

          {nextClass && (
            <Pressable
              style={styles.nextClass}
              onPress={() => navigation.getParent()?.navigate('Gym')}
              accessibilityRole="button">
              <MaterialCommunityIcons name="calendar-clock" size={20} color={palette.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.nextLabel}>{t('today.nextClass')}</Text>
                <Text style={styles.nextText} numberOfLines={1}>
                  {nextClass.name} · {nextClass.startTime.slice(0, 5)}
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={palette.textSecondary} />
            </Pressable>
          )}

          <Text style={styles.section}>{t('tabs.community')}</Text>
        </>
      )}
    </View>
  );

  if (searchOpen) {
    return (
      <FlatList
        showsVerticalScrollIndicator={false}
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
        data={searching ? users : []}
        keyExtractor={(u: SearchUser) => String(u.id)}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={Header}
        renderItem={({ item }) => (
          <Pressable style={styles.userRow} onPress={() => navigation.navigate('UserProfile', { userId: item.id })}>
            {item.avatarUrl ? (
              <Image source={{ uri: resolveMediaUrl(item.avatarUrl) }} style={styles.userAvatar} />
            ) : (
              <View style={[styles.userAvatar, styles.userAvatarFallback]}>
                <Text style={styles.userAvatarText}>{initialsOf(item.displayName)}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.userName} numberOfLines={1}>
                {item.displayName}
                {item.pro ? '  ·  PRO' : ''}
              </Text>
              <Text style={styles.userHandle} numberOfLines={1}>
                {item.username ? `@${item.username}` : item.belt?.namePt ?? ''}
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={palette.textSecondary} />
          </Pressable>
        )}
        ListEmptyComponent={
          searching && !results.isLoading ? <Text style={styles.searchEmpty}>{t('feed.search.empty')}</Text> : null
        }
      />
    );
  }

  return (
    <FlatList
      showsVerticalScrollIndicator={false}
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
      data={items}
      keyExtractor={(item) => String(item.checkInId)}
      renderItem={({ item, index }) => (
        <Animated.View entering={FadeInDown.duration(280).delay(Math.min(index, 8) * 45)}>
          <TrainingCard
            item={item}
            onPressAuthor={(userId) => navigation.navigate('UserProfile', { userId })}
            onPressComment={(it) => navigation.navigate('FeedComments', { item: it })}
          />
        </Animated.View>
      )}
      ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      onEndReachedThreshold={0.5}
      onEndReached={() => {
        if (feed.hasNextPage && !feed.isFetchingNextPage) feed.fetchNextPage();
      }}
      refreshControl={
        <RefreshControl refreshing={feed.isRefetching && !feed.isFetchingNextPage} onRefresh={refresh} tintColor={palette.primary} />
      }
      ListHeaderComponent={Header}
      ListFooterComponent={
        feed.isFetchingNextPage ? <ActivityIndicator style={{ marginVertical: 16 }} color={palette.primary} /> : null
      }
      ListEmptyComponent={
        feed.isLoading ? (
          <View style={{ gap: 12 }}>
            <TrainingCardSkeleton />
            <TrainingCardSkeleton />
          </View>
        ) : (
          <View style={styles.center}>
            <MaterialCommunityIcons name="earth" size={40} color={palette.surfaceVariant} />
            <Text style={styles.emptyTitle}>{t('feed.empty.title')}</Text>
            <Text style={styles.emptySub}>{t('feed.empty.sub')}</Text>
          </View>
        )
      }
    />
  );
}

const styles = makeStyles(() => ({
  container: { flex: 1, backgroundColor: palette.background },
  content: { paddingHorizontal: 16, paddingBottom: 32, flexGrow: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: palette.textPrimary, fontWeight: 'bold', fontSize: 14 },
  greeting: { color: palette.textPrimary, fontSize: 17, fontWeight: 'bold' },
  beltRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  belt: { width: 34 },
  meta: { color: palette.textSecondary, fontSize: 12, flexShrink: 1 },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: palette.primary,
    borderWidth: 1.5,
    borderColor: palette.surface,
  },
  nextClass: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: palette.surface,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 10,
  },
  nextLabel: { color: palette.textSecondary, fontSize: 12 },
  nextText: { color: palette.textPrimary, fontSize: 14, fontWeight: '600', marginTop: 1 },
  section: { color: palette.textPrimary, fontSize: 16, fontWeight: 'bold', marginTop: 22, marginBottom: 10 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: palette.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    marginBottom: 12,
  },
  searchInput: { flex: 1, color: palette.textPrimary, fontSize: 14, padding: 0 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  userAvatar: { width: 46, height: 46, borderRadius: 23 },
  userAvatarFallback: { backgroundColor: palette.surfaceVariant, alignItems: 'center', justifyContent: 'center' },
  userAvatarText: { color: palette.textPrimary, fontWeight: 'bold', fontSize: 15 },
  userName: { color: palette.textPrimary, fontSize: 15, fontWeight: '600' },
  userHandle: { color: palette.textSecondary, fontSize: 12, marginTop: 2 },
  searchEmpty: { color: palette.textSecondary, fontSize: 13, textAlign: 'center', paddingTop: 30 },
  center: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: 40 },
  emptyTitle: { color: palette.textPrimary, fontWeight: 'bold', fontSize: 15 },
  emptySub: { color: palette.textSecondary, fontSize: 13, textAlign: 'center' },
}));
