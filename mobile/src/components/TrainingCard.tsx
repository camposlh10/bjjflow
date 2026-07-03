import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Image, Pressable, Share, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import type { FeedItem, FeedPage } from '../api/feed';
import { shareFeedItem, toggleFeedLike } from '../api/feed';
import { resolveMediaUrl } from '../api/posts';
import ActionButton from './ActionButton';
import { rankBarColorFor } from '../constants/belts';
import { submissionStyle } from '../constants/submissions';
import { t, tf } from '../i18n';
import { makeStyles, palette } from '../theme/theme';
import { timeAgo } from '../utils/time';

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

function sessionLabel(type: string | null): string {
  switch (type) {
    case 'GI':
      return t('checkin.type.GI');
    case 'NOGI':
      return t('checkin.type.NOGI');
    case 'OPEN_MAT':
      return t('checkin.type.OPEN_MAT');
    default:
      return t('feed.session.default');
  }
}

function durationLabel(minutes: number | null): string {
  if (!minutes || minutes <= 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}

/** Sizes the training photo to its natural aspect ratio so the full image shows
 *  (no cropping) — the card grows taller for portrait shots and fills the width
 *  for landscape ones. */
function FeedPhoto({ url }: { url: string }) {
  const [ratio, setRatio] = useState(4 / 3);
  useEffect(() => {
    let active = true;
    Image.getSize(
      url,
      (w, h) => {
        if (active && w > 0 && h > 0) setRatio(w / h);
      },
      () => undefined,
    );
    return () => {
      active = false;
    };
  }, [url]);
  return <Image source={{ uri: url }} style={[styles.photo, { aspectRatio: ratio }]} resizeMode="cover" />;
}

export default function TrainingCard({
  item,
  onPressAuthor,
  onPressComment,
  showActions = true,
}: {
  item: FeedItem;
  onPressAuthor?: (userId: number) => void;
  onPressComment?: (item: FeedItem) => void;
  showActions?: boolean;
}) {
  const { author } = item;
  // Defensive: tolerate a feed item that arrives without a submissions array so one
  // malformed row can't crash the whole feed (the app-wide ErrorBoundary).
  const finishes = (item.submissions ?? []).filter((s) => s.direction === 'HIT');
  const openProfile = onPressAuthor && author ? () => onPressAuthor(author.id) : undefined;

  const queryClient = useQueryClient();
  // Patch just this item in the cached (paginated) feed instead of refetching the
  // whole list — refetching on every tap caused the press lag.
  const patch = (fn: (it: FeedItem) => FeedItem) =>
    queryClient.setQueryData<InfiniteData<FeedPage>>(['communityFeed'], (old) =>
      old
        ? {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.map((it) => (it.checkInId === item.checkInId ? fn(it) : it)),
            })),
          }
        : old,
    );

  const like = useMutation({
    mutationFn: () => toggleFeedLike(item.checkInId),
    onMutate: () => {
      const prev = queryClient.getQueryData<InfiniteData<FeedPage>>(['communityFeed']);
      patch((it) => ({ ...it, likedByMe: !it.likedByMe, likeCount: it.likeCount + (it.likedByMe ? -1 : 1) }));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['communityFeed'], ctx.prev);
    },
  });

  const onShare = async () => {
    try {
      const result = await Share.share({
        message: tf('feed.share.message', { name: author.displayName.split(' ')[0] }),
      });
      if (result.action !== Share.dismissedAction) {
        await shareFeedItem(item.checkInId);
        patch((it) => ({ ...it, shareCount: it.shareCount + 1 }));
      }
    } catch {
      // ignore
    }
  };

  return (
    <View style={styles.card}>
      {/* Author header — name + avatar open the profile */}
      <View style={styles.header}>
        <Pressable onPress={openProfile} hitSlop={4}>
          {author.avatarUrl ? (
            <Image source={{ uri: resolveMediaUrl(author.avatarUrl) }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarText}>{initialsOf(author.displayName)}</Text>
            </View>
          )}
        </Pressable>
        <Pressable style={{ flex: 1 }} onPress={openProfile}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {author.displayName}
            </Text>
            {author.pro && (
              <View style={styles.proPill}>
                <Text style={styles.proText}>PRO</Text>
              </View>
            )}
          </View>
          <View style={styles.metaRow}>
            {author.belt && (
              <View style={styles.beltMini}>
                <View
                  style={{
                    width: 34,
                    height: 9,
                    borderRadius: 2,
                    backgroundColor: author.belt.colorHex,
                    borderWidth: 0.5,
                    borderColor: 'rgba(0,0,0,0.3)',
                    overflow: 'hidden',
                    flexDirection: 'row',
                    justifyContent: 'flex-end',
                  }}>
                  <View style={{ width: 8, height: '100%', backgroundColor: rankBarColorFor(author.belt.slug) }} />
                </View>
              </View>
            )}
            <Text style={styles.meta} numberOfLines={1}>
              {author.username ? `@${author.username} · ` : ''}
              {timeAgo(item.createdAt)}
            </Text>
          </View>
        </Pressable>
        <MaterialCommunityIcons name="karate" size={22} color={palette.primary} />
      </View>

      {/* Title */}
      <Text style={styles.title}>{sessionLabel(item.sessionType)}</Text>

      {/* Strava-style stat columns */}
      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>{t('feed.stat.duration')}</Text>
          <Text style={styles.statValue}>{durationLabel(item.durationMinutes)}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statLabel}>{t('feed.stat.landed')}</Text>
          <Text style={styles.statValue}>{item.landed}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statLabel}>{t('feed.stat.conceded')}</Text>
          <Text style={styles.statValue}>{item.conceded}</Text>
        </View>
      </View>

      {item.notes ? <Text style={styles.notes}>{item.notes}</Text> : null}

      {item.photoUrl ? <FeedPhoto url={resolveMediaUrl(item.photoUrl)} /> : null}

      {finishes.length > 0 && (
        <View style={styles.chips}>
          {finishes.map((f, i) => {
            const st = submissionStyle(f.submission);
            return (
              <View key={i} style={styles.chip}>
                <View style={[styles.chipDot, { backgroundColor: st.color }]} />
                <Text style={styles.chipText}>
                  {st.label}
                  {f.count > 1 ? ` ${tf('feed.chip.times', { n: f.count })}` : ''}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {showActions && (
        <View style={styles.actions}>
          <ActionButton
            icon={item.likedByMe ? 'heart' : 'heart-outline'}
            count={item.likeCount}
            color={item.likedByMe ? palette.primary : palette.textSecondary}
            onPress={() => like.mutate()}
            accessibilityLabel={t('a11y.like')}
          />
          <ActionButton
            icon="comment-outline"
            count={item.commentCount}
            onPress={() => onPressComment?.(item)}
            accessibilityLabel={t('a11y.comment')}
          />
          <ActionButton icon="share-outline" count={item.shareCount} onPress={onShare} accessibilityLabel={t('a11y.share')} />
        </View>
      )}
    </View>
  );
}

const styles = makeStyles(() => ({
  card: { backgroundColor: palette.surface, borderRadius: 16, padding: 16, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 42, height: 42, borderRadius: 21 },
  avatarFallback: { backgroundColor: palette.surfaceVariant, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: palette.textPrimary, fontWeight: 'bold', fontSize: 14 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { color: palette.textPrimary, fontWeight: 'bold', fontSize: 15, flexShrink: 1 },
  proPill: { backgroundColor: palette.pro, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  proText: { color: '#1A1205', fontSize: 9, fontWeight: 'bold', letterSpacing: 0.5 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  beltMini: {},
  meta: { color: palette.textSecondary, fontSize: 11 },

  title: { color: palette.textPrimary, fontSize: 16, fontWeight: 'bold' },

  stats: { flexDirection: 'row', alignItems: 'center' },
  stat: { flex: 1 },
  statDivider: { width: StyleSheet.hairlineWidth, height: 30, backgroundColor: palette.surfaceVariant },
  statLabel: { color: palette.textSecondary, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue: { color: palette.textPrimary, fontSize: 18, fontWeight: 'bold', marginTop: 2 },

  notes: { color: '#E4E4E7', fontSize: 13, lineHeight: 18 },
  photo: { width: '100%', borderRadius: 12, backgroundColor: palette.surfaceVariant },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: palette.surfaceVariant,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  chipText: { color: palette.textPrimary, fontSize: 12, fontWeight: '600' },

  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.surfaceVariant,
    paddingTop: 12,
  },
}));
