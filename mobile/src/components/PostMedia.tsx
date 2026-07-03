import { useVideoPlayer, VideoView } from 'expo-video';
import { Image, StyleSheet, View } from 'react-native';

import { MediaItem, resolveMediaUrl } from '../api/posts';
import { makeStyles, palette } from '../theme/theme';

function PostVideo({ uri, style }: { uri: string; style: object }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
  });
  return <VideoView player={player} style={style} nativeControls contentFit="cover" />;
}

export default function PostMedia({ media }: { media: MediaItem[] }) {
  if (!media || media.length === 0) return null;
  const items = media.map((m) => ({ ...m, uri: resolveMediaUrl(m.url) }));

  if (items.length === 1) {
    const m = items[0];
    return (
      <View style={styles.single}>
        {m.type === 'VIDEO' ? (
          <PostVideo uri={m.uri} style={styles.singleMedia} />
        ) : (
          <Image source={{ uri: m.uri }} style={styles.singleMedia} resizeMode="cover" />
        )}
      </View>
    );
  }

  return (
    <View style={styles.grid}>
      {items.map((m, i) => (
        <View key={i} style={styles.gridItem}>
          {m.type === 'VIDEO' ? (
            <PostVideo uri={m.uri} style={styles.gridMedia} />
          ) : (
            <Image source={{ uri: m.uri }} style={styles.gridMedia} resizeMode="cover" />
          )}
        </View>
      ))}
    </View>
  );
}

const styles = makeStyles(() => ({
  single: { borderRadius: 12, overflow: 'hidden', marginTop: 2 },
  singleMedia: { width: '100%', height: 200, backgroundColor: palette.surfaceVariant },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 2 },
  gridItem: {
    width: '49%',
    height: 120,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: palette.surfaceVariant,
  },
  gridMedia: { width: '100%', height: '100%' },
}));
