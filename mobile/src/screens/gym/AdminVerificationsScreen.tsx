import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Text, TextInput } from 'react-native-paper';

import { apiErrorMessage } from '../../api/auth';
import { VerificationAdminItem, decideVerification, getVerificationQueue } from '../../api/gyms';
import { resolveMediaUrl } from '../../api/posts';
import ImageLightbox from '../../components/ImageLightbox';
import { t, tf } from '../../i18n';
import { makeStyles, palette } from '../../theme/theme';

type LightboxState = { urls: string[]; index: number } | null;

export default function AdminVerificationsScreen() {
  const queryClient = useQueryClient();
  const queue = useQuery({ queryKey: ['verificationQueue'], queryFn: getVerificationQueue });
  const [lightbox, setLightbox] = useState<LightboxState>(null);

  if (queue.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (queue.isError) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>{apiErrorMessage(queue.error)}</Text>
      </View>
    );
  }

  const items = queue.data ?? [];

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {items.length === 0 ? (
          <Text style={styles.empty}>{t('admin.verifications.empty')}</Text>
        ) : (
          items.map((item) => (
            <Card
              key={item.id}
              item={item}
              onOpen={(urls, index) => setLightbox({ urls, index })}
              onDone={() => queryClient.invalidateQueries({ queryKey: ['verificationQueue'] })}
            />
          ))
        )}
      </ScrollView>
      <ImageLightbox
        urls={lightbox?.urls ?? []}
        index={lightbox?.index ?? null}
        onClose={() => setLightbox(null)}
      />
    </>
  );
}

function Card({
  item,
  onOpen,
  onDone,
}: {
  item: VerificationAdminItem;
  onOpen: (urls: string[], index: number) => void;
  onDone: () => void;
}) {
  const [notes, setNotes] = useState('');
  const urls = [item.certificateUrl, ...item.establishmentUrls].filter(Boolean) as string[];

  const decide = useMutation({
    mutationFn: (approve: boolean) => decideVerification(item.id, approve, notes.trim() || undefined),
    onSuccess: () => {
      Alert.alert(t('admin.verifications.done'));
      onDone();
    },
    onError: (e) => Alert.alert(apiErrorMessage(e)),
  });

  return (
    <View style={styles.card}>
      <Text style={styles.gymName}>{item.gymName}</Text>
      <Text style={styles.cnpj}>{tf('admin.verifications.cnpj', { cnpj: item.cnpj })}</Text>

      {item.aiSummary ? <Text style={styles.ai}>“{item.aiSummary}”</Text> : null}
      {item.aiConfidence != null ? (
        <Text style={styles.confidence}>
          {tf('admin.verifications.confidence', { pct: Math.round(item.aiConfidence * 100) })}
        </Text>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbs}>
        {item.certificateUrl ? (
          <Pressable onPress={() => onOpen(urls, 0)}>
            <Image source={{ uri: resolveMediaUrl(item.certificateUrl) }} style={styles.certThumb} resizeMode="cover" />
            <Text style={styles.thumbLabel}>{t('admin.verifications.certificate')}</Text>
          </Pressable>
        ) : null}
        {item.establishmentUrls.map((url, i) => (
          <Pressable key={url} onPress={() => onOpen(urls, (item.certificateUrl ? 1 : 0) + i)}>
            <Image source={{ uri: resolveMediaUrl(url) }} style={styles.estThumb} resizeMode="cover" />
          </Pressable>
        ))}
      </ScrollView>

      <TextInput
        mode="outlined"
        dense
        value={notes}
        onChangeText={setNotes}
        placeholder={t('admin.verifications.notes')}
        style={styles.notes}
      />

      <View style={styles.actions}>
        <Button
          mode="outlined"
          textColor={palette.primary}
          style={styles.rejectBtn}
          disabled={decide.isPending}
          onPress={() => decide.mutate(false)}>
          {t('admin.verifications.reject')}
        </Button>
        <Button
          mode="contained"
          buttonColor="#22C55E"
          style={styles.approveBtn}
          loading={decide.isPending}
          disabled={decide.isPending}
          onPress={() => decide.mutate(true)}>
          {t('admin.verifications.approve')}
        </Button>
      </View>
    </View>
  );
}

const styles = makeStyles(() => ({
  container: { flex: 1, backgroundColor: palette.background },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.background, padding: 24 },
  muted: { color: palette.textSecondary, textAlign: 'center' },
  empty: { color: palette.textSecondary, textAlign: 'center', marginTop: 40, fontSize: 14 },
  card: { backgroundColor: palette.surface, borderRadius: 16, padding: 16, marginBottom: 14 },
  gymName: { color: palette.textPrimary, fontSize: 16, fontWeight: 'bold' },
  cnpj: { color: palette.textSecondary, fontSize: 12, marginTop: 2 },
  ai: { color: '#E4E4E7', fontSize: 13, fontStyle: 'italic', marginTop: 10, lineHeight: 18 },
  confidence: { color: palette.textSecondary, fontSize: 11, marginTop: 4 },
  thumbs: { marginTop: 12, marginBottom: 4 },
  certThumb: {
    width: 130,
    height: 100,
    borderRadius: 10,
    backgroundColor: palette.surfaceVariant,
    marginRight: 8,
  },
  estThumb: {
    width: 100,
    height: 100,
    borderRadius: 10,
    backgroundColor: palette.surfaceVariant,
    marginRight: 8,
  },
  thumbLabel: { color: palette.textSecondary, fontSize: 10, marginTop: 3 },
  notes: { marginTop: 12, backgroundColor: palette.surface },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  rejectBtn: { flex: 1, borderColor: palette.primary },
  approveBtn: { flex: 1 },
}));
