import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useHeaderHeight } from '@react-navigation/elements';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
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
import {
  Gym,
  MedalInput,
  MedalTier,
  addGymPhoto,
  deleteGymPhoto,
  getMyGym,
  toggleGymVerified,
  updateGym,
  updateGymMedals,
} from '../../api/gyms';
import { resolveMediaUrl, uploadMedia } from '../../api/posts';
import MedalVisual from '../../components/MedalVisual';
import { COMPETITIONS } from '../../constants/competitions';
import { t } from '../../i18n';
import { GymStackParamList } from '../../navigation/GymNavigator';
import { makeStyles, palette } from '../../theme/theme';

type Nav = NativeStackNavigationProp<GymStackParamList>;

const TIERS: { key: MedalTier; color: string }[] = [
  { key: 'GOLD', color: '#F5C518' },
  { key: 'SILVER', color: '#C7CED6' },
  { key: 'BRONZE', color: '#CD7F32' },
];

type MedalEntry = { count: number; tier: MedalTier };

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

async function pickAndUpload(): Promise<{ key: string; uri: string } | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert(t('mural.media.permission'));
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    quality: 0.7,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  const uploaded = await uploadMedia({
    uri: asset.uri,
    name: asset.fileName ?? 'foto.jpg',
    type: asset.mimeType ?? 'image/jpeg',
  });
  return { key: uploaded.key, uri: asset.uri };
}

export default function EditGymScreen({ navigation }: { navigation: { goBack: () => void } }) {
  const gym = useQuery({ queryKey: ['myGym'], queryFn: getMyGym });

  if (gym.isLoading || !gym.data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }
  return <EditForm gym={gym.data} goBack={navigation.goBack} />;
}

