import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useHeaderHeight } from '@react-navigation/elements';
import { useNavigation } from '@react-navigation/native';
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

import { apiErrorMessage } from '../api/auth';
import { MedalInput, MedalTier } from '../api/gyms';
import { resolveMediaUrl, uploadMedia } from '../api/posts';
import {
  ProfilePhoto,
  UserProfile,
  addMyPhoto,
  completeProfile,
  deleteMyPhoto,
  getUserProfile,
  togglePro,
  updateMyMedals,
  updateMyProfile,
} from '../api/users';
import LocationFields from '../components/LocationFields';
import MedalVisual from '../components/MedalVisual';
import { ADULT_BELTS, KIDS_BELTS, maxStripesFor } from '../constants/belts';
import { COMPETITIONS } from '../constants/competitions';
import { countryCodeByName, countryName } from '../constants/locations';
import { t } from '../i18n';
import { useAuthStore } from '../store/authStore';
import { makeStyles, palette } from '../theme/theme';

const TIERS: { key: MedalTier; color: string }[] = [
  { key: 'GOLD', color: '#F5C518' },
  { key: 'SILVER', color: '#C7CED6' },
  { key: 'BRONZE', color: '#CD7F32' },
];

const ACCENT_COLORS = ['#E63946', '#2563EB', '#16A34A', '#7C3AED', '#F59E0B', '#06B6D4'];
const ALL_BELTS = [...ADULT_BELTS, ...KIDS_BELTS];

type MedalEntry = { count: number; tier: MedalTier };
type Pic = { key?: string; uri: string };

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

async function pickAndUpload(): Promise<Pic | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert(t('mural.media.permission'));
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.7 });
  if (result.canceled) return null;
  const asset = result.assets[0];
  const uploaded = await uploadMedia({
    uri: asset.uri,
    name: asset.fileName ?? 'foto.jpg',
    type: asset.mimeType ?? 'image/jpeg',
  });
  return { key: uploaded.key, uri: asset.uri };
}

export default function EditUserProfileScreen() {
  const me = useAuthStore((s) => s.user);
  const profile = useQuery({ queryKey: ['userProfile', me?.id ?? 0], queryFn: () => getUserProfile(me!.id) });

  if (profile.isLoading || !profile.data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }
  return <Form profile={profile.data} />;
}

