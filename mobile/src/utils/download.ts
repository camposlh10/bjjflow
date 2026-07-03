import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { Alert } from 'react-native';

import { MediaItem, resolveMediaUrl } from '../api/posts';
import { t } from '../i18n';

/** Downloads a post's photos/videos into the device gallery. */
export async function downloadPostMedia(media: MediaItem[]): Promise<void> {
  if (!media || media.length === 0) {
    Alert.alert(t('mural.download.empty'));
    return;
  }
  const perm = await MediaLibrary.requestPermissionsAsync();
  if (!perm.granted) {
    Alert.alert(t('mural.download.permission'));
    return;
  }
  try {
    for (const m of media) {
      const url = resolveMediaUrl(m.url);
      const name = url.split('/').pop() || `bjjflow-${Date.now()}`;
      const dest = `${FileSystem.cacheDirectory}${name}`;
      const { uri } = await FileSystem.downloadAsync(url, dest);
      await MediaLibrary.saveToLibraryAsync(uri);
    }
    Alert.alert(t('mural.download.done'));
  } catch {
    Alert.alert(t('mural.download.error'));
  }
}
