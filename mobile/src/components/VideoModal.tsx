import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { makeStyles } from '../theme/theme';

/** Full-screen in-app player for a personal-library video (uploaded media URL). */
export default function VideoModal({ url, onClose }: { url: string; onClose: () => void }) {
  const player = useVideoPlayer(url, (p) => {
    p.loop = false;
    p.play();
  });

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.close} onPress={onClose} hitSlop={12}>
          <MaterialCommunityIcons name="close" size={28} color="#FFFFFF" />
        </Pressable>
        <VideoView player={player} style={styles.video} contentFit="contain" allowsFullscreen nativeControls />
      </View>
    </Modal>
  );
}

const styles = makeStyles(() => ({
  backdrop: { flex: 1, backgroundColor: '#000000EE', justifyContent: 'center' },
  close: { position: 'absolute', top: 48, right: 20, zIndex: 2 },
  video: { width: '100%', aspectRatio: 9 / 16, maxHeight: '80%', alignSelf: 'center' },
}));
