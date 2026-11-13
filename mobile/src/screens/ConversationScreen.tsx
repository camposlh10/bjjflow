import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useHeaderHeight } from '@react-navigation/elements';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ActivityIndicator } from 'react-native-paper';

import { DirectMessage, getMessages, startConversation } from '../api/messages';
import { resolveMediaUrl } from '../api/posts';
import { t } from '../i18n';
import { discardMessage, queueMessage, retryMessage, useOutbox } from '../offline/outbox';
import { useRealtimeStatus } from '../realtime/realtime';
import { useAuthStore } from '../store/authStore';
import { makeStyles, palette } from '../theme/theme';

/** Messages fetched per page (first load and each "load earlier"). */
const PAGE_SIZE = 50;

/** A row in the thread: a confirmed message, or one still in the outbox. */
type Row = DirectMessage & { outboxId?: string; failed?: boolean };

type Params = {
  conversationId?: number;
  userId?: number;
  title?: string;
  username?: string | null;
  avatarUrl?: string | null;
};

type Peer = { name: string; username: string | null; avatarUrl: string | null };

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

function HeaderTitle({ peer }: { peer: Peer }) {
  return (
    <View style={styles.headerTitle}>
      {peer.avatarUrl ? (
        <Image source={{ uri: resolveMediaUrl(peer.avatarUrl) }} style={styles.headerAvatar} />
      ) : (
        <View style={[styles.headerAvatar, styles.headerAvatarFallback]}>
          <Text style={styles.headerAvatarText}>{initialsOf(peer.name || '?')}</Text>
        </View>
      )}
      <View>
        <Text style={styles.headerName} numberOfLines={1}>
          {peer.name}
        </Text>
        {peer.username ? (
          <Text style={styles.headerHandle} numberOfLines={1}>
            @{peer.username}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export default function ConversationScreen() {
  const route = useRoute<RouteProp<Record<string, Params>, string>>();
  const navigation = useNavigation<any>();
  const headerHeight = useHeaderHeight();
  const queryClient = useQueryClient();
  const listRef = useRef<FlatList<Row>>(null);

  const params = route.params ?? {};
  const [convId, setConvId] = useState<number | null>(params.conversationId ?? null);
  const [text, setText] = useState('');
  const [peer, setPeer] = useState<Peer>({
    name: params.title ?? '',
    username: params.username ?? null,
    avatarUrl: params.avatarUrl ?? null,
  });

  // Render the Instagram-style header (avatar + name + @handle).
  useEffect(() => {
    navigation.setOptions({ headerTitle: () => <HeaderTitle peer={peer} />, headerTitleAlign: 'left' });
  }, [navigation, peer]);

  // Opened from a profile with only a userId — get-or-create the thread + peer info.
  useEffect(() => {
    let active = true;
    if (convId == null && params.userId != null) {
      startConversation(params.userId).then((c) => {
        if (!active) return;
        setConvId(c.id);
        setPeer({ name: c.other.displayName, username: c.other.username, avatarUrl: c.other.avatarUrl });
      });
    }
    return () => {
      active = false;
    };
  }, [convId, params.userId]);

  const myId = useAuthStore((s) => s.user?.id);
  const messagesKey = ['messages', convId];
  const [noEarlier, setNoEarlier] = useState(false);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  // Set while older messages are being prepended, so the list doesn't jump to the bottom.
  const keepScroll = useRef(false);

  // The thread lives in the cache as one growing list. The first fetch loads the
  // latest page; every poll after that asks only for messages newer than the last
  // one we have, so a quiet conversation costs an empty response. With the live
  // connection up, new messages trigger a refetch at once and the poll is only a
  // safety net.
  const connected = useRealtimeStatus((s) => s.connected);
  const messages = useQuery({
    queryKey: messagesKey,
    queryFn: async () => {
      const cached = queryClient.getQueryData<DirectMessage[]>(messagesKey) ?? [];
      const lastConfirmed = cached[cached.length - 1];
      const fetched = lastConfirmed
        ? await getMessages(convId as number, { after: lastConfirmed.id })
        : await getMessages(convId as number, { limit: PAGE_SIZE });
      // Re-read: a message may have been sent while the request was in flight.
      const current = queryClient.getQueryData<DirectMessage[]>(messagesKey) ?? [];
      const known = new Set(current.map((m) => m.id));
      const fresh = fetched.filter((m) => !known.has(m.id));
      if (fresh.length === 0) {
        return current;
      }
      return [...current, ...fresh].sort((a, b) => a.id - b.id);
    },
    enabled: convId != null,
    refetchInterval: connected ? 30_000 : 4_000,
  });

  // Messages typed here wait in the outbox until the server confirms them; they
  // survive a lost connection and the app closing.
  const outboxItems = useOutbox((s) => s.items);
  const pending = useMemo(
    () => outboxItems.filter((i) => i.kind === 'message' && i.conversationId === convId),
    [outboxItems, convId],
  );

  const send = () => {
    const content = text.trim();
    if (!content || convId == null) return;
    setText('');
    queueMessage(convId, content);
  };

  const onPendingPress = (row: Row) => {
    if (!row.failed || !row.outboxId) return;
    const id = row.outboxId;
    Alert.alert(t('dm.thread.failed'), row.content, [
      { text: t('dm.thread.discard'), style: 'destructive', onPress: () => discardMessage(id) },
      { text: t('dm.thread.retry'), onPress: () => retryMessage(id) },
    ]);
  };


  const confirmed = messages.data ?? [];
  const data: Row[] = useMemo(
    () => [
      ...confirmed,
      ...pending.map((item, index) => ({
        id: -(index + 1),
        senderId: myId ?? 0,
        fromMe: true,
        content: item.kind === 'message' ? item.content : '',
        createdAt: item.createdAt,
        outboxId: item.id,
        failed: item.kind === 'message' ? item.failed : false,
      })),
    ],
    [confirmed, pending, myId],
  );
  const canSend = text.trim().length > 0 && convId != null;
  const canLoadEarlier = confirmed.length >= PAGE_SIZE && !noEarlier;

  const loadEarlier = async () => {
    const first = confirmed[0];
    if (!first || loadingEarlier || convId == null) return;
    setLoadingEarlier(true);
    try {
      const older = await getMessages(convId, { limit: PAGE_SIZE, before: first.id });
      if (older.length < PAGE_SIZE) setNoEarlier(true);
      if (older.length > 0) {
        keepScroll.current = true;
        queryClient.setQueryData<DirectMessage[]>(messagesKey, (old = []) => {
          const known = new Set(old.map((m) => m.id));
          return [...older.filter((m) => !known.has(m.id)), ...old];
        });
      }
    } catch {
      // Leave the button in place so it can be tried again.
    } finally {
      setLoadingEarlier(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={headerHeight}>
      {convId == null || messages.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          showsVerticalScrollIndicator={false}
          ref={listRef}
          data={data}
          keyExtractor={(m) => m.outboxId ?? String(m.id)}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onContentSizeChange={() => {
            if (keepScroll.current) {
              keepScroll.current = false;
              return;
            }
            listRef.current?.scrollToEnd({ animated: false });
            // The last row can finish laying out a frame later (web especially),
            // which left the newest message under the composer. Scroll once more.
            requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: false }));
          }}
          ListHeaderComponent={
            canLoadEarlier ? (
              <Pressable onPress={loadEarlier} disabled={loadingEarlier} style={styles.loadEarlier}>
                {loadingEarlier ? (
                  <ActivityIndicator size="small" />
                ) : (
                  <Text style={styles.loadEarlierText}>{t('dm.thread.loadEarlier')}</Text>
                )}
              </Pressable>
            ) : null
          }
          ListEmptyComponent={<Text style={styles.emptyHint}>{t('dm.thread.empty')}</Text>}
          renderItem={({ item, index }) => {
            // Group consecutive messages from the same sender (tighter spacing, IG-style).
            const prev = data[index - 1];
            const grouped = prev && prev.fromMe === item.fromMe;
            return (
              <View
                style={[
                  styles.bubbleRow,
                  item.fromMe ? styles.rowMine : styles.rowTheirs,
                  { marginTop: grouped ? 2 : 10 },
                ]}>
                <Pressable
                  onPress={() => onPendingPress(item)}
                  disabled={!item.failed}
                  accessibilityHint={item.failed ? t('dm.thread.failed') : undefined}
                  style={[
                    styles.bubble,
                    item.fromMe ? styles.bubbleMine : styles.bubbleTheirs,
                    grouped && (item.fromMe ? styles.groupedMine : styles.groupedTheirs),
                    // Still on its way to the server.
                    item.outboxId && !item.failed && styles.bubblePending,
                    item.failed && styles.bubbleFailed,
                  ]}>
                  <Text style={item.fromMe ? styles.textMine : styles.textTheirs}>{item.content}</Text>
                </Pressable>
                {item.outboxId ? (
                  <Text style={[styles.status, item.failed && styles.statusFailed]}>
                    {item.failed ? t('dm.thread.failed') : t('dm.thread.sending')}
                  </Text>
                ) : null}
              </View>
            );
          }}
        />
      )}
      <View style={styles.composer}>
        <View style={styles.inputPill}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={t('dm.thread.placeholder')}
            placeholderTextColor={palette.textSecondary}
            style={styles.input}
            multiline
          />
        </View>
        <Pressable
          onPress={send}
          disabled={!canSend}
          style={[styles.sendBtn, !canSend && styles.sendBtnOff]}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={t('a11y.send')}>
          <MaterialCommunityIcons name="arrow-up" size={20} color="#fff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = makeStyles(() => ({
  container: { flex: 1, backgroundColor: palette.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  headerTitle: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerAvatar: { width: 32, height: 32, borderRadius: 16 },
  headerAvatarFallback: { backgroundColor: palette.surfaceVariant, alignItems: 'center', justifyContent: 'center' },
  headerAvatarText: { color: palette.textPrimary, fontWeight: 'bold', fontSize: 12 },
  headerName: { color: palette.textPrimary, fontSize: 15, fontWeight: 'bold' },
  headerHandle: { color: palette.textSecondary, fontSize: 11 },

  list: { padding: 12, flexGrow: 1, justifyContent: 'flex-end' },
  emptyHint: { color: palette.textSecondary, fontSize: 13, textAlign: 'center', marginVertical: 24 },
  loadEarlier: { alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 16, minHeight: 40, justifyContent: 'center' },
  loadEarlierText: { color: palette.primary, fontSize: 13, fontWeight: '600' },
  bubblePending: { opacity: 0.6 },
  bubbleFailed: { opacity: 0.6 },
  status: { color: palette.textSecondary, fontSize: 11, marginTop: 2 },
  statusFailed: { color: palette.primary },
  // Column so a pending message's status line sits under its bubble.
  bubbleRow: { flexDirection: 'column' },
  rowMine: { alignItems: 'flex-end' },
  rowTheirs: { alignItems: 'flex-start' },
  bubble: { maxWidth: '76%', borderRadius: 20, paddingHorizontal: 13, paddingVertical: 9 },
  bubbleMine: { backgroundColor: palette.primary, borderBottomRightRadius: 6 },
  bubbleTheirs: { backgroundColor: palette.surface, borderBottomLeftRadius: 6 },
  groupedMine: { borderTopRightRadius: 6 },
  groupedTheirs: { borderTopLeftRadius: 6 },
  textMine: { color: '#fff', fontSize: 15, lineHeight: 20 },
  textTheirs: { color: palette.textPrimary, fontSize: 15, lineHeight: 20 },

  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: palette.background,
  },
  inputPill: {
    flex: 1,
    backgroundColor: palette.surface,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.surfaceVariant,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 10 : 4,
    justifyContent: 'center',
  },
  input: { maxHeight: 110, color: palette.textPrimary, fontSize: 15, padding: 0 },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnOff: { opacity: 0.4 },
}));
