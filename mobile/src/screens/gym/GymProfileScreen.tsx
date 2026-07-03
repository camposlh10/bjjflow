import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { ComponentProps, useEffect, useState } from 'react';
import { Alert, Image, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Text, TextInput } from 'react-native-paper';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { WebView } from 'react-native-webview';

import { apiErrorMessage } from '../../api/auth';
import { Gym, GymMedal, getGymReviews, getMyGym, upsertGymReview } from '../../api/gyms';
import { resolveMediaUrl } from '../../api/posts';
import ImageLightbox from '../../components/ImageLightbox';
import MedalVisual from '../../components/MedalVisual';
import { competitionStyle } from '../../constants/competitions';
import { t, tf } from '../../i18n';
import { GymStackParamList } from '../../navigation/GymNavigator';
import { makeStyles, palette } from '../../theme/theme';
import { formatMonthYear, formatShortDateTime } from '../../utils/time';

type Nav = NativeStackNavigationProp<GymStackParamList>;
type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

function ContactRow({ icon, value, onPress }: { icon: IconName; value: string; onPress?: () => void }) {
  return (
    <Pressable style={styles.contactRow} onPress={onPress} disabled={!onPress}>
      <MaterialCommunityIcons name={icon} size={17} color={palette.textSecondary} />
      <Text style={[styles.contactText, onPress && styles.contactLink]} numberOfLines={1}>
        {value}
      </Text>
    </Pressable>
  );
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

function whatsappUrl(gym: Gym): string | null {
  const digits = digitsOnly(gym.whatsapp || gym.phone || '');
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent('Olá! Vim pelo BJJ Flow 🥋')}`;
}

function instagramUrl(value: string): string {
  if (value.startsWith('http')) return value;
  return `https://instagram.com/${value.replace(/^@/, '')}`;
}

function facebookUrl(value: string): string {
  if (value.startsWith('http')) return value;
  return `https://facebook.com/${value.replace(/^@/, '')}`;
}

function youtubeUrl(value: string): string {
  if (value.startsWith('http')) return value;
  return `https://youtube.com/${value.startsWith('@') ? value : `@${value}`}`;
}

// Wrapping the Google Maps embed in a local HTML iframe (rather than pointing
// the WebView straight at the URL) is what actually renders — the bare
// ?output=embed URL gets served a blank consent page on a fresh WebView.
function mapHtml(address: string): string {
  const src = `https://maps.google.com/maps?q=${encodeURIComponent(address)}&z=15&output=embed`;
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"><style>*{margin:0;padding:0}html,body,iframe{width:100%;height:100%;border:0;display:block}</style></head><body><iframe src="${src}" allowfullscreen></iframe></body></html>`;
}

function StarRow({
  value,
  size = 16,
  onChange,
}: {
  value: number;
  size?: number;
  onChange?: (rating: number) => void;
}) {
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable key={n} onPress={onChange ? () => onChange(n) : undefined} disabled={!onChange} hitSlop={4}>
          <MaterialCommunityIcons name={n <= value ? 'star' : 'star-outline'} size={size} color="#FACC15" />
        </Pressable>
      ))}
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function MediaStrip({ photos, onOpen }: { photos: Gym['photos']; onOpen: (i: number) => void }) {
  if (photos.length === 0) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.mediaStrip}
      contentContainerStyle={styles.mediaStripContent}>
      {photos.map((p, i) => (
        <Pressable key={p.id} onPress={() => onOpen(i)}>
          <Image source={{ uri: resolveMediaUrl(p.url) }} style={styles.mediaTile} resizeMode="contain" />
        </Pressable>
      ))}
    </ScrollView>
  );
}

