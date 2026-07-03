import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useHeaderHeight } from '@react-navigation/elements';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { ActivityIndicator, Button, Text, TextInput } from 'react-native-paper';

import { apiErrorMessage } from '../../api/auth';
import { createProduct } from '../../api/market';
import { uploadMedia } from '../../api/posts';
import { t } from '../../i18n';
import { makeStyles, palette } from '../../theme/theme';

/** "450", "450,00", "1.250,50" → cents */
function parsePriceToCents(value: string): number | null {
  const normalized = value.trim().replace(/\./g, '').replace(',', '.');
  const parsed = Number(normalized);
  if (Number.isNaN(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100);
}

export default function CreateProductScreen({ navigation }: { navigation: { goBack: () => void } }) {
  const queryClient = useQueryClient();
  const headerHeight = useHeaderHeight();

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [link, setLink] = useState('');
  const [image, setImage] = useState<{ key: string; uri: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const priceCents = parsePriceToCents(price);
  const valid = name.trim().length > 0 && priceCents !== null && price.trim().length > 0;

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t('mural.media.permission'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.7,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setUploading(true);
    setError(null);
    try {
      const uploaded = await uploadMedia({
        uri: asset.uri,
        name: asset.fileName ?? 'produto.jpg',
        type: asset.mimeType ?? 'image/jpeg',
      });
      setImage({ key: uploaded.key, uri: asset.uri });
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setUploading(false);
    }
  };

  const save = useMutation({
    mutationFn: () =>
      createProduct({
        name: name.trim(),
        priceCents: priceCents!,
        description: description.trim() || undefined,
        link: link.trim() || undefined,
        imageKey: image?.key,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gymProducts'] });
      navigation.goBack();
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={headerHeight}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable style={styles.imagePicker} onPress={pickImage}>
          {image ? (
            <Image source={{ uri: image.uri }} style={styles.imagePreview} resizeMode="cover" />
          ) : uploading ? (
            <ActivityIndicator />
          ) : (
            <>
              <MaterialCommunityIcons name="camera-plus" size={28} color={palette.primary} />
              <Text style={styles.imageHint}>{t('market.create.photo')}</Text>
            </>
          )}
        </Pressable>

        <TextInput
          mode="outlined"
          label={t('market.create.name')}
          value={name}
          onChangeText={setName}
          style={styles.input}
        />
        <TextInput
          mode="outlined"
          label={t('market.create.price')}
          value={price}
          onChangeText={(v) => setPrice(v.replace(/[^0-9.,]/g, ''))}
          keyboardType="decimal-pad"
          style={styles.input}
        />
        <TextInput
          mode="outlined"
          label={t('market.create.description')}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
          style={styles.input}
        />
        <TextInput
          mode="outlined"
          label={t('market.create.link')}
          value={link}
          onChangeText={setLink}
          autoCapitalize="none"
          style={styles.input}
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <Button
          mode="contained"
          onPress={() => save.mutate()}
          disabled={!valid || uploading || save.isPending}
          loading={save.isPending}
          contentStyle={styles.saveContent}
          style={styles.save}>
          {t('market.create.submit')}
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = makeStyles(() => ({
  container: { flex: 1, backgroundColor: palette.background },
  content: { padding: 20, paddingBottom: 40 },
  imagePicker: {
    height: 140,
    borderRadius: 14,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 16,
    overflow: 'hidden',
  },
  imagePreview: { width: '100%', height: '100%' },
  imageHint: { color: palette.textSecondary, fontSize: 12 },
  input: { marginBottom: 12 },
  error: { color: palette.primary, marginBottom: 10 },
  save: { marginTop: 4 },
  saveContent: { paddingVertical: 6 },
}));
