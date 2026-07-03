import { useHeaderHeight } from '@react-navigation/elements';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ActivityIndicator } from 'react-native-paper';

import type { FeedComment } from '../api/feed';
import { addFeedComment, getFeedComments } from '../api/feed';
import TrainingCard from '../components/TrainingCard';
import { t } from '../i18n';
import type { ComunidadeStackParamList } from '../navigation/ComunidadeNavigator';
import { makeStyles, palette } from '../theme/theme';
import { timeAgo } from '../utils/time';

type Props = NativeStackScreenProps<ComunidadeStackParamList, 'FeedComments'>;

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export default function FeedCommentsScreen({ route, navigation }: Props) {
  const { item } = route.params;
  const checkInId = item.checkInId;
  const queryClient = useQueryClient();
  const headerHeight = useHeaderHeight();
  const [reply, setReply] = useState('');

  const comments = useQuery({ queryKey: ['feedComments', checkInId], queryFn: () => getFeedComments(checkInId) });

  const send = useMutation({
    mutationFn: () => addFeedComment(checkInId, reply.trim()),
    onSuccess: () => {
      setReply('');
      queryClient.invalidateQueries({ queryKey: ['feedComments', checkInId] });
      queryClient.invalidateQueries({ queryKey: ['communityFeed'] });
    },
  });

  const Header = (
    <View style={styles.headerWrap}>
      <TrainingCard
        item={item}
        showActions={false}
        onPressAuthor={(userId) => navigation.navigate('UserProfile', { userId })}
      />
      <Text style={styles.commentsTitle}>{t('feed.comments.title')}</Text>
      {comments.isLoading && <ActivityIndicator style={{ marginVertical: 16 }} />}
      {!comments.isLoading && (comments.data?.length ?? 0) === 0 && (
        <Text style={styles.empty}>{t('feed.comments.empty')}</Text>
      )}
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={headerHeight}>
      <FlatList
        data={comments.data ?? []}
        keyExtractor={(c: FeedComment) => String(c.id)}
        ListHeaderComponent={Header}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        renderItem={({ item: c }) => (
          <View style={styles.reply}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initialsOf(c.author.displayName)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.replyHead}>
                {c.author.displayName} <Text style={styles.replyTime}>· {timeAgo(c.createdAt)}</Text>
              </Text>
              <Text style={styles.replyContent}>{c.content}</Text>
            </View>
          </View>
        )}
      />
      <View style={styles.composer}>
        <TextInput
          value={reply}
          onChangeText={setReply}
          placeholder={t('feed.comments.placeholder')}
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
  list: { padding: 16 },
  headerWrap: { marginBottom: 8 },
  commentsTitle: { color: palette.textPrimary, fontSize: 14, fontWeight: 'bold', marginTop: 18, marginBottom: 4 },
  empty: { color: palette.textSecondary, fontSize: 13, marginTop: 8 },
  reply: { flexDirection: 'row', gap: 10, paddingVertical: 12, borderBottomWidth: 0.5, borderColor: '#1A1A20' },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: palette.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: palette.textPrimary, fontWeight: 'bold', fontSize: 11 },
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
  replyInput: { flex: 1, maxHeight: 100, color: palette.textPrimary, fontSize: 14, paddingHorizontal: 8 },
  replyBtn: { backgroundColor: palette.primary, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  replyBtnOff: { opacity: 0.5 },
  replyBtnText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
}));
