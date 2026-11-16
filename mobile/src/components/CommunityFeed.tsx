import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import { todayLocalDate } from '../api/checkins';
import type { FeedItem } from '../api/feed';
import { Post, resolveMediaUrl } from '../api/posts';
import { rankBarColorFor } from '../constants/belts';
import { submissionStyle } from '../constants/submissions';
import { t, tf } from '../i18n';
import { makeStyles, palette } from '../theme/theme';
import { renderRichText } from '../utils/richText';
import { postedAgo, trainingDayLabel } from '../utils/time';
import ActionButton from './ActionButton';
import Icon, { type IconName } from './Icon';
import { PostMenu, roleLabel } from './PostCard';
import PostMedia from './PostMedia';
import { FeedPhoto, durationLabel, sessionLabel, useFeedItemActions } from './TrainingCard';

/*
 * The home "Comunidade" feed: flat posts separated by hairlines (instead of the
 * cards used elsewhere), a red "Ver … →" link, and the actions row underneath.
 */

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export function Avatar({ name, url, size = 44 }: { name: string; url?: string | null; size?: number }) {
  const box = { width: size, height: size, borderRadius: size / 2 };
  return url ? (
    <Image source={{ uri: resolveMediaUrl(url) }} style={[styles.avatar, box]} />
  ) : (
    <View style={[styles.avatar, box]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.34 }]}>{initialsOf(name)}</Text>
    </View>
  );
}

function BeltBar({ colorHex, slug }: { colorHex: string; slug: string }) {
  return (
    <View style={[styles.beltBar, { backgroundColor: colorHex }]}>
      <View style={[styles.beltRank, { backgroundColor: rankBarColorFor(slug) }]} />
    </View>
  );
}

/** Red "Ver treino →" style link. */
export function ArrowLink({ label, onPress }: { label: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={6} accessibilityRole="link" style={styles.link}>
      <Text style={styles.linkText}>{label}</Text>
      <Icon name="arrow-right" size={18} color={palette.primary} />
    </Pressable>
  );
}

/** A public training session from the community feed. */
export function CheckInPost({
  item,
  onPressAuthor,
  onOpen,
}: {
  item: FeedItem;
  onPressAuthor: (userId: number) => void;
  onOpen: (item: FeedItem) => void;
}) {
  const { author } = item;
  const { like, onShare } = useFeedItemActions(item);
  const finishes = (item.submissions ?? []).filter((s) => s.direction === 'HIT');
  const when = item.date === todayLocalDate() ? postedAgo(item.createdAt) : trainingDayLabel(item.date);
  const duration = item.durationMinutes ? durationLabel(item.durationMinutes) : null;

  return (
    <View style={styles.post}>
      <Pressable style={styles.header} onPress={() => onPressAuthor(author.id)}>
        <Avatar name={author.displayName} url={author.avatarUrl} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>
            {author.displayName}
          </Text>
          <View style={styles.metaRow}>
            {author.belt && <BeltBar colorHex={author.belt.colorHex} slug={author.belt.slug} />}
            <Text style={styles.meta} numberOfLines={1}>
              {when}
            </Text>
          </View>
        </View>
      </Pressable>

      <Text style={styles.session}>
        {sessionLabel(item.sessionType)}
        {duration ? ` · ${duration}` : ''}
      </Text>
      {item.notes ? <Text style={styles.body}>{item.notes}</Text> : null}
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

      <ArrowLink label={t('community.viewTraining')} onPress={() => onOpen(item)} />

      <View style={styles.actions}>
        <ActionButton
          icon={item.likedByMe ? 'heart' : 'heart-outline'}
          count={item.likeCount}
          size={22}
          color={item.likedByMe ? palette.primary : palette.textSecondary}
          onPress={() => like.mutate()}
          accessibilityLabel={t('a11y.like')}
        />
        <ActionButton
          icon="comment-outline"
          count={item.commentCount}
          size={22}
          onPress={() => onOpen(item)}
          accessibilityLabel={t('a11y.comment')}
        />
        <View style={{ flex: 1 }} />
        {/* Sessions can be shared, not saved: the backend only bookmarks gym posts. */}
        <ActionButton icon="share-outline" size={22} onPress={onShare} accessibilityLabel={t('a11y.share')} />
      </View>
    </View>
  );
}

