import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useHeaderHeight } from '@react-navigation/elements';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import { Gym, VerificationStatus, getMyGym, submitGymVerification } from '../../api/gyms';
import { uploadMedia } from '../../api/posts';
import { t, tf } from '../../i18n';
import { makeStyles, palette } from '../../theme/theme';

type Pic = { key: string; uri: string };

const STATUS_STYLE: Record<VerificationStatus, { color: string; icon: 'clock-outline' | 'check-decagram' | 'close-circle-outline' }> = {
  PENDING: { color: '#F59E0B', icon: 'clock-outline' },
  NEEDS_REVIEW: { color: '#F59E0B', icon: 'clock-outline' },
  APPROVED: { color: '#22C55E', icon: 'check-decagram' },
  REJECTED: { color: palette.primary, icon: 'close-circle-outline' },
};

function formatCnpj(digits: string): string {
  const d = digits.replace(/\D/g, '').slice(0, 14);
  let out = d.slice(0, 2);
  if (d.length > 2) out += '.' + d.slice(2, 5);
  if (d.length > 5) out += '.' + d.slice(5, 8);
  if (d.length > 8) out += '/' + d.slice(8, 12);
  if (d.length > 12) out += '-' + d.slice(12, 14);
  return out;
}

async function pickAndUpload(): Promise<Pic | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert(t('mural.media.permission'));
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
  if (result.canceled) return null;
  const asset = result.assets[0];
  const uploaded = await uploadMedia({
    uri: asset.uri,
    name: asset.fileName ?? 'doc.jpg',
    type: asset.mimeType ?? 'image/jpeg',
  });
  return { key: uploaded.key, uri: asset.uri };
}

export default function GymVerificationScreen({ navigation }: { navigation: { goBack: () => void } }) {
  const gym = useQuery({ queryKey: ['myGym'], queryFn: getMyGym });
  if (gym.isLoading || !gym.data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }
  return <Form gym={gym.data} goBack={navigation.goBack} />;
}

function Form({ gym, goBack }: { gym: Gym; goBack: () => void }) {
  const queryClient = useQueryClient();
  const headerHeight = useHeaderHeight();
  const [cnpj, setCnpj] = useState(gym.verification?.cnpj.replace(/\D/g, '') ?? '');
  const [cert, setCert] = useState<Pic | null>(null);
  const [establishment, setEstablishment] = useState<Pic[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useMutation({
    mutationFn: () =>
      submitGymVerification({
        cnpj: formatCnpj(cnpj),
        certificateKey: cert!.key,
        establishmentKeys: establishment.map((e) => e.key),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myGym'] });
      Alert.alert(t('verify.submitted'));
      goBack();
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  const pick = async (setter: (p: Pic) => void) => {
    setBusy(true);
    setError(null);
    try {
      const picked = await pickAndUpload();
      if (picked) setter(picked);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const validate = (): boolean => {
    if (cnpj.replace(/\D/g, '').length !== 14) return setError(t('verify.error.cnpj')), false;
    if (!cert) return setError(t('verify.error.cert')), false;
    if (establishment.length === 0) return setError(t('verify.error.establishment')), false;
    setError(null);
    return true;
  };

  const status = gym.verification?.status;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={headerHeight}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {status && (
          <View style={[styles.statusBanner, { borderColor: STATUS_STYLE[status].color }]}>
            <MaterialCommunityIcons name={STATUS_STYLE[status].icon} size={18} color={STATUS_STYLE[status].color} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.statusText, { color: STATUS_STYLE[status].color }]}>
                {t(`verify.status.${status}`)}
              </Text>
              {gym.verification?.reviewNotes ? (
                <Text style={styles.statusNotes}>{gym.verification.reviewNotes}</Text>
              ) : null}
            </View>
          </View>
        )}

        <Text style={styles.intro}>{t('verify.intro')}</Text>

        <Text style={styles.label}>{t('verify.cnpj')}</Text>
        <TextInput
          mode="outlined"
          value={formatCnpj(cnpj)}
          onChangeText={(v) => setCnpj(v.replace(/\D/g, '').slice(0, 14))}
          placeholder={t('verify.cnpj.placeholder')}
          keyboardType="number-pad"
          style={styles.input}
        />

        <Text style={styles.label}>{t('verify.certificate')}</Text>
        <Pressable style={styles.certBox} onPress={() => pick(setCert)} disabled={busy}>
          {cert ? (
            <Image source={{ uri: cert.uri }} style={styles.certImage} resizeMode="cover" />
          ) : (
            <View style={styles.certPlaceholder}>
              <MaterialCommunityIcons name="certificate-outline" size={28} color={palette.textSecondary} />
              <Text style={styles.uploadText}>{t('verify.certificate.add')}</Text>
            </View>
          )}
        </Pressable>

        <Text style={styles.label}>{t('verify.establishment')}</Text>
        <View style={styles.photoGrid}>
          {establishment.map((p, i) => (
            <View key={p.key} style={styles.photoWrap}>
              <Image source={{ uri: p.uri }} style={styles.photo} resizeMode="cover" />
              <Pressable
                style={styles.photoX}
                hitSlop={6}
                onPress={() => setEstablishment((prev) => prev.filter((_, idx) => idx !== i))}>
                <MaterialCommunityIcons name="close" size={12} color="#fff" />
              </Pressable>
            </View>
          ))}
          <Pressable
            style={styles.addPhoto}
            disabled={busy}
            onPress={() => pick((p) => setEstablishment((prev) => [...prev, p]))}>
            {busy ? (
              <ActivityIndicator size="small" color={palette.primary} />
            ) : (
              <>
                <MaterialCommunityIcons name="plus" size={22} color={palette.primary} />
                <Text style={styles.uploadText}>{t('verify.establishment.add')}</Text>
              </>
            )}
          </Pressable>
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        <Button
          mode="contained"
          icon="shield-check"
          loading={submit.isPending}
          disabled={submit.isPending || busy}
          onPress={() => {
            if (validate()) submit.mutate();
          }}
          contentStyle={styles.submitContent}
          style={styles.submit}>
          {t('verify.submit')}
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = makeStyles(() => ({
  container: { flex: 1, backgroundColor: palette.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.background },
  content: { padding: 20, paddingBottom: 40 },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  statusText: { fontSize: 14, fontWeight: 'bold' },
  statusNotes: { color: palette.textSecondary, fontSize: 12, marginTop: 2 },
  intro: { color: palette.textSecondary, fontSize: 13, lineHeight: 19, marginBottom: 20 },
  label: { color: palette.textPrimary, fontSize: 13, fontWeight: 'bold', marginBottom: 8 },
  input: { marginBottom: 18 },
  certBox: {
    height: 160,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: palette.outline,
    overflow: 'hidden',
    marginBottom: 18,
  },
  certImage: { width: '100%', height: '100%' },
  certPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  uploadText: { color: palette.textSecondary, fontSize: 11 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  photoWrap: { position: 'relative' },
  photo: { width: 96, height: 96, borderRadius: 10, backgroundColor: palette.surfaceVariant },
  photoX: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhoto: {
    width: 96,
    height: 96,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: palette.outline,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  error: { color: palette.primary, marginBottom: 12 },
  submit: { marginTop: 4 },
  submitContent: { paddingVertical: 6 },
}));
