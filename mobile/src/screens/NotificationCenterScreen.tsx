import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';

import {
  NotificationItem,
  NotificationType,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  refreshInsights,
} from '../api/notifications';
import { t, type TranslationKey } from '../i18n';
import type { ComunidadeStackParamList } from '../navigation/ComunidadeNavigator';
import { makeStyles, palette } from '../theme/theme';

type Nav = NativeStackNavigationProp<ComunidadeStackParamList>;

const CAT: Record<NotificationType, { icon: string; color: string; key: TranslationKey }> = {
  SOCIAL: { icon: 'account-heart', color: '#E63946', key: 'notif.cat.SOCIAL' },
  PERFORMANCE: { icon: 'chart-line', color: '#2DB6A3', key: 'notif.cat.PERFORMANCE' },
  TRAINING: { icon: 'fire', color: '#F76808', key: 'notif.cat.TRAINING' },
  ACADEMY: { icon: 'town-hall', color: '#8E4EC6', key: 'notif.cat.ACADEMY' },
  COMPETITION: { icon: 'trophy', color: '#E0A82E', key: 'notif.cat.COMPETITION' },
  MESSAGE: { icon: 'message-text', color: '#3E63DD', key: 'notif.cat.MESSAGE' },
  SYSTEM: { icon: 'information', color: '#9CA3AF', key: 'notif.cat.SYSTEM' },
};
const CAT_ORDER: NotificationType[] = ['SOCIAL', 'PERFORMANCE', 'TRAINING', 'ACADEMY', 'COMPETITION', 'MESSAGE', 'SYSTEM'];

function timeAgo(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function NotificationCenterScreen() {
  const navigation = useNavigation<Nav>();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<NotificationType | null>(null);
  const { data, isLoading, refetch } = useQuery({ queryKey: ['notifications'], queryFn: () => getNotifications() });

  // Generate fresh data-driven insights on open (idempotent per day on the backend).
  useEffect(() => {
    refreshInsights()
      .then(() => qc.invalidateQueries({ queryKey: ['notifications'] }))
      .catch(() => undefined);
  }, [qc]);

  const read = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const readAll = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const open = (n: NotificationItem) => {
    if (!n.read) read.mutate(n.id);
    const p = n.payload ?? '';
    if (p.startsWith('conversation:')) navigation.navigate('Conversation', { conversationId: Number(p.split(':')[1]) });
    else if (p.startsWith('user:')) navigation.navigate('UserProfile', { userId: Number(p.split(':')[1]) });
    else if (p.startsWith('insight:')) navigation.navigate('Submissions', {});
  };

  if (isLoading && !data) {
    return <ActivityIndicator style={{ marginTop: 48 }} color={palette.primary} />;
  }

  // Defensive: a failed request or an unexpected response shape must never crash
  // the screen (the app-wide ErrorBoundary would blank everything) or spin forever
  // — show a retry state instead of a black screen.
  if (!data || !Array.isArray(data.items)) {
    return (
      <View style={styles.errorWrap}>
        <MaterialCommunityIcons name="cloud-off-outline" size={44} color={palette.surfaceVariant} />
        <Text style={styles.errorTitle}>{t('notifications.error')}</Text>
        <Pressable style={styles.retryBtn} onPress={() => refetch()}>
          <MaterialCommunityIcons name="refresh" size={16} color={palette.primary} />
          <Text style={styles.retryText}>{t('common.retry')}</Text>
        </Pressable>
      </View>
    );
  }

  const unread = data.unread ?? 0;
  const present = CAT_ORDER.filter((c) => data.items.some((n) => n.type === c));
  const items = filter ? data.items.filter((n) => n.type === filter) : data.items;

  return (
    <View style={styles.screen}>
      <View style={styles.topRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          <Tab label={t('notif.cat.all')} active={filter === null} onPress={() => setFilter(null)} />
          {present.map((c) => (
            <Tab key={c} label={t(CAT[c].key)} color={CAT[c].color} active={filter === c} onPress={() => setFilter(filter === c ? null : c)} />
          ))}
        </ScrollView>
      </View>
      {unread > 0 && (
        <Pressable style={styles.markAll} onPress={() => readAll.mutate()}>
          <MaterialCommunityIcons name="check-all" size={16} color={palette.primary} />
          <Text style={styles.markAllText}>{t('notifications.markAll')}</Text>
        </Pressable>
      )}
      <FlatList
        data={items}
        keyExtractor={(n) => String(n.id)}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>{t('notifications.empty')}</Text>}
        renderItem={({ item }) => {
          const cat = CAT[item.type] ?? CAT.SYSTEM;
          return (
            <Pressable style={[styles.row, !item.read && styles.rowUnread]} onPress={() => open(item)}>
              <View style={[styles.iconWrap, { backgroundColor: cat.color + '22' }]}>
                <MaterialCommunityIcons name={cat.icon as never} size={20} color={cat.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{item.title}</Text>
                {!!item.body && (
                  <Text style={styles.rowBody} numberOfLines={2}>
                    {item.body}
                  </Text>
                )}
                <Text style={styles.rowTime}>{timeAgo(item.createdAt)}</Text>
              </View>
              {!item.read && <View style={[styles.dot, { backgroundColor: cat.color }]} />}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

function Tab({ label, active, onPress, color }: { label: string; active: boolean; onPress: () => void; color?: string }) {
  const c = color ?? palette.primary;
  return (
    <Pressable onPress={onPress} style={[styles.tab, active && { backgroundColor: c + '26', borderColor: c }]}>
      <Text style={[styles.tabText, active && { color: c }]}>{label}</Text>
    </Pressable>
  );
}

const styles = makeStyles(() => ({
  screen: { flex: 1, backgroundColor: palette.background },
  topRow: { paddingTop: 8 },
  tabs: { gap: 8, paddingHorizontal: 16, paddingVertical: 6 },
  tab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18, borderWidth: 1, borderColor: palette.outline, backgroundColor: palette.surface },
  tabText: { color: palette.textSecondary, fontSize: 13, fontWeight: '600' },
  markAll: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-end', paddingHorizontal: 16, paddingVertical: 8 },
  markAllText: { color: palette.primary, fontWeight: '600', fontSize: 13 },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: palette.surface, borderRadius: 12, padding: 14, marginBottom: 10 },
  rowUnread: { backgroundColor: palette.surfaceVariant },
  iconWrap: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { color: palette.textPrimary, fontWeight: '700', fontSize: 15 },
  rowBody: { color: palette.textSecondary, fontSize: 13, marginTop: 2, lineHeight: 18 },
  rowTime: { color: palette.textSecondary, fontSize: 11, marginTop: 4 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  empty: { color: palette.textSecondary, textAlign: 'center', marginTop: 60 },
  errorWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  errorTitle: { color: palette.textSecondary, fontSize: 14, textAlign: 'center' },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: palette.surface,
  },
  retryText: { color: palette.primary, fontWeight: '700', fontSize: 13 },
}));