/** A post from the user's gym wall. Actions come from usePostActions. */
export function GymPost({
  post,
  canPin,
  canDelete,
  onOpen,
  onLike,
  onSave,
  onPinToggle,
  onDelete,
}: {
  post: Post;
  canPin: boolean;
  canDelete: boolean;
  onOpen: () => void;
  onLike: () => void;
  onSave: () => void;
  onPinToggle: () => void;
  onDelete: () => void;
}) {
  const role = roleLabel(post.author.role);
  return (
    <View style={styles.post}>
      <View style={styles.header}>
        <Avatar name={post.author.displayName} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>
            {post.author.displayName}
          </Text>
          <View style={styles.metaRow}>
            {post.pinned && <Icon name="pin" size={13} color={palette.primary} />}
            <Text style={styles.meta} numberOfLines={1}>
              {role.label} · {postedAgo(post.createdAt)}
            </Text>
          </View>
        </View>
        {(canPin || canDelete) && (
          <PostMenu
            pinned={post.pinned}
            canPin={canPin}
            canDelete={canDelete}
            onPinToggle={onPinToggle}
            onDelete={onDelete}
          />
        )}
      </View>

      <Pressable onPress={onOpen} style={{ gap: 12 }}>
        {post.content.length > 0 && <Text style={styles.body}>{renderRichText(post.content)}</Text>}
        <PostMedia media={post.media} />
      </Pressable>

      <View style={styles.actions}>
        <ActionButton
          icon={post.likedByMe ? 'heart' : 'heart-outline'}
          count={post.likeCount}
          size={22}
          color={post.likedByMe ? palette.primary : palette.textSecondary}
          onPress={onLike}
          accessibilityLabel={t('a11y.like')}
        />
        <ActionButton
          icon="comment-outline"
          count={post.commentCount}
          size={22}
          onPress={onOpen}
          accessibilityLabel={t('a11y.comment')}
        />
        <View style={{ flex: 1 }} />
        <ActionButton
          icon={post.savedByMe ? 'bookmark' : 'bookmark-outline'}
          size={22}
          color={post.savedByMe ? palette.primary : palette.textSecondary}
          onPress={onSave}
          accessibilityLabel={t('a11y.bookmark')}
        />
      </View>
    </View>
  );
}

/** One "Em destaque" card: label, title, detail line and a "Ver … →" link. */
export function HighlightCard({
  icon,
  title,
  detail,
  linkLabel,
  onPress,
}: {
  icon: IconName;
  title: string;
  detail?: string;
  linkLabel: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={({ pressed }) => [styles.highlight, pressed && { opacity: 0.85 }]} onPress={onPress}>
      <View style={styles.highlightLabelRow}>
        <Icon name={icon} size={22} color={palette.primary} />
        <Text style={styles.highlightLabel} numberOfLines={1}>
          {t('community.highlights.fromGym')}
        </Text>
      </View>
      <Text style={styles.highlightTitle} numberOfLines={2}>
        {title}
      </Text>
      {detail ? (
        <Text style={styles.highlightDetail} numberOfLines={1}>
          {detail}
        </Text>
      ) : null}
      <View style={{ flex: 1 }} />
      <ArrowLink label={linkLabel} onPress={onPress} />
    </Pressable>
  );
}

const styles = makeStyles(() => ({
  avatar: { backgroundColor: palette.surfaceVariant, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: palette.textPrimary, fontWeight: 'bold' },

  post: {
    gap: 12,
    paddingVertical: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.surfaceVariant,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { color: palette.textPrimary, fontWeight: 'bold', fontSize: 16 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 },
  meta: { color: palette.textSecondary, fontSize: 13, flexShrink: 1 },
  beltBar: {
    width: 34,
    height: 9,
    borderRadius: 2,
    overflow: 'hidden',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.3)',
  },
  beltRank: { width: 9, height: '100%' },
  session: { color: palette.textSecondary, fontSize: 13 },
  body: { color: palette.textPrimary, fontSize: 15, lineHeight: 21 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: palette.surfaceVariant,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  chipText: { color: palette.textPrimary, fontSize: 13, fontWeight: '600' },

  link: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  linkText: { color: palette.primary, fontSize: 14, fontWeight: '600' },

  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 28,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.surfaceVariant,
    paddingTop: 12,
  },

  highlight: {
    width: 270,
    minHeight: 150,
    backgroundColor: palette.surface,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.surfaceVariant,
    padding: 16,
    gap: 6,
  },
  highlightLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  highlightLabel: {
    color: palette.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    flexShrink: 1,
  },
  highlightTitle: { color: palette.textPrimary, fontSize: 17, fontWeight: 'bold' },
  highlightDetail: { color: palette.textSecondary, fontSize: 13, marginBottom: 6 },
}));
