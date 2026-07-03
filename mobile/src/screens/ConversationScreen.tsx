import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useHeaderHeight } from '@react-navigation/elements';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import {
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

import { DirectMessage, getMessages, sendMessage, startConversation } from '../api/messages';
import { resolveMediaUrl } from '../api/posts';
import { t } from '../i18n';
import { makeStyles, palette } from '../theme/theme';

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
  const listRef = useRef<FlatList<DirectMessage>>(null);

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

  const messages = useQuery({
    queryKey: ['messages', convId],
    queryFn: () => getMessages(convId as number),
    enabled: convId != null,
    refetchInterval: 4000,
  });

  const send = useMutation({
    mutationFn: () => sendMessage(convId as number, text.trim()),
    onSuccess: () => {
      setText('');
      queryClient.invalidateQueries({ queryKey: ['messages', convId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  const data = messages.data ?? [];
  const canSend = text.trim().length > 0 && convId != null && !send.isPending;

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
          ref={listRef}
          data={data}
          keyExtractor={(m) => String(m.id)}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
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
                <View
                  style={[
                    styles.bubble,
                    item.fromMe ? styles.bubbleMine : styles.bubbleTheirs,
                    grouped && (item.fromMe ? styles.groupedMine : styles.groupedTheirs),
                  ]}>
                  <Text style={item.fromMe ? styles.textMine : styles.textTheirs}>{item.content}</Text>
                </View>
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
          onPress={() => send.mutate()}
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
  bubbleRow: { flexDirection: 'row' },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },
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
