import { MaterialCommunityIcons } from '@expo/vector-icons';
import { memo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { IconButton, Menu, Text } from 'react-native-paper';

import { Post } from '../api/posts';
import { GymRole } from '../api/gyms';
import { rankBarColorFor } from '../constants/belts';
import { t } from '../i18n';
import { makeStyles, palette } from '../theme/theme';
import { renderRichText } from '../utils/richText';
import { formatShortDateTime } from '../utils/time';
import ActionButton from './ActionButton';
import BeltVisual from './BeltVisual';
import PostMedia from './PostMedia';

type Props = {
  post: Post;
  myUserId?: number;
  isOwner: boolean;
  isStaff: boolean;
  onLike: () => void;
  onComment: () => void;
  onShare: () => void;
  onSave: () => void;
  onDownload: () => void;
  onPinToggle: () => void;
  onDelete: () => void;
  onOpen: () => void;
};

function roleLabel(role: GymRole): { label: string; staff: boolean } {
  if (role === 'OWNER') return { label: t('gym.role.OWNER'), staff: true };
  if (role === 'INSTRUCTOR') return { label: t('gym.role.INSTRUCTOR'), staff: true };
  return { label: t('gym.role.MEMBER'), staff: false };
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

function PostCard({
  post,
  myUserId,
  isOwner,
  isStaff,
  onLike,
  onComment,
  onShare,
  onSave,
  onDownload,
  onPinToggle,
  onDelete,
  onOpen,
}: Props) {
  const [menuVisible, setMenuVisible] = useState(false);
  const role = roleLabel(post.author.role);
  const isAuthor = post.author.userId === myUserId;
  const canPin = isStaff;
  const canDelete = isAuthor || isOwner;
  const showMenu = canPin || canDelete;

  return (
    <View style={[styles.card, post.pinned && styles.cardPinned]}>
      {post.pinned && (
        <View style={styles.pinnedRow}>
          <MaterialCommunityIcons name="pin" size={13} color={palette.primary} />
          <Text style={styles.pinnedText}>{t('mural.pinned')}</Text>
        </View>
      )}

      <View style={styles.headerRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initialsOf(post.author.displayName)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>
            {post.author.displayName}
            <Text style={role.staff ? styles.roleStaff : styles.roleMember}> · {role.label}</Text>
          </Text>
          <View style={styles.subRow}>
            {post.author.belt && (
              <View style={styles.beltMini}>
                <BeltVisual
                  color={post.author.belt.colorHex}
                  rankBarColor={rankBarColorFor(post.author.belt.slug)}
                  stripes={post.author.belt.stripes}
                  height={7}
                />
              </View>
            )}
            <Text style={styles.timeText}>{formatShortDateTime(post.createdAt)}</Text>
          </View>
        </View>
        {showMenu && (
          <Menu
            visible={menuVisible}
            onDismiss={() => setMenuVisible(false)}
            anchor={
              <IconButton
                icon="dots-horizontal"
                size={18}
                iconColor={palette.textSecondary}
                onPress={() => setMenuVisible(true)}
                accessibilityLabel={t('a11y.more')}
              />
            }>
            {canPin && (
              <Menu.Item
                onPress={() => {
                  setMenuVisible(false);
                  onPinToggle();
                }}
                title={post.pinned ? t('mural.unpin') : t('mural.pin')}
                leadingIcon={post.pinned ? 'pin-off' : 'pin'}
              />
            )}
            {canDelete && (
              <Menu.Item
                onPress={() => {
                  setMenuVisible(false);
                  onDelete();
                }}
                title={t('mural.delete')}
                leadingIcon="trash-can-outline"
              />
            )}
          </Menu>
        )}
      </View>

      <Pressable onPress={onOpen}>
        {post.content.length > 0 && (
          <Text style={styles.content}>{renderRichText(post.content)}</Text>
        )}
        <PostMedia media={post.media} />
      </Pressable>

      <View style={styles.actions}>
        <ActionButton
          icon={post.likedByMe ? 'heart' : 'heart-outline'}
          count={post.likeCount}
          color={post.likedByMe ? palette.primary : palette.textSecondary}
          onPress={onLike}
          accessibilityLabel={t('a11y.like')}
        />
        <ActionButton icon="comment-outline" count={post.commentCount} onPress={onComment} accessibilityLabel={t('a11y.comment')} />
        <ActionButton icon="share-outline" count={post.shareCount} onPress={onShare} accessibilityLabel={t('a11y.share')} />
        <ActionButton icon="tray-arrow-down" onPress={onDownload} accessibilityLabel={t('a11y.download')} />
        <ActionButton
          icon={post.savedByMe ? 'bookmark' : 'bookmark-outline'}
          color={post.savedByMe ? palette.primary : palette.textSecondary}
          onPress={onSave}
          accessibilityLabel={t('a11y.bookmark')}
        />
      </View>
    </View>
  );
}

// memo: re-renders only when the post data or the viewer's permissions change,
// not when sibling list state (refresh spinner, other posts) updates
export default memo(
  PostCard,
  (prev, next) =>
    prev.post === next.post &&
    prev.myUserId === next.myUserId &&
    prev.isOwner === next.isOwner &&
    prev.isStaff === next.isStaff,
);

const styles = makeStyles(() => ({
  card: { backgroundColor: palette.surface, borderRadius: 14, padding: 12, marginBottom: 10 },
  cardPinned: { borderWidth: 1, borderColor: palette.primary },
  pinnedRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  pinnedText: { color: palette.primary, fontSize: 10, fontWeight: 'bold' },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: palette.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: palette.textPrimary, fontWeight: 'bold', fontSize: 10 },
  name: { color: palette.textPrimary, fontSize: 12, fontWeight: 'bold' },
  roleStaff: { color: palette.primary, fontSize: 10, fontWeight: 'normal' },
  roleMember: { color: palette.textSecondary, fontSize: 10, fontWeight: 'normal' },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  beltMini: { width: 34 },
  timeText: { color: palette.textSecondary, fontSize: 10 },
  content: { color: '#E4E4E7', fontSize: 13, lineHeight: 19, marginBottom: 10 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingRight: 4 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionText: { color: palette.textSecondary, fontSize: 11 },
}));
