import { InfiniteData, useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, Share } from 'react-native';

import { Gym } from '../api/gyms';
import { Post, PostPage, deletePost, setPinned, sharePost, toggleLike, toggleSave } from '../api/posts';
import { t } from '../i18n';
import { isQueued } from '../offline/write';
import { useAuthStore } from '../store/authStore';

/**
 * Like, save, share, pin and delete for gym wall posts, shared by the wall
 * (PostList) and the home feed. Updates the post wherever it is cached.
 */
export function usePostActions(gym: Gym | null | undefined) {
  const queryClient = useQueryClient();
  const myUserId = useAuthStore((s) => s.user?.id);
  const isStaff = gym?.role === 'OWNER' || gym?.role === 'INSTRUCTOR';
  const isOwner = gym?.role === 'OWNER';

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

  const share = async (post: Post) => {
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

  return {
    myUserId,
    isStaff,
    isOwner,
    like: (post: Post) => like.mutate(post.id),
    save: (post: Post) => save.mutate(post.id),
    togglePin: (post: Post) => pin.mutate({ id: post.id, pinned: !post.pinned }),
    share,
    confirmDelete,
  };
}
