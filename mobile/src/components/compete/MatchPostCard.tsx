import { Pressable, View } from 'react-native';
import { Text } from 'react-native-paper';

import { MatchPost, perspective } from '../../api/compete';
import { t, tf } from '../../i18n';
import { useAuthStore } from '../../store/authStore';
import { makeStyles, palette } from '../../theme/theme';
import { postedAgo } from '../../utils/time';
import { Avatar } from '../CommunityFeed';
import Icon from '../Icon';
import { RoundStrip, Scoreboard, firstName } from './MatchParts';

/**
 * A finished match in the Comunidade feed: who posted it (or reposted it), the
 * score from the winner's side, the rounds, and a Repost button.
 */
export default function MatchPostCard({
  post,
  onOpen,
  onPressAuthor,
  onRepost,
}: {
  post: MatchPost;
  onOpen: () => void;
  onPressAuthor: (userId: number) => void;
  onRepost: () => void;
}) {
  const m = post.match;
  // Seen from the winner's side by everyone, so the card reads the same in every feed.
  const side = perspective({ ...m, myRole: null });
  const myUserId = useAuthStore((s) => s.user?.id);
  const poster = post.repostOf ?? post.author;
  const postedByMe = poster.id === myUserId;
  const shareLabel = postedByMe ? t('compete.posted') : post.sharedByMe ? t('compete.reposted') : t('compete.repost');
  const headline =
    side.result === 'DRAW'
      ? t('compete.result.draw')
      : tf('compete.result.someoneWon', { name: firstName(side.me) });

  return (
    <View style={styles.card}>
      {post.repostOf && (
        <View style={styles.repostLine}>
          <Icon name="repeat" size={14} color={palette.textSecondary} />
          <Text style={styles.repostText}>{tf('compete.repostedBy', { name: post.author.displayName })}</Text>
        </View>
      )}
      <Pressable style={styles.head} onPress={() => onPressAuthor(poster.id)} accessibilityRole="button">
        <Avatar name={poster.displayName} url={poster.avatarUrl} size={40} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>
            {poster.displayName}
          </Text>
          <Text style={styles.meta}>
            {t('compete.match.title')} · {postedAgo(post.createdAt)}
          </Text>
        </View>
        <Icon name="karate" size={18} color={palette.primary} />
      </Pressable>
      {post.caption ? <Text style={styles.caption}>{post.caption}</Text> : null}

      <Pressable style={styles.result} onPress={onOpen} accessibilityRole="button">
        <Text style={styles.headline}>{headline}</Text>
        <Scoreboard side={side} size={48} animate={false} />
        <RoundStrip side={side} current={null} />
      </Pressable>

      <View style={styles.actions}>
        <Pressable
          onPress={onRepost}
          disabled={post.sharedByMe}
          hitSlop={6}
          style={styles.action}
          accessibilityRole="button"
          accessibilityState={{ selected: post.sharedByMe }}>
          <Icon name="repeat" size={20} color={post.sharedByMe ? palette.primary : palette.textSecondary} />
          <Text style={[styles.actionText, post.sharedByMe && { color: palette.primary }]}>
            {shareLabel}
            {post.repostCount > 0 ? ` · ${post.repostCount}` : ''}
          </Text>
        </Pressable>
        <Pressable onPress={onOpen} hitSlop={6} style={styles.action} accessibilityRole="link">
          <Text style={styles.open}>{t('compete.profile.open')}</Text>
          <Icon name="arrow-right" size={16} color={palette.primary} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = makeStyles(() => ({
  card: { backgroundColor: palette.surface, borderRadius: 18, padding: 14, marginTop: 12, gap: 10 },
  repostLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  repostText: { color: palette.textSecondary, fontSize: 12, fontWeight: '600' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { color: palette.textPrimary, fontSize: 15, fontWeight: 'bold' },
  meta: { color: palette.textSecondary, fontSize: 12, marginTop: 1 },
  caption: { color: palette.textPrimary, fontSize: 14, lineHeight: 20 },
  result: { backgroundColor: palette.background, borderRadius: 14, padding: 12, gap: 8 },
  headline: { color: palette.textPrimary, fontSize: 15, fontWeight: 'bold', textAlign: 'center' },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText: { color: palette.textSecondary, fontSize: 13, fontWeight: '600' },
  open: { color: palette.primary, fontSize: 13, fontWeight: '600' },
}));
