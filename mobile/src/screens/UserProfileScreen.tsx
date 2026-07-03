import { MaterialCommunityIcons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { ComponentProps, useLayoutEffect, useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Button, IconButton, Text } from 'react-native-paper';

import { apiErrorMessage } from '../api/auth';
import { TimelineItem } from '../api/activity';
import { getGymMembers, getMyGym, promoteMember } from '../api/gyms';
import { resolveMediaUrl } from '../api/posts';
import { todayLocalDate } from '../api/checkins';
import { getUserSubmissions } from '../api/submissions';
import {
  UserProfile,
  followUser,
  getUserJourney,
  getUserProfile,
  unfollowUser,
} from '../api/users';
import { submissionStyle } from '../constants/submissions';
import BeltVisual, { formatStripes } from '../components/BeltVisual';
import ImageLightbox from '../components/ImageLightbox';
import Skeleton from '../components/Skeleton';
import MedalVisual from '../components/MedalVisual';
import MetricRing from '../components/MetricRing';
import { ADULT_BELTS, KIDS_BELTS, beltBySlug, maxStripesFor, rankBarColorFor } from '../constants/belts';
import { countryFlag } from '../constants/locations';
import { martialArtIcon, martialArtLabel } from '../constants/profile';
import { competitionStyle } from '../constants/competitions';
import { TRAINING_MILESTONES, WEEK_MILESTONES, milestoneProgress, nextMilestone } from '../constants/milestones';
import { t, tf } from '../i18n';
import { useAuthStore } from '../store/authStore';
import { makeStyles, palette } from '../theme/theme';
import { formatMonthYear } from '../utils/time';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];
const ALL_BELTS = [...ADULT_BELTS, ...KIDS_BELTS];
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

function eventDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

const TL_ICON: Record<string, IconName> = {
  BELT_PROMOTION: 'arrow-up-bold-circle',
  ACADEMY_JOINED: 'town-hall',
  FIRST_TRAINING: 'flag-checkered',
  TRAINING_MILESTONE: 'medal',
  STREAK_MILESTONE: 'fire',
  COMPETITION_RESULT: 'trophy',
  NEW_MEMBER: 'account-plus',
};

function timelineText(item: TimelineItem): string {
  switch (item.type) {
    case 'FIRST_TRAINING':
      return t('home.timeline.FIRST_TRAINING');
    case 'BELT_PROMOTION':
      return tf('home.timeline.BELT_PROMOTION', { belt: item.text ?? '' });
    case 'ACADEMY_JOINED':
      return tf('home.timeline.ACADEMY_JOINED', { text: item.text ?? '' });
    case 'TRAINING_MILESTONE':
      return tf('home.timeline.TRAINING_MILESTONE', { n: item.value ?? 0 });
    case 'STREAK_MILESTONE':
      return tf('home.timeline.STREAK_MILESTONE', { n: item.value ?? 0 });
    default:
      return tf('home.timeline.COMPETITION_RESULT', { text: item.text ?? '' });
  }
}