function EditForm({ gym, goBack }: { gym: Gym; goBack: () => void }) {
  const queryClient = useQueryClient();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<Nav>();

  const [name, setName] = useState(gym.name);
  const [city, setCity] = useState(gym.city ?? '');
  const [address, setAddress] = useState(gym.address ?? '');
  const [phone, setPhone] = useState(gym.phone ?? '');
  const [email, setEmail] = useState(gym.email ?? '');
  const [website, setWebsite] = useState(gym.website ?? '');
  const [bio, setBio] = useState(gym.description ?? '');
  const [instagram, setInstagram] = useState(gym.instagram ?? '');
  const [facebook, setFacebook] = useState(gym.facebook ?? '');
  const [whatsapp, setWhatsapp] = useState(gym.whatsapp ?? '');
  const [youtube, setYoutube] = useState(gym.youtube ?? '');
  // Medals keyed by catalog label, e.g. { IBJJF: { count: 3, tier: 'GOLD' } }.
  const [medalMap, setMedalMap] = useState<Record<string, MedalEntry>>(() => {
    const map: Record<string, MedalEntry> = {};
    gym.medals.forEach((m) => {
      map[m.competition] = { count: m.count, tier: m.tier };
    });
    return map;
  });
  const [logo, setLogo] = useState<{ key?: string; uri: string } | null>(
    gym.logoUrl ? { uri: resolveMediaUrl(gym.logoUrl) } : null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['myGym'] });

  const save = useMutation({
    mutationFn: async () => {
      await updateGym({
        name: name.trim(),
        city: city.trim() || undefined,
        address: address.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        website: website.trim() || undefined,
        description: bio.trim() || undefined,
        logoKey: logo?.key,
        instagram: instagram.trim() || undefined,
        facebook: facebook.trim() || undefined,
        whatsapp: whatsapp.trim() || undefined,
        youtube: youtube.trim() || undefined,
      });
      const medals: MedalInput[] = Object.entries(medalMap)
        .filter(([, e]) => e.count > 0)
        .map(([competition, e]) => ({ competition, tier: e.tier, count: e.count }));
      await updateGymMedals(medals);
    },
    onSuccess: () => {
      invalidate();
      Alert.alert(t('gymProfile.edit.saved'));
      goBack();
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  const entryFor = (label: string): MedalEntry => medalMap[label] ?? { count: 0, tier: 'GOLD' };
  const setCount = (label: string, count: number) =>
    setMedalMap((prev) => ({ ...prev, [label]: { tier: prev[label]?.tier ?? 'GOLD', count: Math.max(0, count) } }));
  const setTier = (label: string, tier: MedalTier) =>
    setMedalMap((prev) => ({ ...prev, [label]: { count: prev[label]?.count ?? 0, tier } }));

  const toggleVerified = useMutation({
    mutationFn: toggleGymVerified,
    onSuccess: invalidate,
  });

  const addPhoto = useMutation({
    mutationFn: async () => {
      const picked = await pickAndUpload();
      if (picked) {
        await addGymPhoto(picked.key);
      }
    },
    onSuccess: invalidate,
    onError: (e) => setError(apiErrorMessage(e)),
  });

  const removePhoto = useMutation({
    mutationFn: (photoId: number) => deleteGymPhoto(photoId),
    onSuccess: invalidate,
  });

  const pickLogo = async () => {
    setBusy(true);
    setError(null);
    try {
      const picked = await pickAndUpload();
      if (picked) setLogo(picked);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={headerHeight}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.logoRow}>
          <Pressable style={styles.logoPicker} onPress={pickLogo} disabled={busy}>
            {logo ? (
              <Image source={{ uri: logo.uri }} style={styles.logoImage} resizeMode="cover" />
            ) : (
              <View style={[styles.logoImage, styles.logoFallback]}>
                <Text style={styles.logoText}>{initialsOf(name || gym.name)}</Text>
              </View>
            )}
            <View style={styles.logoBadge}>
              {busy ? (
                <ActivityIndicator size={12} color="#fff" />
              ) : (
                <MaterialCommunityIcons name="camera" size={13} color="#fff" />
              )}
            </View>
          </Pressable>
          <Text style={styles.logoHint}>{t('gymProfile.edit.logo')}</Text>
        </View>

        <TextInput mode="outlined" label={t('gymProfile.edit.name')} value={name} onChangeText={setName} style={styles.input} />
        <TextInput mode="outlined" label={t('gymProfile.edit.city')} value={city} onChangeText={setCity} style={styles.input} />
        <TextInput mode="outlined" label={t('gymProfile.edit.address')} value={address} onChangeText={setAddress} style={styles.input} />
        <TextInput mode="outlined" label={t('gymProfile.edit.phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" style={styles.input} />
        <TextInput mode="outlined" label={t('gymProfile.edit.email')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" style={styles.input} />
        <TextInput mode="outlined" label={t('gymProfile.edit.website')} value={website} onChangeText={setWebsite} autoCapitalize="none" style={styles.input} />
        <TextInput mode="outlined" label={t('gymProfile.edit.bio')} value={bio} onChangeText={setBio} multiline numberOfLines={3} style={styles.input} />

        <View style={styles.verifiedRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>{t('gymProfile.edit.verified')}</Text>
            <Text style={styles.verifiedStatus}>
              {gym.verification ? t(`verify.status.${gym.verification.status}`) : t('verify.status.none')}
            </Text>
          </View>
          <Button
            mode="outlined"
            compact
            loading={toggleVerified.isPending}
            disabled={toggleVerified.isPending}
            onPress={() => toggleVerified.mutate()}>
            {t('gymProfile.edit.verified.toggle')}
          </Button>
        </View>
        <Button
          mode="contained"
          icon="shield-check"
          onPress={() => navigation.navigate('GymVerification')}
          style={styles.verifyBtn}
          contentStyle={styles.verifyContent}>
          {gym.verification ? t('verify.resend') : t('verify.cta')}
        </Button>

        <Text style={styles.sectionTitle}>{t('gymProfile.edit.social')}</Text>
        <TextInput mode="outlined" label={t('gymProfile.edit.instagram')} value={instagram} onChangeText={setInstagram} autoCapitalize="none" style={styles.input} />
        <TextInput mode="outlined" label={t('gymProfile.edit.facebook')} value={facebook} onChangeText={setFacebook} autoCapitalize="none" style={styles.input} />
        <TextInput mode="outlined" label={t('gymProfile.edit.whatsapp')} value={whatsapp} onChangeText={setWhatsapp} keyboardType="phone-pad" style={styles.input} />
        <TextInput mode="outlined" label={t('gymProfile.edit.youtube')} value={youtube} onChangeText={setYoutube} autoCapitalize="none" style={styles.input} />

        <Text style={styles.sectionTitle}>{t('gymProfile.edit.medals')}</Text>
        <Text style={styles.medalsHint}>{t('gymProfile.edit.medals.hint')}</Text>
        <View style={styles.medalGrid}>
          {COMPETITIONS.map((comp) => {
            const entry = entryFor(comp.label);
            const active = entry.count > 0;
            return (
              <View key={comp.key} style={[styles.medalCard, active && styles.medalCardActive]}>
                <MedalVisual competition={comp.label} tier={entry.tier} count={entry.count} size={50} />
                <Text style={styles.medalCardLabel} numberOfLines={1}>
                  {comp.label}
                </Text>
                <View style={styles.counter}>
                  <Pressable
                    onPress={() => setCount(comp.label, entry.count - 1)}
                    hitSlop={6}
                    style={styles.counterBtn}>
                    <MaterialCommunityIcons name="minus" size={15} color={palette.textPrimary} />
                  </Pressable>
                  <Text style={styles.counterValue}>{entry.count}</Text>
                  <Pressable
                    onPress={() => setCount(comp.label, entry.count + 1)}
                    hitSlop={6}
                    style={styles.counterBtn}>
                    <MaterialCommunityIcons name="plus" size={15} color={palette.textPrimary} />
                  </Pressable>
                </View>
                {active && (
                  <View style={styles.tierDots}>
                    {TIERS.map((tier) => (
                      <Pressable
                        key={tier.key}
                        onPress={() => setTier(comp.label, tier.key)}
                        hitSlop={6}
                        style={[
                          styles.tierDot,
                          { backgroundColor: tier.color },
                          entry.tier === tier.key && styles.tierDotOn,
                        ]}
                      />
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>{t('gymProfile.photos')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.gallery}>
          {gym.photos.map((p) => (
            <View key={p.id} style={styles.photoWrap}>
              <Image source={{ uri: resolveMediaUrl(p.url) }} style={styles.photo} resizeMode="cover" />
              <Pressable style={styles.photoX} onPress={() => removePhoto.mutate(p.id)} hitSlop={6}>
                <MaterialCommunityIcons name="close" size={12} color="#fff" />
              </Pressable>
            </View>
          ))}
          <Pressable
            style={styles.addPhoto}
            onPress={() => addPhoto.mutate()}
            disabled={addPhoto.isPending}>
            {addPhoto.isPending ? (
              <ActivityIndicator size="small" color={palette.primary} />
            ) : (
              <>
                <MaterialCommunityIcons name="plus" size={22} color={palette.primary} />
                <Text style={styles.addPhotoText}>{t('gymProfile.edit.addPhoto')}</Text>
              </>
            )}
          </Pressable>
        </ScrollView>

        {error && <Text style={styles.error}>{error}</Text>}

        <Button
          mode="contained"
          onPress={() => save.mutate()}
          disabled={name.trim().length === 0 || save.isPending || busy}
          loading={save.isPending}
          contentStyle={styles.saveContent}
          style={styles.save}>
          {t('gymProfile.edit.save')}
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = makeStyles(() => ({
  container: { flex: 1, backgroundColor: palette.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.background },
  content: { padding: 20, paddingBottom: 40 },
  logoRow: { alignItems: 'center', marginBottom: 16 },
  logoPicker: { position: 'relative' },
  logoImage: { width: 76, height: 76, borderRadius: 20 },
  logoFallback: { backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: '#fff', fontWeight: 'bold', fontSize: 24 },
  logoBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: palette.background,
  },
  logoHint: { color: palette.textSecondary, fontSize: 11, marginTop: 8 },
  input: { marginBottom: 12 },
  sectionTitle: { color: palette.textPrimary, fontSize: 13, fontWeight: 'bold', marginTop: 4, marginBottom: 10 },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: palette.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  verifiedStatus: { color: palette.textSecondary, fontSize: 12, marginTop: -6 },
  verifyBtn: { marginTop: -4, marginBottom: 16 },
  verifyContent: { paddingVertical: 4 },
  medalsHint: { color: palette.textSecondary, fontSize: 12, marginTop: -6, marginBottom: 12, lineHeight: 17 },
  medalGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12, marginBottom: 16 },
  medalCard: {
    width: '48%',
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  medalCardActive: { borderColor: palette.outline },
  medalCardLabel: { color: palette.textPrimary, fontSize: 13, fontWeight: 'bold', marginTop: 6, marginBottom: 8 },
  counter: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  counterBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: palette.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterValue: { color: palette.textPrimary, fontSize: 15, fontWeight: 'bold', minWidth: 18, textAlign: 'center' },
  tierDots: { flexDirection: 'row', gap: 10, marginTop: 10 },
  tierDot: { width: 16, height: 16, borderRadius: 8, opacity: 0.4 },
  tierDotOn: { opacity: 1, borderWidth: 2, borderColor: palette.textPrimary },
  gallery: { marginBottom: 16 },
  photoWrap: { marginRight: 8 },
  photo: { width: 110, height: 80, borderRadius: 10, backgroundColor: palette.surfaceVariant },
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
    width: 110,
    height: 80,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: palette.outline,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  addPhotoText: { color: palette.textSecondary, fontSize: 10 },
  error: { color: palette.primary, marginBottom: 10 },
  save: { marginTop: 4 },
  saveContent: { paddingVertical: 6 },
}));
