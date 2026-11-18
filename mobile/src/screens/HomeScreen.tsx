import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, TextInput, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { todayLocalDate } from '../api/checkins';
import { MatchPost, getMatches, getMatchPosts } from '../api/compete';
import { AgendaOccurrence, getAgenda } from '../api/classes';
import { FeedItem, FeedScope, getCommunityFeed } from '../api/feed';
import { getMyGym } from '../api/gyms';
import { getHome } from '../api/home';
import { getNotifications } from '../api/notifications';
import { Post, getFeedPage } from '../api/posts';
import { SearchUser, getUserProfile, searchUsers } from '../api/users';
import { ArrowLink, Avatar, CheckInPost, GymPost, HighlightCard } from '../components/CommunityFeed';
import Icon, { type IconName } from '../components/Icon';
import { TrainingCardSkeleton } from '../components/Skeleton';
import { MatchCard } from '../components/compete/MatchParts';
import MatchPostCard from '../components/compete/MatchPostCard';
import { useCompeteActions } from '../components/compete/useCompete';
import { usePostActions } from '../components/usePostActions';
import { t, tf } from '../i18n';
import type { HomeStackParamList } from '../navigation/HomeNavigator';
import { useAuthStore } from '../store/authStore';
import { useCheckInSheet } from '../store/checkInSheetStore';
import { makeStyles, palette } from '../theme/theme';
import { eventWhen, postedAgo } from '../utils/time';

type Nav = NativeStackNavigationProp<HomeStackParamList, 'HomeMain'>;
type FeedTab = 'following' | 'gym';
type Row =
  | { kind: 'checkin'; at: number; item: FeedItem }
  | { kind: 'post'; at: number; post: Post }
  | { kind: 'match'; at: number; matchPost: MatchPost };
type Highlight = { key: string; icon: IconName; title: string; detail?: string; link: string; onPress: () => void };

/** How many days ahead "Em destaque" looks for open mats. */
const HIGHLIGHT_DAYS = 7;