function MedalsShowcase({ medals }: { medals: GymMedal[] }) {
  if (medals.length === 0) return null;
  const total = medals.reduce((sum, m) => sum + m.count, 0);
  return (
    <>
      <View style={styles.medalsHeader}>
        <Text style={styles.sectionTitle}>{t('gymProfile.medals')}</Text>
        <Text style={styles.medalsTotal}>
          {total === 1 ? t('gymProfile.medals.total.one') : tf('gymProfile.medals.total.many', { n: total })}
        </Text>
      </View>
      <View style={styles.medalsCard}>
        <View style={styles.medalsGrid}>
          {medals.map((m) => {
            const style = competitionStyle(m.competition);
            return (
              <View key={m.id} style={styles.medalItem}>
                <MedalVisual competition={m.competition} tier={m.tier} count={m.count} size={66} />
                <Text style={styles.medalLabel} numberOfLines={1}>
                  {style.label}
                </Text>
                <Text style={styles.medalFull} numberOfLines={2}>
                  {style.full}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </>
  );
}

function ReviewsSection() {
  const queryClient = useQueryClient();
  const reviews = useQuery({ queryKey: ['gymReviews'], queryFn: getGymReviews });
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [editing, setEditing] = useState(false);
  const [thanks, setThanks] = useState(false);

  const data = reviews.data;
  const myRating = data?.summary.myRating ?? null;
  const myComment = data?.summary.myComment ?? null;
  const hasMyReview = myRating != null;

  useEffect(() => {
    if (data) {
      setRating(data.summary.myRating ?? 0);
      setComment(data.summary.myComment ?? '');
    }
  }, [data]);

  const submit = useMutation({
    mutationFn: () => upsertGymReview(rating, comment.trim() || undefined),
    onSuccess: (d) => {
      queryClient.setQueryData(['gymReviews'], d);
      setEditing(false);
      setThanks(true);
      setTimeout(() => setThanks(false), 2500);
    },
    onError: (e) => Alert.alert(apiErrorMessage(e)),
  });

  // After the user has a review, collapse the form to a read-only card until they tap "Editar".
  const showForm = !hasMyReview || editing;

  return (
    <>
      <Text style={styles.sectionTitle}>{t('gymProfile.reviews')}</Text>
      <View style={styles.card}>
        {reviews.isLoading && <ActivityIndicator />}
        {reviews.isError && <Text style={styles.contactText}>{apiErrorMessage(reviews.error)}</Text>}

        {data && (
          <>
            {data.summary.count > 0 ? (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryAverage}>{data.summary.average.toFixed(1)}</Text>
                <View>
                  <StarRow value={Math.round(data.summary.average)} />
                  <Text style={styles.summaryCount}>
                    {data.summary.count === 1
                      ? t('gymProfile.reviews.count.one')
                      : tf('gymProfile.reviews.count.many', { n: data.summary.count })}
                  </Text>
                </View>
              </View>
            ) : (
              <Text style={styles.contactText}>{t('gymProfile.reviews.empty')}</Text>
            )}

            <View style={styles.divider} />

            {thanks && (
              <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.thanksToast}>
                <MaterialCommunityIcons name="check-circle" size={16} color="#22C55E" />
                <Text style={styles.thanksText}>{t('gymProfile.reviews.thanks')}</Text>
              </Animated.View>
            )}

            {showForm ? (
              <>
                <Text style={styles.cardTitle}>{t('gymProfile.reviews.yours')}</Text>
                <StarRow value={rating} size={26} onChange={setRating} />
                <TextInput
                  mode="outlined"
                  value={comment}
                  onChangeText={setComment}
                  placeholder={t('gymProfile.reviews.placeholder')}
                  multiline
                  numberOfLines={2}
                  style={styles.reviewInput}
                />
                <Button
                  mode="contained"
                  compact
                  disabled={rating === 0 || submit.isPending}
                  loading={submit.isPending}
                  onPress={() => submit.mutate()}>
                  {hasMyReview ? t('gymProfile.reviews.update') : t('gymProfile.reviews.submit')}
                </Button>
              </>
            ) : (
              <View style={styles.myReview}>
                <View style={styles.myReviewHead}>
                  <Text style={styles.cardTitle}>{t('gymProfile.reviews.mine')}</Text>
                  <Pressable onPress={() => setEditing(true)} hitSlop={8}>
                    <Text style={styles.editLink}>{t('gymProfile.reviews.edit')}</Text>
                  </Pressable>
                </View>
                <StarRow value={myRating ?? 0} size={18} />
                {myComment ? <Text style={styles.myReviewComment}>{myComment}</Text> : null}
              </View>
            )}
          </>
        )}
      </View>

      {data && data.reviews.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.reviewsStrip}
          contentContainerStyle={styles.reviewsStripContent}>
          {data.reviews.map((r) => (
            <View key={r.id} style={styles.reviewCard}>
              <View style={styles.reviewCardHead}>
                <View style={styles.reviewAvatar}>
                  <Text style={styles.reviewAvatarText}>{initialsOf(r.displayName)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reviewName} numberOfLines={1}>
                    {r.displayName}
                  </Text>
                  <Text style={styles.reviewDate}>{formatShortDateTime(r.createdAt)}</Text>
                </View>
              </View>
              <StarRow value={r.rating} size={13} />
              {r.comment ? (
                <Text style={styles.reviewCardComment} numberOfLines={5}>
                  {r.comment}
                </Text>
              ) : null}
            </View>
          ))}
        </ScrollView>
      )}
    </>
  );
}

