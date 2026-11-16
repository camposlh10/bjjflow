import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ReactElement } from 'react';
import { ActivityIndicator, RefreshControl, Text } from 'react-native';
import Animated, { FadeInDown, FadeOutUp, LinearTransition } from 'react-native-reanimated';

import { Gym } from '../api/gyms';
import { Post } from '../api/posts';
import { GymStackParamList } from '../navigation/GymNavigator';
import { makeStyles, palette } from '../theme/theme';
import { downloadPostMedia } from '../utils/download';
import PostCard from './PostCard';
import { usePostActions } from './usePostActions';

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
  const actions = usePostActions(gym);
  const { myUserId, isStaff, isOwner } = actions;

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
          onLike={() => actions.like(item)}
          onComment={() => openDetail(item.id)}
          onOpen={() => openDetail(item.id)}
          onShare={() => actions.share(item)}
          onSave={() => actions.save(item)}
          onDownload={() => downloadPostMedia(item.media)}
          onPinToggle={() => actions.togglePin(item)}
          onDelete={() => actions.confirmDelete(item)}
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