function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(y, m - 1, d + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function nowHHMM(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

/** A gym post's headline for a highlight card: its first non-empty line. */
function headline(content: string): string {
  return content.split('\n').map((l) => l.trim()).find((l) => l.length > 0) ?? '';
}

/**
 * Início = Comunidade. Header (avatar, search, messages, notifications), then
 * "Em destaque" from the user's gym (today's next class, upcoming open mats and
 * pinned notices), then two feeds: "Seguindo" (sessions by people you follow,
 * mixed with your gym's posts) and "Minha academia" (the gym wall).
 * The streak / quick check-in card that used to open this screen now lives at
 * the top of Progresso.
 */
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const openCheckIn = useCheckInSheet((s) => s.open);
  const [tab, setTab] = useState<FeedTab>('following');
  const [scope, setScope] = useState<FeedScope>('following');
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
  const until = addDays(today, HIGHLIGHT_DAYS - 1);
  const agenda = useQuery({
    queryKey: ['agenda', today, until],
    queryFn: () => getAgenda(today, until),
    enabled: !!gym.data,
  });

  const feed = useInfiniteQuery({
    queryKey: ['communityFeed', scope],
    queryFn: ({ pageParam }) => getCommunityFeed(pageParam, scope),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
  // Same cache entry as the Academia tab's wall, so likes and new posts show in both.
  const gymFeed = useInfiniteQuery({
    queryKey: ['gymFeed'],
    queryFn: ({ pageParam }) => getFeedPage(pageParam),
    initialPageParam: null as number | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: !!gym.data,
  });
  const results = useQuery({ queryKey: ['userSearch', q], queryFn: () => searchUsers(q), enabled: searching });
  // Active matches and challenges waiting for an answer sit above the feeds;
  // posted match results are mixed into "Seguindo".
  const matches = useQuery({ queryKey: ['matches'], queryFn: getMatches, enabled: !!user?.id });
  const matchPosts = useQuery({
    queryKey: ['matchPosts', scope],
    queryFn: () => getMatchPosts(scope === 'all' ? 'all' : 'following'),
    enabled: !!user?.id,
  });
  const competeActions = useCompeteActions();
  const postActions = usePostActions(gym.data);

  const unread = notifications.data?.unread ?? 0;
  const avatarUrl = profile.data?.avatarUrl ?? null;
  const users = Array.isArray(results.data) ? results.data : [];

  const checkIns = useMemo(() => feed.data?.pages.flatMap((p) => p.items) ?? [], [feed.data]);
  // Pages are fetched at different moments, so a post can appear in two of them
  // (e.g. it was just unpinned): keep the first occurrence.
  const gymPosts = useMemo(() => {
    const seen = new Set<number>();
    const out: Post[] = [];
    for (const page of gymFeed.data?.pages ?? []) {
      for (const post of page.items) {
        if (!seen.has(post.id)) {
          seen.add(post.id);
          out.push(post);
        }
      }
    }
    return out;
  }, [gymFeed.data]);
  const hasGym = !!gym.data;

  const openClass = (occurrence: AgendaOccurrence) =>
    navigation.getParent()?.navigate('Gym', { screen: 'ClassDetail', params: { occurrence }, initial: false });
  const openPost = (post: Post) =>
    navigation.getParent()?.navigate('Gym', { screen: 'PostDetail', params: { postId: post.id }, initial: false });
  const openGym = () => navigation.getParent()?.navigate('Gym');

  // Em destaque. The backend has no gym events yet, so the cards come from what
  // exists: today's next class, open mats this week and the wall's pinned notices.
  const highlights = useMemo<Highlight[]>(() => {
    if (!hasGym) return [];
    const out: Highlight[] = [];
    const hhmm = nowHHMM();
    const upcoming = (Array.isArray(agenda.data) ? agenda.data : [])
      .filter((o) => o.date > today || o.startTime.slice(0, 5) >= hhmm)
      .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
    const detail = (o: AgendaOccurrence) =>
      `${eventWhen(o.date, o.startTime)} · ${o.restrictionLabel ?? t('community.highlights.allLevels')}`;

    const nextToday = upcoming.find((o) => o.date === today && o.sessionType !== 'OPEN_MAT');
    if (nextToday) {
      out.push({
        key: `class-${nextToday.classId}-${nextToday.date}`,
        icon: 'calendar-clock',
        title: `${t('community.highlights.nextClass')}: ${nextToday.name}`,
        detail: detail(nextToday),
        link: t('community.highlights.viewClass'),
        onPress: () => openClass(nextToday),
      });
    }
    for (const o of upcoming.filter((u) => u.sessionType === 'OPEN_MAT').slice(0, 3)) {
      out.push({
        key: `class-${o.classId}-${o.date}`,
        icon: 'calendar-blank-outline',
        title: o.name,
        detail: detail(o),
        link: t('community.highlights.viewEvent'),
        onPress: () => openClass(o),
      });
    }
    for (const post of gymPosts.filter((p) => p.pinned).slice(0, 3)) {
      out.push({
        key: `post-${post.id}`,
        icon: 'pin',
        title: headline(post.content) || post.author.displayName,
        detail: `${t('community.highlights.notice')} · ${postedAgo(post.createdAt)}`,
        link: t('community.highlights.viewNotice'),
        onPress: () => openPost(post),
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasGym, agenda.data, gymPosts, today]);

  // "Seguindo" merges two cursor-paged feeds by time. Only rows newer than the
  // oldest loaded row of a feed that still has pages are shown, so an older
  // item from one feed never jumps above items the other hasn't loaded yet.
  const followingRows = useMemo<Row[]>(() => {
    const sessionRows: Row[] = checkIns.map((item) => ({ kind: 'checkin', at: Date.parse(item.createdAt), item }));
    const postRows: Row[] = gymPosts
      .filter((p) => !p.pinned)
      .map((post) => ({ kind: 'post', at: Date.parse(post.createdAt), post }));
    // Match posts are one short list (the last 30 days), merged within the same window.
    const matchRows: Row[] = (matchPosts.data ?? []).map((matchPost) => ({
      kind: 'match',
      at: Date.parse(matchPost.createdAt),
      matchPost,
    }));
    const cutoff = Math.max(
      feed.hasNextPage && sessionRows.length ? sessionRows[sessionRows.length - 1].at : -Infinity,
      gymFeed.hasNextPage && postRows.length ? Math.min(...postRows.map((r) => r.at)) : -Infinity,
    );
    return [...sessionRows, ...postRows, ...matchRows].filter((r) => r.at >= cutoff).sort((a, b) => b.at - a.at);
  }, [checkIns, gymPosts, matchPosts.data, feed.hasNextPage, gymFeed.hasNextPage]);
  const gymRows = useMemo<Row[]>(
    () => gymPosts.map((post) => ({ kind: 'post', at: Date.parse(post.createdAt), post })),
    [gymPosts],
  );

  const rows = tab === 'following' ? followingRows : hasGym ? gymRows : [];
  const loading = tab === 'following' ? feed.isLoading : hasGym && gymFeed.isLoading;
  const loadingMore = feed.isFetchingNextPage || gymFeed.isFetchingNextPage;

  const loadMore = () => {
    if (loadingMore) return;
    if (tab === 'gym') {
      if (gymFeed.hasNextPage) gymFeed.fetchNextPage();
      return;
    }
    // Page whichever feed is holding the merged list back (the one whose oldest
    // loaded row is newest).
    const lastSession = checkIns.length ? Date.parse(checkIns[checkIns.length - 1].createdAt) : Infinity;
    const plain = gymPosts.filter((p) => !p.pinned);
    const lastPost = plain.length ? Math.min(...plain.map((p) => Date.parse(p.createdAt))) : Infinity;
    if (feed.hasNextPage && (!gymFeed.hasNextPage || lastSession >= lastPost)) feed.fetchNextPage();
    else if (gymFeed.hasNextPage) gymFeed.fetchNextPage();
  };

  const refresh = () => {
    feed.refetch();
    home.refetch();
    matches.refetch();
    matchPosts.refetch();
    if (hasGym) {
      gymFeed.refetch();
      agenda.refetch();
    }
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setQuery('');
  };

  const HeaderBar = (
    <View style={styles.head}>
      <Pressable
        onPress={() => navigation.getParent()?.navigate('Profile')}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={t('tabs.profile')}>
        <Avatar name={user?.displayName ?? ''} url={avatarUrl} size={44} />
      </Pressable>
      <Text style={styles.title} numberOfLines={1}>
        {t('community.title')}
      </Text>
      <Pressable
        style={styles.iconBtn}
        onPress={() => navigation.navigate('Compete')}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={t('compete.title')}>
        <Icon name="trophy" size={24} color={palette.textPrimary} />
        {(matches.data?.incoming.length ?? 0) > 0 && <View style={styles.bellDot} />}
      </Pressable>
      <Pressable
        style={styles.iconBtn}
        onPress={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={t('feed.search')}>
        <Icon name={searchOpen ? 'close' : 'magnify'} size={25} color={palette.textPrimary} />
      </Pressable>
      <Pressable
        style={styles.iconBtn}
        onPress={() => navigation.navigate('Direct')}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={t('feed.messages')}>
        <Icon name="message-outline" size={24} color={palette.textPrimary} />
      </Pressable>
      <Pressable
        style={styles.iconBtn}
        onPress={() => navigation.navigate('NotificationCenter')}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={t('feed.notifications')}>
        <Icon name="bell-outline" size={25} color={palette.textPrimary} />
        {unread > 0 && <View style={styles.bellDot} />}
      </Pressable>
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
        ListHeaderComponent={
          <View>
            {HeaderBar}
            <View style={styles.searchWrap}>
              <Icon name="magnify" size={18} color={palette.textSecondary} />
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
          </View>
        }
        renderItem={({ item }) => (
          <Pressable style={styles.userRow} onPress={() => navigation.navigate('UserProfile', { userId: item.id })}>
            <Avatar name={item.displayName} url={item.avatarUrl} size={46} />
            <View style={{ flex: 1 }}>
              <Text style={styles.userName} numberOfLines={1}>
                {item.displayName}
                {item.pro ? '  ·  PRO' : ''}
              </Text>
              <Text style={styles.userHandle} numberOfLines={1}>
                {item.username ? `@${item.username}` : item.belt?.namePt ?? ''}
              </Text>
            </View>
            <Icon name="chevron-right" size={20} color={palette.textSecondary} />
          </Pressable>
        )}
        ListEmptyComponent={
          searching && !results.isLoading ? <Text style={styles.searchEmpty}>{t('feed.search.empty')}</Text> : null
        }
      />
    );
  }

  const Header = (
    <View>
      {HeaderBar}

      {highlights.length > 0 && (
        <>
          <View style={styles.sectionRow}>
            <Text style={styles.section}>{t('community.highlights.title')}</Text>
            <Pressable onPress={openGym} hitSlop={6} accessibilityRole="link">
              <Text style={styles.seeAll}>{t('community.highlights.seeAll')}</Text>
            </Pressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.highlightScroll}
            contentContainerStyle={styles.highlightRow}>
            {highlights.map((h) => (
              <HighlightCard
                key={h.key}
                icon={h.icon}
                title={h.title}
                detail={h.detail}
                linkLabel={h.link}
                onPress={h.onPress}
              />
            ))}
          </ScrollView>
        </>
      )}

      {(matches.data?.active.length ?? 0) > 0 && (
        <View style={styles.matchStrip}>
          {matches.data!.active.map((m) => (
            <MatchCard key={m.id} match={m} highlight onPress={() => navigation.navigate('Match', { matchId: m.id })} />
          ))}
        </View>
      )}
      {(matches.data?.incoming.length ?? 0) > 0 && (
        <Pressable
          style={styles.challengeBanner}
          onPress={() => navigation.navigate('Compete', { tab: 'matches' })}
          accessibilityRole="button">
          <Icon name="karate" size={18} color={palette.primary} />
          <Text style={styles.challengeText}>
            {matches.data!.incoming.length === 1
              ? t('compete.home.incoming.one')
              : tf('compete.home.incoming.many', { n: matches.data!.incoming.length })}
          </Text>
          <Icon name="chevron-right" size={18} color={palette.textSecondary} />
        </Pressable>
      )}

      <View style={styles.tabs} accessibilityRole="tablist">
        {(['following', 'gym'] as const).map((key) => {
          const active = tab === key;
          return (
            <Pressable
              key={key}
              onPress={() => setTab(key)}
              style={styles.tab}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}>
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {key === 'following' ? t('community.tab.following') : t('community.tab.gym')}
              </Text>
              <View style={[styles.tabBar, active && styles.tabBarActive]} />
            </Pressable>
          );
        })}
      </View>

      <Pressable style={styles.composer} onPress={openCheckIn} accessibilityRole="button">
        <Avatar name={user?.displayName ?? ''} url={avatarUrl} size={38} />
        <Text style={styles.composerText} numberOfLines={1}>
          {t('community.composer')}
        </Text>
        {/* The check-in sheet takes a photo too. */}
        <Icon name="image-outline" size={26} color={palette.textPrimary} />
      </Pressable>

      {tab === 'following' && scope === 'all' && (
        <View style={styles.scopeRow}>
          <Text style={styles.scopeText}>{t('community.scope.all')}</Text>
          <Pressable onPress={() => setScope('following')} hitSlop={6} accessibilityRole="button">
            <Text style={styles.seeAll}>{t('community.scope.backToFollowing')}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );

  const Empty = loading ? (
    <View style={{ gap: 12, marginTop: 12 }}>
      <TrainingCardSkeleton />
      <TrainingCardSkeleton />
    </View>
  ) : tab === 'gym' ? (
    <View style={styles.center}>
      <Icon name="town-hall" size={40} color={palette.surfaceVariant} />
      <Text style={styles.emptyTitle}>{hasGym ? t('feed.empty.title') : t('community.gym.none.title')}</Text>
      <Text style={styles.emptySub}>{hasGym ? t('mural.empty') : t('community.gym.none.sub')}</Text>
      {!hasGym && <ArrowLink label={t('community.gym.none.button')} onPress={openGym} />}
    </View>
  ) : (
    <View style={styles.center}>
      <Icon name="account-group" size={40} color={palette.surfaceVariant} />
      <Text style={styles.emptyTitle}>
        {scope === 'following' ? t('community.following.empty.title') : t('feed.empty.title')}
      </Text>
      <Text style={styles.emptySub}>
        {scope === 'following' ? t('community.following.empty.sub') : t('feed.empty.sub')}
      </Text>
      {scope === 'following' && (
        <View style={{ gap: 14, marginTop: 6, alignItems: 'center' }}>
          <ArrowLink label={t('community.following.findPeople')} onPress={() => setSearchOpen(true)} />
          <ArrowLink label={t('community.following.seeAll')} onPress={() => setScope('all')} />
        </View>
      )}
    </View>
  );

  // Under "Seguindo", once both feeds are exhausted, point to the whole community.
  const Footer = loadingMore ? (
    <ActivityIndicator style={{ marginVertical: 16 }} color={palette.primary} />
  ) : tab === 'following' && scope === 'following' && rows.length > 0 && !feed.hasNextPage && !gymFeed.hasNextPage ? (
    <View style={styles.footer}>
      <ArrowLink label={t('community.following.seeAll')} onPress={() => setScope('all')} />
    </View>
  ) : null;

  return (
    <FlatList
      showsVerticalScrollIndicator={false}
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
      data={rows}
      keyExtractor={(r) =>
        r.kind === 'checkin' ? `c-${r.item.checkInId}` : r.kind === 'post' ? `p-${r.post.id}` : `m-${r.matchPost.id}`
      }
      renderItem={({ item: row }) =>
        row.kind === 'match' ? (
          <MatchPostCard
            post={row.matchPost}
            onOpen={() => navigation.navigate('Match', { matchId: row.matchPost.match.id })}
            onPressAuthor={(userId) => navigation.navigate('UserProfile', { userId })}
            onRepost={() => competeActions.repost(row.matchPost.id)}
          />
        ) : row.kind === 'checkin' ? (
          <CheckInPost
            item={row.item}
            onPressAuthor={(userId) => navigation.navigate('UserProfile', { userId })}
            onOpen={(it) => navigation.navigate('FeedComments', { item: it })}
          />
        ) : (
          <GymPost
            post={row.post}
            canPin={postActions.isStaff}
            canDelete={row.post.author.userId === postActions.myUserId || postActions.isOwner}
            onOpen={() => openPost(row.post)}
            onLike={() => postActions.like(row.post)}
            onSave={() => postActions.save(row.post)}
            onPinToggle={() => postActions.togglePin(row.post)}
            onDelete={() => postActions.confirmDelete(row.post)}
          />
        )
      }
      onEndReachedThreshold={0.5}
      onEndReached={loadMore}
      refreshControl={
        <RefreshControl
          refreshing={(feed.isRefetching || gymFeed.isRefetching) && !loadingMore}
          onRefresh={refresh}
          tintColor={palette.primary}
        />
      }
      ListHeaderComponent={Header}
      ListFooterComponent={Footer}
      ListEmptyComponent={Empty}
    />
  );
}

const styles = makeStyles(() => ({
  container: { flex: 1, backgroundColor: palette.background },
  content: { paddingHorizontal: 18, paddingBottom: 32, flexGrow: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: 18 },
  title: { flex: 1, color: palette.textPrimary, fontSize: 22, fontWeight: 'bold', marginLeft: 10 },
  iconBtn: { width: 34, height: 42, alignItems: 'center', justifyContent: 'center' },
  bellDot: {
    position: 'absolute',
    top: 7,
    right: 6,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: palette.primary,
    borderWidth: 1.5,
    borderColor: palette.background,
  },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  section: { color: palette.textPrimary, fontSize: 19, fontWeight: 'bold' },
  seeAll: { color: palette.primary, fontSize: 14, fontWeight: '600' },
  highlightScroll: { marginHorizontal: -18 },
  highlightRow: { paddingHorizontal: 18, gap: 12 },
  tabs: {
    flexDirection: 'row',
    gap: 28,
    marginTop: 22,
    borderBottomWidth: 1,
    borderBottomColor: palette.surfaceVariant,
  },
  tab: { paddingTop: 4 },
  tabText: { color: palette.textSecondary, fontSize: 17, fontWeight: '500', paddingBottom: 10, paddingHorizontal: 2 },
  tabTextActive: { color: palette.textPrimary, fontWeight: 'bold' },
  tabBar: { height: 3, borderRadius: 2, marginBottom: -1 },
  tabBarActive: { backgroundColor: palette.primary },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: palette.surface,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 18,
    marginBottom: 4,
  },
  composerText: { flex: 1, color: palette.textSecondary, fontSize: 15 },
  scopeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  scopeText: { color: palette.textSecondary, fontSize: 13, fontWeight: '600' },
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
  userName: { color: palette.textPrimary, fontSize: 15, fontWeight: '600' },
  userHandle: { color: palette.textSecondary, fontSize: 12, marginTop: 2 },
  searchEmpty: { color: palette.textSecondary, fontSize: 13, textAlign: 'center', paddingTop: 30 },
  center: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: 40, paddingHorizontal: 12 },
  emptyTitle: { color: palette.textPrimary, fontWeight: 'bold', fontSize: 15, textAlign: 'center' },
  emptySub: { color: palette.textSecondary, fontSize: 13, textAlign: 'center' },
  footer: { alignItems: 'center', paddingVertical: 20 },
  matchStrip: { gap: 8, marginTop: 18 },
  challengeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.primary,
  },
  challengeText: { flex: 1, color: palette.textPrimary, fontSize: 14, fontWeight: '600' },
}));