function ProBadge() {
  return (
    <View style={styles.proBadge}>
      <MaterialCommunityIcons name="star" size={11} color="#0D0D10" />
      <Text style={styles.proText}>{t('profile.pro')}</Text>
    </View>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function UserProfileScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<Record<string, { userId?: number } | undefined>, string>>();
  const queryClient = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const targetId = route.params?.userId ?? me?.id ?? 0;

  const isOther = targetId !== (me?.id ?? 0);
  const profile = useQuery({ queryKey: ['userProfile', targetId], queryFn: () => getUserProfile(targetId) });
  const journey = useQuery({ queryKey: ['userJourney', targetId], queryFn: () => getUserJourney(targetId) });
  // Only needed to offer the staff "Graduar" action when viewing someone else;
  // skip on your own profile and when you're not in a gym (avoids wasted/404 fetches).
  const gym = useQuery({ queryKey: ['myGym'], queryFn: getMyGym, enabled: isOther });
  const members = useQuery({ queryKey: ['gymMembers'], queryFn: getGymMembers, enabled: isOther && !!gym.data });
  const thisMonth = todayLocalDate().slice(0, 7);
  const submissions = useQuery({
    queryKey: ['userSubmissions', targetId, thisMonth, 'HIT'],
    queryFn: () => getUserSubmissions(targetId, thisMonth, 'HIT'),
  });

  const [certOpen, setCertOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [beltSlug, setBeltSlug] = useState<string | null>(null);
  const [stripes, setStripes] = useState(0);
  const [lightAvatar, setLightAvatar] = useState(false);
  const [photoIndex, setPhotoIndex] = useState<number | null>(null);
  const [photosExpanded, setPhotosExpanded] = useState(false);
  const [journeyExpanded, setJourneyExpanded] = useState(false);

  const follow = useMutation({
    mutationFn: () => (profile.data?.isFollowing ? unfollowUser(targetId) : followUser(targetId)),
    onSuccess: (data) => {
      Haptics.selectionAsync();
      queryClient.setQueryData(['userProfile', targetId], data);
    },
    onError: (e) => Alert.alert(apiErrorMessage(e)),
  });

  const promote = useMutation({
    mutationFn: () => promoteMember(targetId, beltSlug!, stripes),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSheetOpen(false);
      queryClient.invalidateQueries({ queryKey: ['gymMembers'] });
      queryClient.invalidateQueries({ queryKey: ['userProfile', targetId] });
      queryClient.invalidateQueries({ queryKey: ['userJourney', targetId] });
      Alert.alert(t('member.promote.success'));
    },
    onError: (e) => Alert.alert(apiErrorMessage(e)),
  });

  // Only on the Profile tab root (no userId param): a home shortcut (left) to the
  // Início tab and a gear (right) opening Settings in this stack. Skipped when your
  // own profile is pushed from another stack (e.g. Comunidade), which lacks Settings
  // and where replacing the back button would trap the user.
  const isOwnProfileTab = route.params?.userId == null && (profile.data?.isMe ?? true);
  useLayoutEffect(() => {
    if (!isOwnProfileTab) return;
    navigation.setOptions({
      headerLeft: () => (
        <IconButton
          icon="home-variant-outline"
          iconColor={palette.textPrimary}
          size={24}
          onPress={() => navigation.navigate('Home')}
          accessibilityLabel={t('tabs.home')}
        />
      ),
      headerRight: () => (
        <IconButton
          icon="cog-outline"
          iconColor={palette.textPrimary}
          size={22}
          onPress={() => navigation.navigate('Settings')}
          accessibilityLabel={t('settings.title')}
        />
      ),
    });
  }, [navigation, isOwnProfileTab]);

  if (profile.isLoading || !profile.data) {
    return (
      <View style={styles.skeletonWrap}>
        <Skeleton height={110} radius={0} style={styles.skeletonBanner} />
        <Skeleton width={84} height={84} radius={42} style={{ marginTop: 64 }} />
        <Skeleton width="50%" height={20} style={{ marginTop: 14 }} />
        <Skeleton width="35%" height={12} style={{ marginTop: 8 }} />
        <Skeleton height={56} radius={14} style={{ marginTop: 24 }} />
        <Skeleton height={120} radius={14} style={{ marginTop: 14 }} />
      </View>
    );
  }

  const p: UserProfile = profile.data;
  const m = p.metrics;
  const accent = p.accentColor || palette.primary;
  const nextTrainings = nextMilestone(m.trainings, TRAINING_MILESTONES);
  const nextWeeks = nextMilestone(m.activeWeeks, WEEK_MILESTONES);

  // Staff in the same gym viewing one of their members may grade them.
  const memberEntry = members.data?.find((x) => x.userId === targetId);
  const canGraduate =
    !p.isMe && !!gym.data && gym.data.role !== 'MEMBER' && !!memberEntry;
  const gradTarget = gym.data?.graduationTarget ?? 40;

  const openSheet = () => {
    setBeltSlug(p.belt?.slug ?? 'adult-white');
    setStripes(p.belt?.stripes ?? 0);
    setSheetOpen(true);
  };
  const selectedBelt = beltSlug ? beltBySlug(beltSlug) : undefined;
  const maxStripes = beltSlug ? maxStripesFor(beltSlug) : 4;
  const changeStripes = (delta: number) => {
    const next = Math.min(maxStripes, Math.max(0, stripes + delta));
    if (next !== stripes) {
      Haptics.selectionAsync();
      setStripes(next);
    }
  };

  const timeline = Array.isArray(journey.data?.timeline) ? journey.data.timeline : [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {p.bannerUrl ? (
        <Image source={{ uri: resolveMediaUrl(p.bannerUrl) }} style={styles.banner} resizeMode="cover" />
      ) : (
        <LinearGradient colors={[`${accent}2E`, palette.background]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.banner} />
      )}

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => p.avatarUrl && setLightAvatar(true)} disabled={!p.avatarUrl}>
          {p.avatarUrl ? (
            <Image source={{ uri: resolveMediaUrl(p.avatarUrl) }} style={styles.avatar} resizeMode="cover" />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarText}>{initialsOf(p.displayName)}</Text>
            </View>
          )}
        </Pressable>
        <View style={styles.nameRow}>
          <Text variant="titleLarge" style={styles.name} numberOfLines={1}>
            {p.displayName}
          </Text>
          {p.pro && <ProBadge />}
        </View>
        {p.username ? (
          <Text style={styles.handle}>
            @{p.username}
            {countryFlag(p.country) ? `  ${countryFlag(p.country)}` : ''}
          </Text>
        ) : null}
        <View style={styles.subRow}>
          {p.belt && (
            <View style={styles.beltMini}>
              <BeltVisual color={p.belt.colorHex} rankBarColor={rankBarColorFor(p.belt.slug)} stripes={p.belt.stripes} height={11} />
            </View>
          )}
          <Text style={styles.since}>{tf('profile.since', { date: formatMonthYear(p.joinedAt) })}</Text>
        </View>
        {(p.favoriteArt || p.city || p.state) && (
          <View style={styles.metaChips}>
            {p.favoriteArt && (
              <View style={styles.metaChip}>
                <MaterialCommunityIcons name={martialArtIcon(p.favoriteArt)} size={13} color={palette.textSecondary} />
                <Text style={styles.metaChipText}>{martialArtLabel(p.favoriteArt)}</Text>
              </View>
            )}
            {(p.city || p.state) && (
              <View style={styles.metaChip}>
                <MaterialCommunityIcons name="map-marker-outline" size={13} color={palette.textSecondary} />
                <Text style={styles.metaChipText}>{[p.city, p.state].filter(Boolean).join(', ')}</Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Stats row (Instagram-style) */}
      <View style={styles.statsRow}>
        <Stat value={p.followers} label={t('profile.stats.followers')} />
        <Stat value={p.following} label={t('profile.stats.following')} />
        <Stat value={m.trainings} label={t('profile.stats.trainings')} />
      </View>

      {/* Action row — follow/message only when viewing someone else */}
      {!p.isMe && (
        <View style={styles.actionRow}>
          <Button
            mode={p.isFollowing ? 'outlined' : 'contained'}
            icon={p.isFollowing ? 'account-check' : 'account-plus'}
            style={styles.actionFlex}
            loading={follow.isPending}
            disabled={follow.isPending}
            onPress={() => follow.mutate()}>
            {p.isFollowing ? t('profile.following') : t('profile.follow')}
          </Button>
          <Button
            mode="outlined"
            icon="message-outline"
            style={styles.actionFlex}
            onPress={() =>
              navigation.navigate('Conversation', {
                userId: p.id,
                title: p.displayName,
                username: p.username,
                avatarUrl: p.avatarUrl,
              })
            }>
            {t('profile.message')}
          </Button>
        </View>
      )}

      {canGraduate && (
        <Button
          mode="contained-tonal"
          icon="clipboard-account"
          style={styles.graduarBtn}
          onPress={() => navigation.navigate('StudentManagement', { userId: targetId })}>
          {t('student.manage')}
        </Button>
      )}

      {/* Bio */}
      {p.bio ? (
        <Text style={styles.bio}>{p.bio}</Text>
      ) : p.isMe ? (
        <Text style={styles.bioEmpty}>{t('profile.bio.empty')}</Text>
      ) : null}

      {/* Metrics — athlete-style rings */}
      <Text style={styles.sectionTitle}>{t('profile.metrics')}</Text>
      <View style={styles.metricsCard}>
        <MetricRing
          value={m.currentStreak}
          progress={m.longestStreak > 0 ? m.currentStreak / m.longestStreak : m.currentStreak > 0 ? 1 : 0}
          label={t('profile.metrics.streak')}
          sublabel={tf('profile.metrics.record', { n: m.longestStreak })}
          color={palette.primary}
        />
        <MetricRing
          value={m.trainings}
          progress={milestoneProgress(m.trainings, TRAINING_MILESTONES)}
          label={t('profile.metrics.trainings')}
          sublabel={nextTrainings ? `alvo ${nextTrainings}` : 'máx'}
          color="#E0A82E"
        />
        <MetricRing
          value={m.activeWeeks}
          progress={milestoneProgress(m.activeWeeks, WEEK_MILESTONES)}
          label={t('profile.metrics.weeks')}
          sublabel={nextWeeks ? `alvo ${nextWeeks}` : 'máx'}
          color="#2DB6A3"
        />
      </View>

      {/* Submissions snapshot → full Submissions screen */}
      {(p.isMe || (submissions.data?.items.length ?? 0) > 0) && (
        <>
          <Pressable
            style={styles.snapHead}
            onPress={() => navigation.navigate('Submissions', { userId: targetId })}>
            <Text style={styles.sectionTitle}>{t('profile.submissions')}</Text>
            <MaterialCommunityIcons name="chevron-right" size={18} color={palette.textSecondary} />
          </Pressable>
          <View style={styles.card}>
            {(submissions.data?.items.length ?? 0) === 0 ? (
              <Text style={styles.muted}>{t('submissions.empty')}</Text>
            ) : (
              <>
                {submissions.data!.items.slice(0, 5).map((it) => {
                const s = submissionStyle(it.submission);
                const maxC = submissions.data!.items[0].count || 1;
                return (
                  <View key={it.submission} style={styles.snapRow}>
                    <View style={[styles.snapDot, { backgroundColor: s.color }]} />
                    <Text style={styles.snapName} numberOfLines={1}>
                      {s.label}
                    </Text>
                    <View style={styles.snapTrack}>
                      <View style={[styles.snapFill, { width: `${(it.count / maxC) * 100}%`, backgroundColor: s.color }]} />
                    </View>
                    <Text style={styles.snapCount}>{it.count}</Text>
                  </View>
                );
                })}
              </>
            )}
          </View>
        </>
      )}

      {/* Photos — horizontal feed (cover-cropped), first 6 then "Ver mais" reveals the rest */}
      {p.photos.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>{t('profile.photos')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow}>
            {(photosExpanded ? p.photos : p.photos.slice(0, 6)).map((ph, i) => (
              <Pressable key={ph.id} onPress={() => setPhotoIndex(i)} style={styles.photoTileWrap}>
                <Image source={{ uri: resolveMediaUrl(ph.url) }} style={styles.photoTile} resizeMode="cover" />
              </Pressable>
            ))}
          </ScrollView>
          {p.photos.length > 6 && (
            <Pressable style={styles.seeMore} onPress={() => setPhotosExpanded((v) => !v)}>
              <Text style={styles.seeMoreText}>{photosExpanded ? t('profile.seeLess') : t('profile.seeMore')}</Text>
              <MaterialCommunityIcons
                name={photosExpanded ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={palette.primary}
              />
            </Pressable>
          )}
        </>
      )}

      {/* Belt */}
      {p.belt && (
        <>
          <Text style={styles.sectionTitle}>{t('profile.belt')}</Text>
          <View style={styles.card}>
            <View style={styles.beltRow}>
              <View style={styles.beltVisual}>
                <BeltVisual color={p.belt.colorHex} rankBarColor={rankBarColorFor(p.belt.slug)} stripes={p.belt.stripes} height={26} />
              </View>
              <Text style={styles.beltName}>
                {p.belt.namePt}
                {p.belt.stripes > 0 ? ` · ${formatStripes(p.belt.stripes)}` : ''}
              </Text>
            </View>
          </View>
        </>
      )}

      {/* Medals */}
      {p.medals.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>{t('profile.medals')}</Text>
          <View style={styles.medalsCard}>
            <View style={styles.medalsGrid}>
              {p.medals.map((md) => {
                const style = competitionStyle(md.competition);
                return (
                  <View key={md.id} style={styles.medalItem}>
                    <MedalVisual competition={md.competition} tier={md.tier} count={md.count} size={64} />
                    <Text style={styles.medalLabel} numberOfLines={1}>
                      {style.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        </>
      )}

      {/* Gym(s) — under Conquistas, no card background */}
      {p.gym && (
        <>
          <Text style={styles.sectionTitle}>{t('profile.gym')}</Text>
          <View style={styles.gymRow}>
            {p.gym.logoUrl ? (
              <Image source={{ uri: resolveMediaUrl(p.gym.logoUrl) }} style={styles.gymLogo} resizeMode="cover" />
            ) : (
              <View style={[styles.gymLogo, styles.gymLogoFallback]}>
                <Text style={styles.gymAvatarText}>{initialsOf(p.gym.name)}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <View style={styles.gymNameRow}>
                <Text style={styles.gymName} numberOfLines={1}>
                  {p.gym.name}
                </Text>
                {p.gym.verified && <MaterialCommunityIcons name="check-decagram" size={15} color={palette.verified} />}
              </View>
              <View style={styles.gymStatsRow}>
                {p.gym.ratingCount > 0 ? (
                  <View style={styles.gymStat}>
                    <MaterialCommunityIcons name="star" size={13} color="#FACC15" />
                    <Text style={styles.gymStatText}>
                      {p.gym.ratingAverage.toFixed(1)} ({p.gym.ratingCount})
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.gymStatText}>{t('profile.gym.noReviews')}</Text>
                )}
                <Text style={styles.gymStatText}>· {tf('profile.gym.members', { n: p.gym.memberCount })}</Text>
              </View>
              <Text style={styles.gymMeta}>{[p.gym.city, t(`gym.role.${p.gym.role}`)].filter(Boolean).join(' · ')}</Text>
            </View>
          </View>
        </>
      )}

      {/* Certificate */}
      {p.certificateUrl && (
        <>
          <Text style={styles.sectionTitle}>{t('profile.certificate')}</Text>
          <Pressable style={styles.certCard} onPress={() => setCertOpen(true)}>
            <Image source={{ uri: resolveMediaUrl(p.certificateUrl) }} style={styles.certImage} resizeMode="cover" />
          </Pressable>
        </>
      )}

      {/* Journey / achievements — first 6, rest behind "Ver mais" */}
      <Text style={styles.sectionTitle}>{t('profile.achievements')}</Text>
      <View style={styles.card}>
        {timeline.length === 0 ? (
          <Text style={styles.muted}>{t('profile.achievements.empty')}</Text>
        ) : (
          (journeyExpanded ? timeline : timeline.slice(0, 6)).map((item, i, arr) => (
            <View key={i} style={styles.tlRow}>
              <View style={styles.tlRail}>
                <View style={styles.tlDot}>
                  <MaterialCommunityIcons name={TL_ICON[item.type] ?? 'star'} size={11} color="#fff" />
                </View>
                {i < arr.length - 1 && <View style={styles.tlLine} />}
              </View>
              <View style={styles.tlBody}>
                <Text style={styles.tlTitle}>{timelineText(item)}</Text>
                <Text style={styles.tlDate}>{eventDate(item.occurredAt)}</Text>
              </View>
            </View>
          ))
        )}
        {timeline.length > 6 && (
          <Pressable style={styles.seeMoreInline} onPress={() => setJourneyExpanded((v) => !v)}>
            <Text style={styles.seeMoreText}>{journeyExpanded ? t('profile.seeLess') : t('profile.seeMore')}</Text>
            <MaterialCommunityIcons
              name={journeyExpanded ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={palette.primary}
            />
          </Pressable>
        )}
      </View>

      {p.isMe && (
        <Button
          mode="contained"
          icon="pencil"
          style={styles.editBottomBtn}
          contentStyle={styles.actionContent}
          onPress={() => navigation.navigate('EditUserProfile')}>
          {t('profile.edit')}
        </Button>
      )}

      <ImageLightbox urls={p.photos.map((ph) => ph.url)} index={photoIndex} onClose={() => setPhotoIndex(null)} />
      <ImageLightbox urls={p.avatarUrl ? [p.avatarUrl] : []} index={lightAvatar ? 0 : null} onClose={() => setLightAvatar(false)} />
      <ImageLightbox urls={p.certificateUrl ? [p.certificateUrl] : []} index={certOpen ? 0 : null} onClose={() => setCertOpen(false)} />

      {/* Graduar sheet (staff) */}
      <Modal visible={sheetOpen} transparent animationType="slide" onRequestClose={() => setSheetOpen(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setSheetOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => undefined}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{t('member.promote.title')}</Text>
            {memberEntry && (
              <Text style={styles.gradProgress}>
                {tf('member.progress.classes', { n: memberEntry.classesAttended, m: gradTarget })}
              </Text>
            )}
            {selectedBelt && (
              <View style={styles.preview}>
                <BeltVisual color={selectedBelt.color} rankBarColor={rankBarColorFor(selectedBelt.slug)} stripes={stripes} height={40} />
                <Text style={styles.previewLabel}>
                  {selectedBelt.namePt}
                  {stripes > 0 ? ` · ${formatStripes(stripes)}` : ''}
                </Text>
              </View>
            )}
            <Text style={styles.sheetLabel}>{t('member.promote.belt')}</Text>
            <View style={styles.beltChips}>
              {ALL_BELTS.map((b) => {
                const on = beltSlug === b.slug;
                return (
                  <Pressable
                    key={b.slug}
                    style={[styles.beltChip, on && styles.beltChipOn]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setBeltSlug(b.slug);
                      setStripes((s) => Math.min(s, maxStripesFor(b.slug)));
                    }}>
                    <View style={[styles.beltDot, { backgroundColor: b.color }]} />
                    <Text style={[styles.beltChipText, on && styles.beltChipTextOn]}>{b.namePt}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.sheetLabel}>{t('member.promote.stripes')}</Text>
            <View style={styles.stripesRow}>
              <IconButton icon="minus" size={20} iconColor={palette.textPrimary} onPress={() => changeStripes(-1)} accessibilityLabel={t('a11y.decrease')} />
              <Text style={styles.stripesNum}>{stripes}</Text>
              <IconButton icon="plus" size={20} iconColor={palette.primary} onPress={() => changeStripes(1)} accessibilityLabel={t('a11y.increase')} />
            </View>
            <Button
              mode="contained"
              onPress={() => promote.mutate()}
              loading={promote.isPending}
              disabled={!beltSlug || promote.isPending}
              contentStyle={styles.actionContent}>
              {t('member.promote.confirm')}
            </Button>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = makeStyles(() => ({
  container: { flex: 1, backgroundColor: palette.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.background },
  skeletonWrap: { flex: 1, backgroundColor: palette.background, paddingHorizontal: 20, alignItems: 'center' },
  skeletonBanner: { position: 'absolute', top: 0, left: 0, right: 0 },
  content: { padding: 20, paddingBottom: 40 },
  muted: { color: palette.textSecondary, fontSize: 13 },
  banner: { position: 'absolute', top: 0, left: 0, right: 0, height: 110 },
  header: { alignItems: 'center', marginTop: 16, marginBottom: 14 },
  avatar: { width: 92, height: 92, borderRadius: 46, marginBottom: 10, borderWidth: 3, borderColor: palette.background },
  avatarFallback: { backgroundColor: palette.surfaceVariant, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: palette.textPrimary, fontWeight: 'bold', fontSize: 30 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { color: palette.textPrimary, fontWeight: 'bold', flexShrink: 1 },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: palette.pro,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  proText: { color: '#0D0D10', fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  handle: { color: palette.textSecondary, fontSize: 12, marginTop: 3 },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  beltMini: { width: 38 },
  since: { color: palette.textSecondary, fontSize: 12 },
  metaChips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 10 },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: palette.surface, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  metaChipText: { color: palette.textSecondary, fontSize: 12, fontWeight: '600' },
  statsRow: {
    flexDirection: 'row',
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: palette.outline,
    marginBottom: 16,
  },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { color: palette.textPrimary, fontSize: 20, fontWeight: 'bold' },
  statLabel: { color: palette.textSecondary, fontSize: 11, marginTop: 2 },
  actionBtn: { marginBottom: 16 },
  actionContent: { paddingVertical: 5 },
  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  actionFlex: { flex: 1 },
  editBottomBtn: { marginTop: 8, marginBottom: 4 },
  seeMore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    marginBottom: 16,
  },
  seeMoreInline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingTop: 8 },
  seeMoreText: { color: palette.primary, fontSize: 12, fontWeight: '600' },
  graduarBtn: { marginTop: -6, marginBottom: 16, borderRadius: 12 },
  bio: { color: '#E4E4E7', fontSize: 13, lineHeight: 19, marginBottom: 16 },
  bioEmpty: { color: palette.textSecondary, fontSize: 13, fontStyle: 'italic', marginBottom: 16 },
  sectionTitle: { color: palette.textPrimary, fontSize: 13, fontWeight: 'bold', marginBottom: 10 },
  card: { backgroundColor: palette.surface, borderRadius: 16, padding: 16, marginBottom: 16 },
  beltRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  beltVisual: { width: 90 },
  beltName: { color: palette.textPrimary, fontSize: 14, fontWeight: '600', flex: 1 },
  metricsCard: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: palette.surface,
    borderRadius: 16,
    paddingVertical: 18,
    marginBottom: 16,
  },
  snapHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  snapRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 },
  snapDot: { width: 11, height: 11, borderRadius: 6 },
  snapName: { color: palette.textPrimary, fontSize: 13, width: 110 },
  snapTrack: { flex: 1, height: 6, borderRadius: 999, backgroundColor: palette.surfaceVariant, overflow: 'hidden' },
  snapFill: { height: '100%', borderRadius: 999 },
  snapCount: { color: palette.textPrimary, fontSize: 13, fontWeight: 'bold', minWidth: 18, textAlign: 'right' },
  photoRow: { gap: 8, paddingVertical: 2, paddingRight: 8, marginBottom: 12 },
  photoTileWrap: { width: 124, height: 165 },
  photoTile: { width: '100%', height: '100%', borderRadius: 10, backgroundColor: palette.surfaceVariant },
  gymRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  gymLogo: { width: 52, height: 52, borderRadius: 14, backgroundColor: palette.surfaceVariant },
  gymLogoFallback: { alignItems: 'center', justifyContent: 'center' },
  gymAvatarText: { color: palette.textPrimary, fontWeight: 'bold', fontSize: 16 },
  gymNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  gymName: { color: palette.textPrimary, fontSize: 15, fontWeight: 'bold', flexShrink: 1 },
  gymStatsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  gymStat: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  gymStatText: { color: palette.textSecondary, fontSize: 12 },
  gymMeta: { color: palette.textSecondary, fontSize: 12, marginTop: 2 },
  medalsCard: { backgroundColor: palette.surface, borderRadius: 16, padding: 16, marginBottom: 16 },
  medalsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 18 },
  medalItem: { width: '31%', alignItems: 'center' },
  medalLabel: { color: palette.textPrimary, fontSize: 12, fontWeight: 'bold', textAlign: 'center', marginTop: 8 },
  certCard: { borderRadius: 16, overflow: 'hidden', marginBottom: 16, backgroundColor: palette.surfaceVariant },
  certImage: { width: '100%', height: 200 },
  tlRow: { flexDirection: 'row', gap: 12 },
  tlRail: { alignItems: 'center', width: 22 },
  tlDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tlLine: { flex: 1, width: 2, backgroundColor: palette.surfaceVariant, marginVertical: 2 },
  tlBody: { flex: 1, paddingBottom: 16 },
  tlTitle: { color: palette.textPrimary, fontSize: 13, fontWeight: '600' },
  tlDate: { color: palette.textSecondary, fontSize: 11, marginTop: 2 },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: palette.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32 },
  sheetHandle: { width: 36, height: 4, borderRadius: 999, backgroundColor: palette.outline, alignSelf: 'center', marginBottom: 12 },
  sheetTitle: { color: palette.textPrimary, fontSize: 15, fontWeight: 'bold', textAlign: 'center', marginBottom: 6 },
  gradProgress: { color: palette.textSecondary, fontSize: 12, textAlign: 'center', marginBottom: 12 },
  preview: { gap: 8, marginBottom: 16, alignItems: 'center' },
  previewLabel: { color: palette.textPrimary, fontSize: 13, fontWeight: 'bold', textTransform: 'capitalize' },
  sheetLabel: { color: palette.textSecondary, fontSize: 12, marginBottom: 8 },
  beltChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  beltChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: palette.surfaceVariant,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  beltChipOn: { backgroundColor: palette.primary },
  beltChipText: { color: palette.textSecondary, fontSize: 12 },
  beltChipTextOn: { color: '#fff', fontWeight: 'bold' },
  beltDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.3)' },
  stripesRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 16 },
  stripesNum: { color: palette.textPrimary, fontSize: 18, fontWeight: 'bold', minWidth: 24, textAlign: 'center' },
}));
