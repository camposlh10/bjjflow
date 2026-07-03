import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useHeaderHeight } from '@react-navigation/elements';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ActivityIndicator } from 'react-native-paper';

import { GymRole } from '../../api/gyms';
import {
  Comment,
  Post,
  addComment,
  getComments,
  getPost,
  sharePost,
  toggleLike,
  toggleSave,
} from '../../api/posts';
import ActionButton from '../../components/ActionButton';
import BeltVisual from '../../components/BeltVisual';
import PostMedia from '../../components/PostMedia';
import { rankBarColorFor } from '../../constants/belts';
import { t } from '../../i18n';
import { GymStackParamList } from '../../navigation/GymNavigator';
import { makeStyles, palette } from '../../theme/theme';
import { downloadPostMedia } from '../../utils/download';
import { renderRichText } from '../../utils/richText';
import { formatDateTime, timeAgo } from '../../utils/time';

type Props = NativeStackScreenProps<GymStackParamList, 'PostDetail'>;

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

function roleLabel(role: GymRole): { label: string; staff: boolean } {
  if (role === 'OWNER') return { label: t('gym.role.OWNER'), staff: true };
  if (role === 'INSTRUCTOR') return { label: t('gym.role.INSTRUCTOR'), staff: true };
  return { label: t('gym.role.MEMBER'), staff: false };
}

