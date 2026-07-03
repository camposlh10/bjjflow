import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useHeaderHeight } from '@react-navigation/elements';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useLayoutEffect, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ActivityIndicator } from 'react-native-paper';

import { apiErrorMessage } from '../../api/auth';
import { UploadedMedia, createPost, uploadMedia } from '../../api/posts';
import { t } from '../../i18n';
import { makeStyles, palette } from '../../theme/theme';
import { renderRichText } from '../../utils/richText';

type Picked = UploadedMedia & { uri: string };

export default function CreatePostScreen({ navigation }: { navigation: any }) {
  const queryClient = useQueryClient();
  const headerHeight = useHeaderHeight();
  const [content, setContent] = useState('');
  const [media, setMedia] = useState<Picked[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useMutation({
    mutationFn: () =>
      createPost(
        content.trim(),
        media.map((m) => ({ key: m.key, type: m.type })),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gymFeed'] });
      navigation.goBack();
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  const canPost = (content.trim().length > 0 || media.length > 0) && !uploading && !submit.isPending;

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={() => canPost && submit.mutate()}
          disabled={!canPost}
          style={[styles.postBtn, !canPost && styles.postBtnOff]}>
          <Text style={styles.postBtnText}>{t('mural.compose.submit')}</Text>
        </Pressable>
      ),
    });
  }, [navigation, canPost]);

  const pick = async (kind: 'image' | 'video') => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t('mural.media.permission'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: kind === 'image' ? ['images'] : ['videos'],
      // built-in move & scale editor (iOS constrains images to a square frame)
      allowsEditing: true,
      quality: 0.7,
      videoMaxDuration: 60,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setUploading(true);
    setError(null);
    try {
      const uploaded = await uploadMedia({
        uri: asset.uri,
        name: asset.fileName ?? `media.${kind === 'image' ? 'jpg' : 'mp4'}`,
        type: asset.mimeType ?? (kind === 'image' ? 'image/jpeg' : 'video/mp4'),
      });
      setMedia((m) => [...m, { ...uploaded, uri: asset.uri }]);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setUploading(false);
    }
  };

  const removeAt = (i: number) => setMedia((m) => m.filter((_, idx) => idx !== i));

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={headerHeight}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <TextInput
          onChangeText={setContent}
          placeholder={t('mural.compose.placeholder')}
          placeholderTextColor={palette.textSecondary}
          multiline
          autoFocus
          style={styles.input}>
          {content.length > 0 ? <Text style={styles.inputText}>{renderRichText(content)}</Text> : null}
        </TextInput>

        {media.length > 0 && (
          <View style={styles.thumbs}>
            {media.map((m, i) => (
              <View key={i} style={styles.thumb}>
                <Image source={{ uri: m.uri }} style={styles.thumbImg} />
                {m.type === 'VIDEO' && (
                  <MaterialCommunityIcons
                    name="play-circle"
                    size={26}
                    color="#fff"
                    style={styles.thumbPlay}
                  />
                )}
                <Pressable style={styles.thumbX} onPress={() => removeAt(i)} hitSlop={6}>
                  <MaterialCommunityIcons name="close" size={13} color="#fff" />
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {error && <Text style={styles.error}>{error}</Text>}
      </ScrollView>

      <View style={styles.toolbar}>
        <Pressable onPress={() => pick('image')} hitSlop={8}>
          <MaterialCommunityIcons name="image-outline" size={24} color={palette.primary} />
        </Pressable>
        <Pressable onPress={() => pick('video')} hitSlop={8}>
          <MaterialCommunityIcons name="video-outline" size={24} color={palette.primary} />
        </Pressable>
        {uploading && <ActivityIndicator size="small" color={palette.primary} />}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = makeStyles(() => ({
  container: { flex: 1, backgroundColor: palette.background },
  scroll: { padding: 16 },
  input: { color: palette.textPrimary, fontSize: 16, lineHeight: 22, minHeight: 120, textAlignVertical: 'top' },
  inputText: { color: palette.textPrimary, fontSize: 16, lineHeight: 22 },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  thumb: {
    width: 92,
    height: 92,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: palette.surfaceVariant,
  },
  thumbImg: { width: '100%', height: '100%' },
  thumbPlay: { position: 'absolute', top: 33, left: 33 },
  thumbX: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: { color: palette.primary, marginTop: 12 },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    marginHorizontal: 12,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: palette.surface,
    borderRadius: 16,
  },
  postBtn: { backgroundColor: palette.primary, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 6 },
  postBtnOff: { opacity: 0.5 },
  postBtnText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
}));
