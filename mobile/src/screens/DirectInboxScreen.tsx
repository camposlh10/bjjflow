import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Text } from 'react-native-paper';

import { Conversation, getConversations } from '../api/messages';
import { resolveMediaUrl } from '../api/posts';
import { TrainingCardSkeleton } from '../components/Skeleton';
import { t } from '../i18n';
import { makeStyles, palette } from '../theme/theme';
import { timeAgo } from '../utils/time';

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export default function DirectInboxScreen() {
  const navigation = useNavigation<any>();
  const convs = useQuery({ queryKey: ['conversations'], queryFn: getConversations });
  const [query, setQuery] = useState('');

  useFocusEffect(
    useCallback(() => {
      convs.refetch();
    }, []), // eslint-disable-line react-hooks/exhaustive-deps
  );

  const items = useMemo(() => {
    const all = Array.isArray(convs.data) ? convs.data : [];
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (c) =>
        c.other.displayName.toLowerCase().includes(q) || (c.other.username ?? '').toLowerCase().includes(q),
    );
  }, [convs.data, query]);

  const renderRow = (c: Conversation) => {
    const name = c.other.displayName;
    const unread = c.unread > 0;
    const preview = c.lastMessage
      ? (c.lastFromMe ? `${t('dm.you')}: ${c.lastMessage}` : c.lastMessage)
      : t('dm.empty.preview');
    return (
      <Pressable
        style={styles.row}
        android_ripple={{ color: palette.surfaceVariant }}
        onPress={() =>
          navigation.navigate('Conversation', {
            conversationId: c.id,
            title: name,
            username: c.other.username,
            avatarUrl: c.other.avatarUrl,
          })
        }>
        {c.other.avatarUrl ? (
          <Image source={{ uri: resolveMediaUrl(c.other.avatarUrl) }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarText}>{initialsOf(name)}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          <View style={styles.previewLine}>
            <Text style={[styles.preview, unread && styles.unreadText]} numberOfLines={1}>
              {preview}
            </Text>
            {c.lastMessageAt && (
              <Text style={styles.time} numberOfLines={1}>
                {'  ·  '}
                {timeAgo(c.lastMessageAt)}
              </Text>
            )}
          </View>
        </View>
        {unread && <View style={styles.dot} />}
      </Pressable>
    );
  };

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={items}
      keyExtractor={(c) => String(c.id)}
      renderItem={({ item }) => renderRow(item)}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View style={styles.searchWrap}>
          <MaterialCommunityIcons name="magnify" size={18} color={palette.textSecondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('dm.search')}
            placeholderTextColor={palette.textSecondary}
            style={styles.searchInput}
            autoCapitalize="none"
          />
        </View>
      }
      ListEmptyComponent={
        convs.isLoading ? (
          <View style={{ padding: 16, gap: 12 }}>
            <TrainingCardSkeleton />
          </View>
        ) : (
          <View style={styles.empty}>
            <MaterialCommunityIcons name="message-text-outline" size={44} color={palette.surfaceVariant} />
            <Text style={styles.emptyTitle}>{t('dm.empty.title')}</Text>
            <Text style={styles.emptySub}>{t('dm.empty.sub')}</Text>
          </View>
        )
      }
    />
  );
}

const styles = makeStyles(() => ({
  container: { flex: 1, backgroundColor: palette.background },
  content: { flexGrow: 1, paddingTop: 8 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: palette.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 38,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  searchInput: { flex: 1, color: palette.textPrimary, fontSize: 14, padding: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 9 },
  avatar: { width: 58, height: 58, borderRadius: 29 },
  avatarFallback: { backgroundColor: palette.surfaceVariant, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: palette.textPrimary, fontWeight: 'bold', fontSize: 17 },
  name: { color: palette.textPrimary, fontSize: 15, fontWeight: '600' },
  previewLine: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  preview: { color: palette.textSecondary, fontSize: 13, flexShrink: 1 },
  time: { color: palette.textSecondary, fontSize: 13 },
  unreadText: { color: palette.textPrimary, fontWeight: '600' },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: palette.primary, marginLeft: 8 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: 80 },
  emptyTitle: { color: palette.textPrimary, fontWeight: 'bold', fontSize: 15 },
  emptySub: { color: palette.textSecondary, fontSize: 13, textAlign: 'center', paddingHorizontal: 40 },
}));
