import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useHeaderHeight } from '@react-navigation/elements';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';

import { uploadMedia } from '../api/posts';
import {
  createPersonalTechnique,
  deletePersonalTechnique,
  updatePersonalTechnique,
  type PersonalTechniqueInput,
} from '../api/techniques';
import { t } from '../i18n';
import type { HomeStackParamList } from '../navigation/HomeNavigator';
import { makeStyles, palette } from '../theme/theme';

const LIBRARY_COLORS = ['#E63946', '#E0A82E', '#2DB6A3', '#3E63DD', '#8E4EC6', '#F76808', '#4A9EED', '#16A34A'];

export default function PersonalTechniqueEditorScreen() {
  const route = useRoute<RouteProp<HomeStackParamList, 'PersonalTechniqueEditor'>>();
  const navigation = useNavigation();
  const headerHeight = useHeaderHeight();
  const qc = useQueryClient();
  const existing = route.params?.technique;

  const [name, setName] = useState(existing?.name ?? '');
  const [category, setCategory] = useState(existing?.category ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [videoUrl, setVideoUrl] = useState(existing?.videoUrl ?? '');
  const [color, setColor] = useState<string | null>(existing?.color ?? null);
  const [mediaKey, setMediaKey] = useState<string | null>(existing?.mediaKey ?? null);
  const [uploading, setUploading] = useState(false);

  const done = () => {
    qc.invalidateQueries({ queryKey: ['personalTechniques'] });
    navigation.goBack();
  };

  const save = useMutation({
    mutationFn: (body: PersonalTechniqueInput) =>
      existing ? updatePersonalTechnique(existing.id, body) : createPersonalTechnique(body),
    onSuccess: done,
  });

  const remove = useMutation({
    mutationFn: () => deletePersonalTechnique(existing!.id),
    onSuccess: done,
  });

  const pickVideo = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], quality: 0.8 });
    if (res.canceled || !res.assets[0]) return;
    const asset = res.assets[0];
    setUploading(true);
    try {
      const up = await uploadMedia({
        uri: asset.uri,
        name: asset.fileName ?? 'tecnica.mp4',
        type: asset.mimeType ?? 'video/mp4',
      });
      setMediaKey(up.key);
    } catch {
      Alert.alert(t('techniques.uploadFail'));
    } finally {
      setUploading(false);
    }
  };

  const confirmDelete = () =>
    Alert.alert(t('techniques.delete.confirm'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('techniques.delete'), style: 'destructive', onPress: () => remove.mutate() },
    ]);

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={headerHeight}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive">
      <Field label={t('techniques.field.name')} value={name} onChange={setName} />
      <Field label={t('techniques.field.category')} value={category} onChange={setCategory} />

      <Text style={styles.label}>{t('techniques.field.color')}</Text>
      <View style={styles.swatches}>
        {LIBRARY_COLORS.map((c) => (
          <Pressable
            key={c}
            onPress={() => setColor(color === c ? null : c)}
            style={[styles.swatch, { backgroundColor: c }, color === c && styles.swatchActive]}>
            {color === c && <MaterialCommunityIcons name="check" size={16} color="#FFFFFF" />}
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>{t('techniques.field.video')}</Text>
      {mediaKey ? (
        <View style={styles.videoRow}>
          <MaterialCommunityIcons name="check-circle" size={20} color="#16A34A" />
          <Text style={styles.videoText}>{t('techniques.videoAdded')}</Text>
          <Pressable onPress={() => setMediaKey(null)} hitSlop={8}>
            <Text style={styles.removeVideo}>{t('techniques.removeVideo')}</Text>
          </Pressable>
        </View>
      ) : (
        <Button mode="outlined" icon="video-plus" loading={uploading} onPress={pickVideo} style={styles.importBtn}>
          {t('techniques.importVideo')}
        </Button>
      )}
      <Text style={styles.or}>{t('techniques.or')}</Text>
      <Field label={t('techniques.field.videoUrl')} value={videoUrl} onChange={setVideoUrl} keyboard="url" />

      <Field label={t('techniques.field.notes')} value={notes} onChange={setNotes} multiline />

      <Button
        mode="contained"
        style={styles.save}
        loading={save.isPending}
        disabled={!name.trim() || save.isPending || uploading}
        onPress={() =>
          save.mutate({
            name: name.trim(),
            category: category.trim() || null,
            notes: notes.trim() || null,
            videoUrl: videoUrl.trim() || null,
            color,
            mediaKey,
          })
        }>
        {t('techniques.save')}
      </Button>

      {existing && (
        <Button mode="text" textColor={palette.primary} onPress={confirmDelete} style={{ marginTop: 4 }}>
          {t('techniques.delete')}
        </Button>
      )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  value,
  onChange,
  multiline,
  keyboard,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  keyboard?: 'url';
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        mode="outlined"
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        autoCapitalize={keyboard === 'url' ? 'none' : 'sentences'}
        keyboardType={keyboard === 'url' ? 'url' : 'default'}
        style={[styles.input, multiline && { minHeight: 90 }]}
      />
    </View>
  );
}

const styles = makeStyles(() => ({
  screen: { flex: 1, backgroundColor: palette.background },
  body: { padding: 16 },
  label: { color: palette.textSecondary, fontSize: 12, marginBottom: 6 },
  input: { backgroundColor: palette.surface },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  swatch: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  swatchActive: { borderWidth: 2, borderColor: palette.textPrimary },
  videoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  videoText: { color: palette.textPrimary, flex: 1 },
  removeVideo: { color: palette.primary, fontWeight: '600', fontSize: 13 },
  importBtn: { borderRadius: 12, borderColor: palette.outline, marginBottom: 6 },
  or: { color: palette.textSecondary, fontSize: 12, textAlign: 'center', marginVertical: 6 },
  save: { marginTop: 8, borderRadius: 12 },
}));