function Form({ profile }: { profile: UserProfile }) {
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const headerHeight = useHeaderHeight();
  const me = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);

  // Profile basics (name/belt/age/location) — lets social-login accounts complete their profile.
  const [firstName, setFirstName] = useState(profile.firstName ?? '');
  const [lastName, setLastName] = useState(profile.lastName ?? '');
  const [beltSlug, setBeltSlug] = useState<string | null>(profile.belt?.slug ?? null);
  const [stripes, setStripes] = useState(profile.belt?.stripes ?? 0);
  const [ageText, setAgeText] = useState(profile.age != null ? String(profile.age) : '');
  const [country, setCountry] = useState(countryCodeByName(profile.country) ?? 'BR');
  const [region, setRegion] = useState(profile.state ?? '');
  const [city, setCity] = useState(profile.city ?? '');

  const [username, setUsername] = useState(profile.username ?? '');
  const [bio, setBio] = useState(profile.bio ?? '');
  const [avatar, setAvatar] = useState<Pic | null>(profile.avatarUrl ? { uri: resolveMediaUrl(profile.avatarUrl) } : null);
  const [banner, setBanner] = useState<Pic | null>(profile.bannerUrl ? { uri: resolveMediaUrl(profile.bannerUrl) } : null);
  // Tracks whether the user changed/removed the banner so save knows to send a
  // new key, an empty string (clear → gradient), or leave it untouched.
  const [bannerTouched, setBannerTouched] = useState(false);
  const [cert, setCert] = useState<Pic | null>(
    profile.certificateUrl ? { uri: resolveMediaUrl(profile.certificateUrl) } : null,
  );
  const [accent, setAccent] = useState(profile.accentColor || ACCENT_COLORS[0]);
  const [photos, setPhotos] = useState<ProfilePhoto[]>(profile.photos);
  const [medalMap, setMedalMap] = useState<Record<string, MedalEntry>>(() => {
    const map: Record<string, MedalEntry> = {};
    profile.medals.forEach((m) => {
      map[m.competition] = { count: m.count, tier: m.tier };
    });
    return map;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['userProfile', profile.id] });
    queryClient.invalidateQueries({ queryKey: ['userJourney', profile.id] });
  };

  const save = useMutation({
    mutationFn: async () => {
      await updateMyProfile({
        bio: bio.trim() || undefined,
        avatarKey: avatar?.key,
        certificateKey: cert?.key,
        accentColor: accent,
        bannerKey: bannerTouched ? (banner?.key ?? '') : undefined,
        username: username.trim().toLowerCase() || undefined,
      });
      const medals: MedalInput[] = Object.entries(medalMap)
        .filter(([, e]) => e.count > 0)
        .map(([competition, e]) => ({ competition, tier: e.tier, count: e.count }));
      await updateMyMedals(medals);
      return completeProfile({
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        beltSlug: beltSlug ?? undefined,
        stripes,
        age: ageText ? parseInt(ageText, 10) : undefined,
        country: country ? countryName(country) : undefined,
        state: region.trim() || undefined,
        city: city.trim() || undefined,
      });
    },
    onSuccess: (updated) => {
      // Keep the auth user's name/belt/age in sync so the rest of the app reflects the change.
      if (updated && me) setUser({ ...me, displayName: updated.displayName, belt: updated.belt, age: updated.age });
      invalidate();
      Alert.alert(t('profile.edit.saved'));
      navigation.goBack();
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  const proToggle = useMutation({ mutationFn: togglePro, onSuccess: invalidate });

  const addPhoto = useMutation({
    mutationFn: async () => {
      const picked = await pickAndUpload();
      return picked?.key ? addMyPhoto(picked.key) : null;
    },
    onSuccess: (data) => {
      if (data) {
        setPhotos(data.photos);
        invalidate();
      }
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  const removePhoto = useMutation({
    mutationFn: (id: number) => deleteMyPhoto(id),
    onSuccess: (data) => {
      setPhotos(data.photos);
      invalidate();
    },
  });

  const entryFor = (label: string): MedalEntry => medalMap[label] ?? { count: 0, tier: 'GOLD' };
  const setCount = (label: string, count: number) =>
    setMedalMap((prev) => ({ ...prev, [label]: { tier: prev[label]?.tier ?? 'GOLD', count: Math.max(0, count) } }));
  const setTier = (label: string, tier: MedalTier) =>
    setMedalMap((prev) => ({ ...prev, [label]: { count: prev[label]?.count ?? 0, tier } }));

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

  const pickBanner = async () => {
    setBusy(true);
    setError(null);
    try {
      const picked = await pickAndUpload();
      if (picked) {
        setBanner(picked);
        setBannerTouched(true);
      }
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const removeBanner = () => {
    setBanner(null);
    setBannerTouched(true);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={headerHeight}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Banner / thumbnail */}
        <Text style={styles.sectionTitle}>{t('profile.edit.banner')}</Text>
        {banner ? (
          <View style={styles.bannerWrap}>
            <Image source={{ uri: banner.uri }} style={styles.bannerImg} resizeMode="cover" />
            <Pressable style={styles.bannerRemove} onPress={removeBanner} hitSlop={8}>
              <MaterialCommunityIcons name="close" size={16} color="#fff" />
            </Pressable>
          </View>
        ) : (
          <Pressable style={styles.bannerAdd} onPress={pickBanner} disabled={busy}>
            <MaterialCommunityIcons name="image-plus" size={22} color={palette.textSecondary} />
            <Text style={styles.bannerAddText}>{t('profile.edit.banner.add')}</Text>
          </Pressable>
        )}
        <Text style={styles.hint}>{t('profile.edit.banner.hint')}</Text>

        {/* Avatar */}
        <View style={styles.avatarRow}>
          <Pressable onPress={() => pick(setAvatar)} disabled={busy} style={styles.avatarPick}>
            {avatar ? (
              <Image source={{ uri: avatar.uri }} style={styles.avatar} resizeMode="cover" />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarText}>{initialsOf(profile.displayName)}</Text>
              </View>
            )}
            <View style={styles.avatarBadge}>
              {busy ? <ActivityIndicator size={12} color="#fff" /> : <MaterialCommunityIcons name="camera" size={13} color="#fff" />}
            </View>
          </Pressable>
          <Text style={styles.hint}>{t('profile.edit.photo')}</Text>
        </View>

        <TextInput
          mode="outlined"
          label={t('profile.edit.username')}
          value={username}
          onChangeText={(v) => setUsername(v.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={30}
          left={<TextInput.Affix text="@" />}
          style={styles.input}
        />
        <Text style={styles.hint}>{t('profile.edit.username.hint')}</Text>

        <TextInput
          mode="outlined"
          label={t('profile.edit.bio')}
          value={bio}
          onChangeText={setBio}
          placeholder={t('profile.edit.bio.placeholder')}
          multiline
          numberOfLines={3}
          style={styles.input}
        />

        {/* Basics: name, belt, age, location */}
        <Text style={styles.sectionTitle}>{t('profile.edit.basics')}</Text>
        <View style={styles.nameRow}>
          <TextInput
            mode="outlined"
            label={t('profile.edit.firstName')}
            value={firstName}
            onChangeText={setFirstName}
            autoCapitalize="words"
            style={[styles.input, styles.nameInput]}
          />
          <TextInput
            mode="outlined"
            label={t('profile.edit.lastName')}
            value={lastName}
            onChangeText={setLastName}
            autoCapitalize="words"
            style={[styles.input, styles.nameInput]}
          />
        </View>
        <Text style={styles.fieldLabel}>{t('profile.edit.belt')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.beltRow}>
          {ALL_BELTS.map((b) => {
            const on = beltSlug === b.slug;
            return (
              <Pressable
                key={b.slug}
                onPress={() => {
                  setBeltSlug(b.slug);
                  setStripes((s) => Math.min(s, maxStripesFor(b.slug)));
                }}
                style={[styles.beltChip, on && styles.beltChipOn]}>
                <View style={[styles.beltSwatch, { backgroundColor: b.color }]} />
                <Text style={[styles.beltChipText, on && styles.beltChipTextOn]}>{b.namePt}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {beltSlug && (
          <View style={styles.stripeRow}>
            <Text style={styles.fieldLabel}>{t('profile.edit.stripes')}</Text>
            <View style={styles.counter}>
              <Pressable onPress={() => setStripes((s) => Math.max(0, s - 1))} hitSlop={6} style={styles.counterBtn}>
                <MaterialCommunityIcons name="minus" size={16} color={palette.textPrimary} />
              </Pressable>
              <Text style={styles.counterValue}>{stripes}</Text>
              <Pressable onPress={() => setStripes((s) => Math.min(maxStripesFor(beltSlug), s + 1))} hitSlop={6} style={styles.counterBtn}>
                <MaterialCommunityIcons name="plus" size={16} color={palette.textPrimary} />
              </Pressable>
            </View>
          </View>
        )}

        <TextInput
          mode="outlined"
          label={t('profile.edit.age')}
          value={ageText}
          onChangeText={(v) => setAgeText(v.replace(/[^0-9]/g, ''))}
          keyboardType="number-pad"
          maxLength={3}
          style={[styles.input, { marginTop: 12 }]}
        />

        <Text style={styles.fieldLabel}>{t('profile.edit.location')}</Text>
        <LocationFields country={country} setCountry={setCountry} region={region} setRegion={setRegion} city={city} setCity={setCity} />

        {/* Accent color */}
        <Text style={styles.sectionTitle}>{t('profile.edit.color')}</Text>
        <View style={styles.colorRow}>
          {ACCENT_COLORS.map((c) => (
            <Pressable
              key={c}
              onPress={() => setAccent(c)}
              style={[styles.swatch, { backgroundColor: c }, accent === c && styles.swatchOn]}
            />
          ))}
        </View>

        {/* PRO toggle (temp) */}
        <View style={styles.proRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>{t('profile.edit.pro')}</Text>
            <Text style={styles.proStatus}>{profile.pro ? t('profile.edit.pro.on') : t('profile.edit.pro.off')}</Text>
          </View>
          <Button mode="outlined" compact loading={proToggle.isPending} disabled={proToggle.isPending} onPress={() => proToggle.mutate()}>
            {t('profile.edit.pro.toggle')}
          </Button>
        </View>

        {/* Medals */}
        <Text style={styles.sectionTitle}>{t('profile.edit.medals')}</Text>
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
                  <Pressable onPress={() => setCount(comp.label, entry.count - 1)} hitSlop={6} style={styles.counterBtn}>
                    <MaterialCommunityIcons name="minus" size={15} color={palette.textPrimary} />
                  </Pressable>
                  <Text style={styles.counterValue}>{entry.count}</Text>
                  <Pressable onPress={() => setCount(comp.label, entry.count + 1)} hitSlop={6} style={styles.counterBtn}>
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
                        style={[styles.tierDot, { backgroundColor: tier.color }, entry.tier === tier.key && styles.tierDotOn]}
                      />
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Photos */}
        <Text style={styles.sectionTitle}>{t('profile.edit.photos')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.gallery}>
          {photos.map((ph) => (
            <View key={ph.id} style={styles.photoWrap}>
              <Image source={{ uri: resolveMediaUrl(ph.url) }} style={styles.photo} resizeMode="cover" />
              <Pressable style={styles.photoX} hitSlop={6} onPress={() => removePhoto.mutate(ph.id)}>
                <MaterialCommunityIcons name="close" size={12} color="#fff" />
              </Pressable>
            </View>
          ))}
          <Pressable style={styles.addPhoto} disabled={addPhoto.isPending} onPress={() => addPhoto.mutate()}>
            {addPhoto.isPending ? (
              <ActivityIndicator size="small" color={palette.primary} />
            ) : (
              <>
                <MaterialCommunityIcons name="plus" size={22} color={palette.primary} />
                <Text style={styles.addPhotoText}>{t('profile.edit.photos.add')}</Text>
              </>
            )}
          </Pressable>
        </ScrollView>

        {/* Certificate */}
        <Text style={styles.sectionTitle}>{t('profile.edit.certificate')}</Text>
        <Pressable style={styles.certBox} onPress={() => pick(setCert)} disabled={busy}>
          {cert ? (
            <Image source={{ uri: cert.uri }} style={styles.certImage} resizeMode="cover" />
          ) : (
            <View style={styles.certPlaceholder}>
              <MaterialCommunityIcons name="certificate-outline" size={26} color={palette.textSecondary} />
              <Text style={styles.hint}>{t('profile.edit.certificate.add')}</Text>
            </View>
          )}
        </Pressable>

        {error && <Text style={styles.error}>{error}</Text>}

        <Button
          mode="contained"
          onPress={() => save.mutate()}
          loading={save.isPending}
          disabled={save.isPending || busy}
          contentStyle={styles.saveContent}
          style={styles.save}>
          {t('profile.edit.save')}
        </Button>

        {me?.admin && (
          <Button
            mode="contained-tonal"
            icon="shield-check"
            style={styles.adminBtn}
            onPress={() => navigation.navigate('Gym', { screen: 'AdminVerifications' })}>
            {t('admin.entry')}
          </Button>
        )}
        <Button mode="text" textColor={palette.textSecondary} onPress={() => logout()} style={styles.logout}>
          {t('profile.logout')}
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = makeStyles(() => ({
  container: { flex: 1, backgroundColor: palette.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.background },
  content: { padding: 20, paddingBottom: 40 },
  avatarRow: { alignItems: 'center', marginBottom: 16 },
  avatarPick: { position: 'relative' },
  avatar: { width: 90, height: 90, borderRadius: 45 },
  avatarFallback: { backgroundColor: palette.surfaceVariant, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: palette.textPrimary, fontWeight: 'bold', fontSize: 28 },
  avatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: palette.background,
  },
  hint: { color: palette.textSecondary, fontSize: 11, marginTop: 8 },
  bannerWrap: { borderRadius: 12, overflow: 'hidden' },
  bannerImg: { width: '100%', height: 120, borderRadius: 12, backgroundColor: palette.surfaceVariant },
  bannerRemove: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerAdd: {
    height: 120,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.outline,
    borderStyle: 'dashed',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  bannerAddText: { color: palette.textSecondary, fontSize: 13, fontWeight: '600' },
  input: { marginBottom: 16 },
  sectionTitle: { color: palette.textPrimary, fontSize: 13, fontWeight: 'bold', marginTop: 4, marginBottom: 10 },
  fieldLabel: { color: palette.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 8 },
  nameRow: { flexDirection: 'row', gap: 10 },
  nameInput: { flex: 1 },
  beltRow: { gap: 8, paddingVertical: 2, paddingRight: 8, marginBottom: 4 },
  beltChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.outline,
  },
  beltChipOn: { borderColor: palette.primary, backgroundColor: `${palette.primary}1A` },
  beltSwatch: { width: 16, height: 16, borderRadius: 4, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.2)' },
  beltChipText: { color: palette.textSecondary, fontSize: 13, fontWeight: '600' },
  beltChipTextOn: { color: palette.textPrimary },
  stripeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, marginBottom: 8 },
  proRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: palette.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  proStatus: { color: palette.textSecondary, fontSize: 12, marginTop: -6 },
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
  colorRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  swatch: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: 'transparent' },
  swatchOn: { borderColor: palette.textPrimary },
  gallery: { marginBottom: 16 },
  photoWrap: { marginRight: 8 },
  photo: { width: 100, height: 100, borderRadius: 10, backgroundColor: palette.surfaceVariant },
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
    width: 100,
    height: 100,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: palette.outline,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  addPhotoText: { color: palette.textSecondary, fontSize: 10 },
  certBox: {
    height: 160,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: palette.outline,
    overflow: 'hidden',
    marginBottom: 16,
  },
  certImage: { width: '100%', height: '100%' },
  certPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  error: { color: palette.primary, marginBottom: 12 },
  save: { marginTop: 4 },
  saveContent: { paddingVertical: 6 },
  adminBtn: { marginTop: 16, borderRadius: 12 },
  logout: { marginTop: 8 },
}));
