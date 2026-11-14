import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { InfiniteData, useMutation, useQueryClient } from '@tanstack/react-query';
import { ReactElement } from 'react';
import { ActivityIndicator, Alert, RefreshControl, Share, StyleSheet, Text } from 'react-native';
import Animated, { FadeInDown, FadeOutUp, LinearTransition } from 'react-native-reanimated';

import { Gym } from '../api/gyms';
import { isQueued } from '../offline/write';
import { Post, PostPage, deletePost, setPinned, sharePost, toggleLike, toggleSave } from '../api/posts';
import { t } from '../i18n';
import { GymStackParamList } from '../navigation/GymNavigator';
import { useAuthStore } from '../store/authStore';
import { makeStyles, palette } from '../theme/theme';
import { downloadPostMedia } from '../utils/download';
import PostCard from './PostCard';

type Nav = NativeStackNavigationProp<GymStackParamList>;

export default function PostList({
  posts,
  gym,
  header,
  emptyText,
  refreshing,
  onRefresh,
  onEndReached,
  loadingMore,
}: {
  posts: Post[];
  gym: Gym;
  header?: ReactElement;
  emptyText: string;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Called near the end of the list, to fetch the next page. */
  onEndReached?: () => void;
  loadingMore?: boolean;
}) {
  const navigation = useNavigation<Nav>();
  const queryClient = useQueryClient();
  const myUserId = useAuthStore((s) => s.user?.id);
  const isStaff = gym.role === 'OWNER' || gym.role === 'INSTRUCTOR';
  const isOwner = gym.role === 'OWNER';

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['gymFeed'] });
    queryClient.invalidateQueries({ queryKey: ['savedPosts'] });
  };

  /** Rewrites one post wherever it is cached (the paged wall and the saved list). */
  const patchPost = (id: number, change: (post: Post) => Post) => {
    queryClient.setQueryData<InfiniteData<PostPage>>(['gymFeed'], (old) =>
      old?.pages
        ? {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.map((post) => (post.id === id ? change(post) : post)),
            })),
          }
        : old,
    );
    queryClient.setQueryData<Post[]>(['savedPosts'], (old) =>
      Array.isArray(old) ? old.map((post) => (post.id === id ? change(post) : post)) : old,
    );
  };

  // Likes and saves show at once and are corrected by the server's answer;
  // a failure re-syncs from the server instead of leaving a wrong state.
  const like = useMutation({
    mutationFn: (id: number) => toggleLike(id),
    onMutate: (id) =>
      patchPost(id, (post) => ({
        ...post,
        likedByMe: !post.likedByMe,
        likeCount: Math.max(0, post.likeCount + (post.likedByMe ? -1 : 1)),
      })),
    // Queued offline: keep the optimistic state; the queue confirms it later.
    onSuccess: (result, id) => {
      if (isQueued(result)) return;
      patchPost(id, (post) => ({ ...post, likedByMe: result.liked, likeCount: result.likeCount }));
    },
    onError: invalidate,
  });
  const save = useMutation({
    mutationFn: (id: number) => toggleSave(id),
    onMutate: (id) => patchPost(id, (post) => ({ ...post, savedByMe: !post.savedByMe })),
    onSuccess: (result, id) => {
      if (isQueued(result)) return;
      patchPost(id, (post) => ({ ...post, savedByMe: result.saved }));
      queryClient.invalidateQueries({ queryKey: ['savedPosts'] });
    },
    onError: invalidate,
  });
  const pin = useMutation({
    mutationFn: (v: { id: number; pinned: boolean }) => setPinned(v.id, v.pinned),
    onSuccess: invalidate,
  });
  const del = useMutation({ mutationFn: (id: number) => deletePost(id), onSuccess: invalidate });

  const onShare = async (post: Post) => {
    try {
      const r = await Share.share({ message: post.content });
      if (r.action !== Share.dismissedAction) {
        await sharePost(post.id);
        invalidate();
      }
    } catch {
      /* ignore */
    }
  };

  const confirmDelete = (post: Post) =>
    Alert.alert(t('mural.delete.title'), t('mural.delete.message'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('mural.delete'), style: 'destructive', onPress: () => del.mutate(post.id) },
    ]);

  const openDetail = (id: number) => navigation.navigate('PostDetail', { postId: id });

  return (
    <Animated.FlatList
      data={posts}
      keyExtractor={(p) => String(p.id)}
      ListHeaderComponent={header}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      // posts slide between positions when the list reorders (pin/unpin)
      itemLayoutAnimation={LinearTransition.duration(250)}
      // render-window tuning: keeps long feeds cheap to scroll
      removeClippedSubviews
      initialNumToRender={8}
      maxToRenderPerBatch={8}
      windowSize={7}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing ?? false}
            onRefresh={onRefresh}
            tintColor={palette.primary}
          />
        ) : undefined
      }
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.footer} color={palette.primary} /> : null}
      ListEmptyComponent={<Text style={styles.empty}>{emptyText}</Text>}
      renderItem={({ item }: { item: Post }) => (
        <Animated.View entering={FadeInDown.duration(300)} exiting={FadeOutUp.duration(220)}>
        <PostCard
          post={item}
          myUserId={myUserId}
          isOwner={isOwner}
          isStaff={isStaff}
          onLike={() => like.mutate(item.id)}
          onComment={() => openDetail(item.id)}
          onOpen={() => openDetail(item.id)}
          onShare={() => onShare(item)}
          onSave={() => save.mutate(item.id)}
          onDownload={() => downloadPostMedia(item.media)}
          onPinToggle={() => pin.mutate({ id: item.id, pinned: !item.pinned })}
          onDelete={() => confirmDelete(item)}
        />
        </Animated.View>
      )}
    />
  );
}

const styles = makeStyles(() => ({
  content: { paddingBottom: 24, flexGrow: 1 },
  empty: { color: palette.textSecondary, textAlign: 'center', paddingVertical: 32 },
  footer: { paddingVertical: 16 },
}));
