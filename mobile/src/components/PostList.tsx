import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ReactElement } from 'react';
import { Alert, RefreshControl, Share, StyleSheet, Text } from 'react-native';
import Animated, { FadeInDown, FadeOutUp, LinearTransition } from 'react-native-reanimated';

import { Gym } from '../api/gyms';
import { Post, deletePost, setPinned, sharePost, toggleLike, toggleSave } from '../api/posts';
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
}: {
  posts: Post[];
  gym: Gym;
  header?: ReactElement;
  emptyText: string;
  refreshing?: boolean;
  onRefresh?: () => void;
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

  const like = useMutation({ mutationFn: (id: number) => toggleLike(id), onSuccess: invalidate });
  const save = useMutation({ mutationFn: (id: number) => toggleSave(id), onSuccess: invalidate });
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
}));
