import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Pressable, RefreshControl, StyleSheet, TextInput, View } from 'react-native';
import { Text } from 'react-native-paper';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getCommunityFeed } from '../api/feed';
import { getNotifications } from '../api/notifications';
import { resolveMediaUrl } from '../api/posts';
import { SearchUser, searchUsers } from '../api/users';
import { TrainingCardSkeleton } from '../components/Skeleton';
import TrainingCard from '../components/TrainingCard';
import { t } from '../i18n';
import type { ComunidadeStackParamList } from '../navigation/ComunidadeNavigator';
import { makeStyles, palette } from '../theme/theme';

type Nav = NativeStackNavigationProp<ComunidadeStackParamList, 'ComunidadeFeed'>;

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export default function ComunidadeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const [query, setQuery] = useState('');
  const q = query.trim();
  const searching = q.length >= 2;

  const feed = useInfiniteQuery({
    queryKey: ['communityFeed'],
    queryFn: ({ pageParam }) => getCommunityFeed(pageParam),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
  const results = useQuery({ queryKey: ['userSearch', q], queryFn: () => searchUsers(q), enabled: searching });
  const notifications = useQuery({ queryKey: ['notifications'], queryFn: () => getNotifications() });
  const unread = notifications.data?.unread ?? 0;

  const items = feed.data?.pages.flatMap((p) => p.items) ?? [];
  const users = Array.isArray(results.data) ? results.data : [];

  const soon = () => Alert.alert(t('gym.soon'));

  const Header = (
    <View>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text variant="titleLarge" style={styles.title}>
            {t('tabs.community')}
          </Text>
          <Text style={styles.subtitle}>{t('feed.subtitle')}</Text>
        </View>
        <View style={styles.headActions}>
          <Pressable
            style={styles.iconBtn}
            onPress={() => navigation.navigate('Direct')}
            hitSlop={8}
            accessibilityLabel={t('feed.messages')}>
            <MaterialCommunityIcons name="message-outline" size={22} color={palette.textPrimary} />
          </Pressable>
          <Pressable
            style={styles.iconBtn}
            onPress={() => navigation.navigate('NotificationCenter')}
            hitSlop={8}
            accessibilityLabel={t('feed.notifications')}>
            <MaterialCommunityIcons name="bell-outline" size={22} color={palette.textPrimary} />
            {unread > 0 && <View style={styles.bellDot} />}
          </Pressable>
        </View>
      </View>
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
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')} hitSlop={8}>
            <MaterialCommunityIcons name="close-circle" size={18} color={palette.textSecondary} />
          </Pressable>
        )}
      </View>
    </View>
  );

  if (searching) {
    return (
      <FlatList
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
        data={users}
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
          results.isLoading ? null : <Text style={styles.searchEmpty}>{t('feed.search.empty')}</Text>
        }
      />
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
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
        <RefreshControl refreshing={feed.isRefetching} onRefresh={() => feed.refetch()} tintColor={palette.primary} />
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
            <TrainingCardSkeleton />
          </View>
        ) : (
          <View style={styles.center}>
            <MaterialCommunityIcons name="earth" size={44} color={palette.surfaceVariant} />
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
  content: { paddingHorizontal: 20, paddingBottom: 32, flexGrow: 1 },
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  headActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellDot: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: palette.primary,
    borderWidth: 1.5,
    borderColor: palette.surface,
  },
  title: { color: palette.textPrimary, fontWeight: 'bold' },
  subtitle: { color: palette.textSecondary, fontSize: 13, marginTop: 2 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: palette.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
    marginBottom: 14,
  },
  searchInput: { flex: 1, color: palette.textPrimary, fontSize: 14, padding: 0 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  userAvatar: { width: 46, height: 46, borderRadius: 23 },
  userAvatarFallback: { backgroundColor: palette.surfaceVariant, alignItems: 'center', justifyContent: 'center' },
  userAvatarText: { color: palette.textPrimary, fontWeight: 'bold', fontSize: 15 },
  userName: { color: palette.textPrimary, fontSize: 15, fontWeight: '600' },
  userHandle: { color: palette.textSecondary, fontSize: 12, marginTop: 2 },
  searchEmpty: { color: palette.textSecondary, fontSize: 13, textAlign: 'center', paddingTop: 30 },
  center: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: 80 },
  emptyTitle: { color: palette.textPrimary, fontWeight: 'bold', fontSize: 15 },
  emptySub: { color: palette.textSecondary, fontSize: 13, textAlign: 'center' },
}));