const SOCIAL_LINKS: { key: 'instagram' | 'facebook' | 'whatsapp' | 'youtube'; icon: IconName; color: string; build: (v: string) => string }[] = [
  { key: 'instagram', icon: 'instagram', color: '#E1306C', build: instagramUrl },
  { key: 'facebook', icon: 'facebook', color: '#1877F2', build: facebookUrl },
  { key: 'whatsapp', icon: 'whatsapp', color: '#25D366', build: (v) => `https://wa.me/${digitsOnly(v)}` },
  { key: 'youtube', icon: 'youtube', color: '#FF0000', build: youtubeUrl },
];

export default function GymProfileScreen() {
  const navigation = useNavigation<Nav>();
  const gym = useQuery({ queryKey: ['myGym'], queryFn: getMyGym });
  // Shares the ['gymReviews'] cache with ReviewsSection — used for the header stats.
  const reviews = useQuery({ queryKey: ['gymReviews'], queryFn: getGymReviews });
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [certOpen, setCertOpen] = useState(false);

  if (gym.isLoading || !gym.data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  const g = gym.data;
  const isOwner = g.role === 'OWNER';
  const open = (url: string) => Linking.openURL(url).catch(() => undefined);
  const website = g.website ? (g.website.startsWith('http') ? g.website : `https://${g.website}`) : null;
  const whatsappLink = whatsappUrl(g);
  const activeSocials = SOCIAL_LINKS.filter((s) => g[s.key]);
  const summary = reviews.data?.summary;
  const medalTotal = g.medals.reduce((sum, m) => sum + m.count, 0);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <LinearGradient colors={['#5A171D', palette.background]} style={styles.banner} />

      {g.verified && (
        <View style={styles.verifiedPill}>
          <MaterialCommunityIcons name="check-decagram" size={13} color={palette.verified} />
          <Text style={styles.verifiedPillText}>{t('gymProfile.verifiedBadge')}</Text>
        </View>
      )}

      <View style={styles.headerRow}>
        {g.logoUrl ? (
          <Image source={{ uri: resolveMediaUrl(g.logoUrl) }} style={styles.logo} resizeMode="cover" />
        ) : (
          <View style={[styles.logo, styles.logoFallback]}>
            <Text style={styles.logoText}>{initialsOf(g.name)}</Text>
          </View>
        )}
        <View style={styles.headerInfo}>
          <Text style={styles.overline}>{t('gymProfile.label')}</Text>
          <View style={styles.nameRow}>
            <Text variant="titleLarge" style={styles.name} numberOfLines={1}>
              {g.name}
            </Text>
            {g.verified && <MaterialCommunityIcons name="check-decagram" size={18} color={palette.verified} />}
          </View>
          {g.city && <Text style={styles.location}>{g.city}</Text>}
          <View style={styles.joinedRow}>
            <MaterialCommunityIcons name="calendar-blank-outline" size={12} color={palette.textSecondary} />
            <Text style={styles.joined}>{tf('gymProfile.joined', { date: formatMonthYear(g.createdAt) })}</Text>
          </View>
        </View>
      </View>

      <View style={styles.statsRow}>
        <Stat value={String(g.memberCount)} label={t('gymProfile.stats.members')} />
        <Stat value={String(summary?.count ?? 0)} label={t('gymProfile.stats.reviews')} />
        <Stat
          value={summary && summary.count > 0 ? summary.average.toFixed(1) : '—'}
          label={t('gymProfile.stats.rating')}
        />
        <Stat value={String(medalTotal)} label={t('gymProfile.stats.medals')} />
      </View>

      <MediaStrip photos={g.photos} onOpen={setLightbox} />

      {g.description && (
        <>
          <Text style={styles.sectionTitle}>{t('gymProfile.bio')}</Text>
          <Text style={styles.bio}>{g.description}</Text>
        </>
      )}

      {g.address && (
        <>
          <Text style={styles.sectionTitle}>{t('gymProfile.map')}</Text>
          {/* Non-interactive map: the WebView ignores touches (pointerEvents none)
              so it can't hijack scroll; the whole box opens the native maps app. */}
          <Pressable
            style={styles.mapBox}
            onPress={() => open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(g.address!)}`)}>
            <WebView
              style={styles.map}
              pointerEvents="none"
              originWhitelist={['*']}
              javaScriptEnabled
              domStorageEnabled
              scrollEnabled={false}
              source={{ html: mapHtml(g.address) }}
            />
            <View style={styles.mapHint}>
              <MaterialCommunityIcons name="map-marker" size={14} color="#fff" />
              <Text style={styles.mapHintText} numberOfLines={1}>
                {g.address}
              </Text>
              <MaterialCommunityIcons name="open-in-new" size={13} color="#fff" />
            </View>
          </Pressable>
        </>
      )}

      {(g.phone || g.email || website) && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('gymProfile.contact')}</Text>
          {g.phone && <ContactRow icon="phone-outline" value={g.phone} onPress={() => open(`tel:${g.phone}`)} />}
          {g.email && <ContactRow icon="email-outline" value={g.email} onPress={() => open(`mailto:${g.email}`)} />}
          {website && <ContactRow icon="web" value={g.website!} onPress={() => open(website)} />}
        </View>
      )}

      {whatsappLink && (
        <Button
          mode="contained"
          icon="whatsapp"
          buttonColor="#25D366"
          style={styles.messageBtn}
          contentStyle={styles.editContent}
          onPress={() => open(whatsappLink)}>
          {t('gymProfile.message')}
        </Button>
      )}

      {activeSocials.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>{t('gymProfile.social')}</Text>
          <View style={styles.socialRow}>
            {activeSocials.map((s) => (
              <Pressable
                key={s.key}
                style={[styles.socialIcon, { backgroundColor: s.color }]}
                onPress={() => open(s.build(g[s.key] as string))}>
                <MaterialCommunityIcons name={s.icon} size={22} color="#fff" />
              </Pressable>
            ))}
          </View>
        </>
      )}

      {g.verification?.status === 'APPROVED' && g.verification.certificateUrl && (
        <>
          <Text style={styles.sectionTitle}>{t('gymProfile.certificate')}</Text>
          <View style={styles.certCard}>
            <Pressable onPress={() => setCertOpen(true)}>
              <Image
                source={{ uri: resolveMediaUrl(g.verification.certificateUrl) }}
                style={styles.certImage}
                resizeMode="cover"
              />
            </Pressable>
            <View style={styles.certInfo}>
              <MaterialCommunityIcons name="check-decagram" size={16} color={palette.verified} />
              <Text style={styles.certCnpj}>{tf('gymProfile.certificate.cnpj', { cnpj: g.verification.cnpj })}</Text>
            </View>
          </View>
        </>
      )}

      <ReviewsSection />

      <MedalsShowcase medals={g.medals} />

      {isOwner && (
        <Button
          mode="contained"
          icon="pencil"
          style={styles.editBtn}
          contentStyle={styles.editContent}
          onPress={() => navigation.navigate('EditGym')}>
          {t('gymProfile.edit')}
        </Button>
      )}

      <ImageLightbox urls={g.photos.map((p) => p.url)} index={lightbox} onClose={() => setLightbox(null)} />
      <ImageLightbox
        urls={g.verification?.certificateUrl ? [g.verification.certificateUrl] : []}
        index={certOpen ? 0 : null}
        onClose={() => setCertOpen(false)}
      />
    </ScrollView>
  );
}

const styles = makeStyles(() => ({
  container: { flex: 1, backgroundColor: palette.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.background },
  content: { padding: 20, paddingBottom: 40 },
  banner: { position: 'absolute', top: 0, left: 0, right: 0, height: 116 },
  verifiedPill: {
    position: 'absolute',
    top: 12,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(13,13,16,0.6)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.verified,
  },
  verifiedPillText: { color: palette.verified, fontSize: 11, fontWeight: '600' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 24, marginBottom: 18 },
  logo: { width: 80, height: 80, borderRadius: 20, borderWidth: 3, borderColor: palette.primary },
  logoFallback: { backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: '#fff', fontWeight: 'bold', fontSize: 26 },
  headerInfo: { flex: 1 },
  overline: { color: palette.textSecondary, fontSize: 11, letterSpacing: 1, fontWeight: '600', marginBottom: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { color: palette.textPrimary, fontWeight: 'bold', flexShrink: 1 },
  location: { color: palette.textSecondary, fontSize: 13, marginTop: 3 },
  joinedRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  joined: { color: palette.textSecondary, fontSize: 11 },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: palette.outline,
    marginBottom: 16,
  },
  stat: { flex: 1 },
  statValue: { color: palette.textPrimary, fontSize: 20, fontWeight: 'bold' },
  statLabel: { color: palette.textSecondary, fontSize: 11, marginTop: 2 },
  mediaStrip: { marginHorizontal: -20, marginBottom: 18 },
  mediaStripContent: { paddingHorizontal: 20, gap: 8 },
  mediaTile: { width: 150, height: 200, borderRadius: 12, backgroundColor: palette.surfaceVariant },
  bio: { color: '#E4E4E7', fontSize: 13, lineHeight: 19, marginBottom: 16 },
  messageBtn: { marginBottom: 16 },
  socialRow: { flexDirection: 'row', gap: 14, marginBottom: 16 },
  socialIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  medalsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 4 },
  medalsTotal: { color: palette.textSecondary, fontSize: 12, marginBottom: 10 },
  medalsCard: { backgroundColor: palette.surface, borderRadius: 16, padding: 16, marginBottom: 16 },
  medalsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 18 },
  medalItem: { width: '31%', alignItems: 'center' },
  medalLabel: { color: palette.textPrimary, fontSize: 12, fontWeight: 'bold', textAlign: 'center', marginTop: 8 },
  medalFull: { color: palette.textSecondary, fontSize: 10, textAlign: 'center', marginTop: 2, lineHeight: 13 },
  starRow: { flexDirection: 'row', gap: 3 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 },
  summaryAverage: { color: palette.textPrimary, fontSize: 32, fontWeight: 'bold' },
  summaryCount: { color: palette.textSecondary, fontSize: 12, marginTop: 4 },
  divider: { height: 0.5, backgroundColor: palette.surfaceVariant, marginBottom: 14 },
  reviewInput: { marginVertical: 10 },
  thanksToast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(34,197,94,0.14)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  thanksText: { color: '#22C55E', fontSize: 13, fontWeight: '600' },
  myReview: { gap: 6 },
  myReviewHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  editLink: { color: palette.primary, fontSize: 12, fontWeight: '600' },
  myReviewComment: { color: '#E4E4E7', fontSize: 13, lineHeight: 18, marginTop: 2 },
  reviewsStrip: { marginHorizontal: -20, marginBottom: 16 },
  reviewsStripContent: { paddingHorizontal: 20, gap: 10 },
  reviewCard: { width: 260, backgroundColor: palette.surface, borderRadius: 14, padding: 14 },
  reviewCardHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  reviewAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: palette.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewAvatarText: { color: palette.textPrimary, fontWeight: 'bold', fontSize: 12 },
  reviewName: { color: palette.textPrimary, fontSize: 13, fontWeight: 'bold' },
  reviewDate: { color: palette.textSecondary, fontSize: 10, marginTop: 1 },
  reviewCardComment: { color: '#E4E4E7', fontSize: 12, marginTop: 6, lineHeight: 17 },
  mapBox: { height: 240, borderRadius: 16, overflow: 'hidden', backgroundColor: palette.surfaceVariant, marginBottom: 16 },
  map: { flex: 1, backgroundColor: palette.surfaceVariant },
  mapHint: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(13,13,16,0.78)',
  },
  mapHintText: { color: '#fff', fontSize: 12, flex: 1 },
  card: { backgroundColor: palette.surface, borderRadius: 16, padding: 16, marginBottom: 16 },
  cardTitle: { color: palette.textPrimary, fontSize: 13, fontWeight: 'bold', marginBottom: 10 },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  contactText: { color: palette.textSecondary, fontSize: 13, flex: 1 },
  contactLink: { color: '#4A9EED' },
  sectionTitle: { color: palette.textPrimary, fontSize: 13, fontWeight: 'bold', marginBottom: 10 },
  certCard: { backgroundColor: palette.surface, borderRadius: 16, padding: 12, marginBottom: 16 },
  certImage: { width: '100%', height: 200, borderRadius: 10, backgroundColor: palette.surfaceVariant },
  certInfo: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  certCnpj: { color: palette.textSecondary, fontSize: 12 },
  editBtn: { marginTop: 8 },
  editContent: { paddingVertical: 5 },
}));
