import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { FlatList, Modal, Pressable, View } from 'react-native';
import { Text } from 'react-native-paper';

import { t, tf, TranslationKey } from '../i18n';
import { useIsOnline } from '../offline/network';
import { OutboxItem, discardItem, flushOutbox, retryItem, useOutbox } from '../offline/outbox';
import { makeStyles, palette } from '../theme/theme';

function labelOf(item: OutboxItem): string {
  if (item.kind === 'message') return t('offline.label.message');
  if (item.kind === 'checkin') return t('offline.label.checkin');
  return t(item.label as TranslationKey);
}

function isFailed(item: OutboxItem): boolean {
  return (item.kind === 'message' || item.kind === 'request') && !!item.failed;
}

/**
 * A small pill floating above the tab bar, shown only when there is something
 * to say: offline, changes waiting to sync, or changes the server refused.
 * Tapping it lists what's waiting.
 */
export default function SyncStatus() {
  const online = useIsOnline();
  const items = useOutbox((s) => s.items);
  const [open, setOpen] = useState(false);

  const failed = items.filter(isFailed);
  const pending = items.length - failed.length;

  let tone: 'offline' | 'syncing' | 'failed' | null = null;
  let text = '';
  if (failed.length > 0) {
    tone = 'failed';
    text = failed.length === 1 ? t('offline.pill.failed.one') : tf('offline.pill.failed.many', { n: failed.length });
  } else if (!online) {
    tone = 'offline';
    text =
      pending === 0
        ? t('offline.pill.offline')
        : pending === 1
          ? t('offline.pill.offlinePending.one')
          : tf('offline.pill.offlinePending.many', { n: pending });
  } else if (pending > 0) {
    tone = 'syncing';
    text = pending === 1 ? t('offline.pill.syncing.one') : tf('offline.pill.syncing.many', { n: pending });
  }

  return (
    <>
      {tone && (
        <Pressable
          style={[styles.pill, tone === 'failed' && styles.pillFailed]}
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          accessibilityLiveRegion="polite"
          accessibilityLabel={text}>
          <MaterialCommunityIcons
            name={tone === 'offline' ? 'cloud-off-outline' : tone === 'failed' ? 'alert-circle-outline' : 'cloud-sync-outline'}
            size={15}
            color={tone === 'failed' ? '#fff' : palette.textPrimary}
          />
          <Text style={[styles.pillText, tone === 'failed' && styles.pillTextFailed]} numberOfLines={1}>
            {text}
          </Text>
        </Pressable>
      )}

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel={t('a11y.close')} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>{t('offline.sync.title')}</Text>
          <Text style={styles.subtitle}>{online ? t('offline.sync.online') : t('offline.sync.offline')}</Text>
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            style={{ maxHeight: 360 }}
            ListEmptyComponent={<Text style={styles.empty}>{t('offline.sync.empty')}</Text>}
            renderItem={({ item }) => {
              const bad = isFailed(item);
              return (
                <View style={styles.row}>
                  <MaterialCommunityIcons
                    name={bad ? 'alert-circle-outline' : 'clock-outline'}
                    size={18}
                    color={bad ? palette.primary : palette.textSecondary}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{labelOf(item)}</Text>
                    <Text style={[styles.rowSub, bad && { color: palette.primary }]} numberOfLines={2}>
                      {bad
                        ? (item.kind === 'request' && item.error) || t('offline.sync.refused')
                        : t('offline.sync.waiting')}
                    </Text>
                  </View>
                  {bad && (
                    <View style={styles.rowActions}>
                      <Pressable onPress={() => discardItem(item.id)} hitSlop={8} accessibilityRole="button">
                        <Text style={styles.discard}>{t('offline.sync.discard')}</Text>
                      </Pressable>
                      <Pressable onPress={() => retryItem(item.id)} hitSlop={8} accessibilityRole="button">
                        <Text style={styles.retry}>{t('offline.sync.retry')}</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              );
            }}
          />
          {online && items.length > 0 && (
            <Pressable style={styles.syncNow} onPress={() => void flushOutbox()} accessibilityRole="button">
              <MaterialCommunityIcons name="sync" size={16} color={palette.primary} />
              <Text style={styles.syncNowText}>{t('offline.sync.now')}</Text>
            </Pressable>
          )}
        </View>
      </Modal>
    </>
  );
}

const styles = makeStyles(() => ({
  pill: {
    position: 'absolute',
    left: 12,
    bottom: '100%',
    marginBottom: 8,
    maxWidth: '62%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: palette.surfaceVariant,
    borderWidth: 1,
    borderColor: palette.outline,
  },
  pillFailed: { backgroundColor: palette.primary, borderColor: palette.primary },
  pillText: { color: palette.textPrimary, fontSize: 12, fontWeight: '600', flexShrink: 1 },
  pillTextFailed: { color: '#fff' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { backgroundColor: palette.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32 },
  handle: { width: 36, height: 4, borderRadius: 999, backgroundColor: palette.outline, alignSelf: 'center', marginBottom: 12 },
  title: { color: palette.textPrimary, fontSize: 16, fontWeight: 'bold', textAlign: 'center' },
  subtitle: { color: palette.textSecondary, fontSize: 13, textAlign: 'center', marginTop: 4, marginBottom: 12 },
  empty: { color: palette.textSecondary, fontSize: 13, textAlign: 'center', paddingVertical: 20 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: palette.surfaceVariant,
  },
  rowTitle: { color: palette.textPrimary, fontSize: 14, fontWeight: '600' },
  rowSub: { color: palette.textSecondary, fontSize: 12, marginTop: 2 },
  rowActions: { flexDirection: 'row', gap: 14 },
  discard: { color: palette.textSecondary, fontSize: 13, fontWeight: '600' },
  retry: { color: palette.primary, fontSize: 13, fontWeight: '700' },
  syncNow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 14, minHeight: 44 },
  syncNowText: { color: palette.primary, fontSize: 14, fontWeight: '700' },
}));
