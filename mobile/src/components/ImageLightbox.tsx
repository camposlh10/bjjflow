import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRef } from 'react';
import { Dimensions, Image, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { resolveMediaUrl } from '../api/posts';
import { makeStyles } from '../theme/theme';

const SCREEN_WIDTH = Dimensions.get('window').width;

/** Full-screen swipeable image viewer. `index` null = closed. `urls` are raw media urls. */
export default function ImageLightbox({
  urls,
  index,
  onClose,
}: {
  urls: string[];
  index: number | null;
  onClose: () => void;
}) {
  const scrollRef = useRef<ScrollView>(null);
  if (index === null || urls.length === 0) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.close} onPress={onClose} hitSlop={10}>
          <MaterialCommunityIcons name="close" size={28} color="#fff" />
        </Pressable>
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          contentOffset={{ x: index * SCREEN_WIDTH, y: 0 }}
          onLayout={() => scrollRef.current?.scrollTo({ x: index * SCREEN_WIDTH, animated: false })}>
          {urls.map((url, i) => (
            <Pressable key={`${url}-${i}`} style={styles.page} onPress={onClose}>
              <Image source={{ uri: resolveMediaUrl(url) }} style={styles.image} resizeMode="contain" />
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = makeStyles(() => ({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.94)', justifyContent: 'center' },
  close: { position: 'absolute', top: 48, right: 20, zIndex: 2, padding: 4 },
  page: { width: SCREEN_WIDTH, alignItems: 'center', justifyContent: 'center' },
  image: { width: SCREEN_WIDTH, height: '80%' },
}));