function AuthorRow({ author, large }: { author: Post['author']; large?: boolean }) {
  const role = roleLabel(author.role);
  return (
    <View style={styles.authorRow}>
      <View style={[styles.avatar, large && styles.avatarLarge]}>
        <Text style={styles.avatarText}>{initialsOf(author.displayName)}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>
          {author.displayName}
          <Text style={role.staff ? styles.roleStaff : styles.roleMember}> · {role.label}</Text>
        </Text>
        {author.belt && (
          <View style={styles.beltRow}>
            <View style={styles.beltMini}>
              <BeltVisual
                color={author.belt.colorHex}
                rankBarColor={rankBarColorFor(author.belt.slug)}
                stripes={author.belt.stripes}
                height={7}
              />
            </View>
            <Text style={styles.beltLabel}>{author.belt.namePt}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

export default function PostDetailScreen({ route }: Props) {
  const { postId } = route.params;
  const queryClient = useQueryClient();
  const headerHeight = useHeaderHeight();
  const inputRef = useRef<TextInput>(null);
  const [reply, setReply] = useState('');

  const post = useQuery({ queryKey: ['post', postId], queryFn: () => getPost(postId) });
  const comments = useQuery({ queryKey: ['comments', postId], queryFn: () => getComments(postId) });

  const refreshPost = () => {
    queryClient.invalidateQueries({ queryKey: ['post', postId] });
    queryClient.invalidateQueries({ queryKey: ['gymFeed'] });
  };

  const like = useMutation({ mutationFn: () => toggleLike(postId), onSuccess: refreshPost });
  const save = useMutation({ mutationFn: () => toggleSave(postId), onSuccess: refreshPost });
  const send = useMutation({
    mutationFn: () => addComment(postId, reply.trim()),
    onSuccess: () => {
      setReply('');
      queryClient.invalidateQueries({ queryKey: ['comments', postId] });
      refreshPost();
    },
  });

  const onShare = async () => {
    if (!post.data) return;
    try {
      const result = await Share.share({ message: post.data.content });
      if (result.action !== Share.dismissedAction) {
        await sharePost(postId);
        refreshPost();
      }
    } catch {
      // ignore
    }
  };

  if (post.isLoading || !post.data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  const p = post.data;

  const Header = (
    <View>
      <AuthorRow author={p.author} large />
      {p.content.length > 0 && <Text style={styles.content}>{renderRichText(p.content)}</Text>}
      <PostMedia media={p.media} />
      <Text style={styles.datetime}>{formatDateTime(p.createdAt)}</Text>

      <View style={styles.statsRow}>
        <Text style={styles.stat}>
          <Text style={styles.statNum}>{p.likeCount}</Text> {t('post.likes')}
        </Text>
        <Text style={styles.stat}>
          <Text style={styles.statNum}>{p.commentCount}</Text> {t('post.replies')}
        </Text>
      </View>

      <View style={styles.actionRow}>
        <ActionButton
          icon="comment-outline"
          size={19}
          onPress={() => inputRef.current?.focus()}
        />
        <ActionButton
          icon={p.likedByMe ? 'heart' : 'heart-outline'}
          size={19}
          color={p.likedByMe ? palette.primary : palette.textSecondary}
          onPress={() => like.mutate()}
        />
        <ActionButton icon="share-outline" size={19} onPress={onShare} />
        <ActionButton icon="tray-arrow-down" size={19} onPress={() => downloadPostMedia(p.media)} />
        <ActionButton
          icon={p.savedByMe ? 'bookmark' : 'bookmark-outline'}
          size={19}
          color={p.savedByMe ? palette.primary : palette.textSecondary}
          onPress={() => save.mutate()}
        />
      </View>

      {comments.isLoading && <ActivityIndicator style={{ marginVertical: 16 }} />}
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={headerHeight}>
      <FlatList
        data={comments.data ?? []}
        keyExtractor={(c: Comment) => String(c.id)}
        ListHeaderComponent={Header}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.reply}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initialsOf(item.author.displayName)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.replyHead}>
                {item.author.displayName} <Text style={styles.replyTime}>· {timeAgo(item.createdAt)}</Text>
              </Text>
              <Text style={styles.replyContent}>{renderRichText(item.content)}</Text>
            </View>
          </View>
        )}
      />
      <View style={styles.composer}>
        <TextInput
          ref={inputRef}
          value={reply}
          onChangeText={setReply}
          placeholder={t('mural.reply.placeholder')}
          placeholderTextColor={palette.textSecondary}
          style={styles.replyInput}
          multiline
        />
        <Pressable
          onPress={() => send.mutate()}
          disabled={reply.trim().length === 0 || send.isPending}
          style={[styles.replyBtn, (reply.trim().length === 0 || send.isPending) && styles.replyBtnOff]}>
          <Text style={styles.replyBtnText}>{t('mural.reply.send')}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = makeStyles(() => ({
  container: { flex: 1, backgroundColor: palette.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.background },
  list: { padding: 16 },
  authorRow: { flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 10 },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: palette.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLarge: { width: 40, height: 40, borderRadius: 20 },
  avatarText: { color: palette.textPrimary, fontWeight: 'bold', fontSize: 11 },
  name: { color: palette.textPrimary, fontSize: 14, fontWeight: 'bold' },
  roleStaff: { color: palette.primary, fontSize: 11, fontWeight: 'normal' },
  roleMember: { color: palette.textSecondary, fontSize: 11, fontWeight: 'normal' },
  beltRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  beltMini: { width: 32 },
  beltLabel: { color: palette.textSecondary, fontSize: 10 },
  content: { color: palette.textPrimary, fontSize: 15, lineHeight: 21, marginBottom: 10 },
  datetime: { color: palette.textSecondary, fontSize: 12, marginTop: 10, marginBottom: 12 },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
    borderTopWidth: 0.5,
    borderBottomWidth: 0.5,
    borderColor: palette.surfaceVariant,
    paddingVertical: 10,
  },
  stat: { color: palette.textSecondary, fontSize: 12 },
  statNum: { color: palette.textPrimary, fontWeight: 'bold' },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderBottomWidth: 0.5,
    borderColor: palette.surfaceVariant,
    paddingVertical: 8,
    marginBottom: 4,
  },
  action: { padding: 4 },
  reply: { flexDirection: 'row', gap: 10, paddingVertical: 12, borderBottomWidth: 0.5, borderColor: '#1A1A20' },
  replyHead: { color: palette.textPrimary, fontSize: 12, fontWeight: 'bold' },
  replyTime: { color: palette.textSecondary, fontSize: 11, fontWeight: 'normal' },
  replyContent: { color: '#E4E4E7', fontSize: 13, lineHeight: 18, marginTop: 2 },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 0.5,
    borderTopColor: palette.surfaceVariant,
    backgroundColor: palette.surface,
  },
  replyInput: {
    flex: 1,
    maxHeight: 100,
    color: palette.textPrimary,
    fontSize: 14,
    paddingHorizontal: 8,
  },
  replyBtn: { backgroundColor: palette.primary, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  replyBtnOff: { opacity: 0.5 },
  replyBtnText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
}));
