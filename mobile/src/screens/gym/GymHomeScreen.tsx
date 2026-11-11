import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Image, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, IconButton, Menu, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Gym,
  GymMember,
  GymRole,
  getGymMembers,
  getGymSuggestions,
  getMyGym,
  leaveGym,
  setMyGymRole,
} from '../../api/gyms';
import { resolveMediaUrl } from '../../api/posts';
import BeltVisual, { formatStripes } from '../../components/BeltVisual';
import { rankBarColorFor } from '../../constants/belts';
import { t, TranslationKey } from '../../i18n';
import { GymStackParamList } from '../../navigation/GymNavigator';
import { makeStyles, palette } from '../../theme/theme';
import AgendaScreen from './AgendaScreen';
import MercadoScreen from './MercadoScreen';
import MuralFeed from './MuralFeed';
import RankingScreen from './RankingScreen';

type Nav = NativeStackNavigationProp<GymStackParamList, 'GymHome'>;

type GymSection = 'mural' | 'agenda' | 'members' | 'market' | 'ranking';

/** The three everyday sections; Mercado and Ranking open from the ⋯ menu. */
const MAIN_SECTIONS: { key: GymSection; label: TranslationKey }[] = [
  { key: 'mural', label: 'gym.tab.mural' },
  { key: 'agenda', label: 'gym.tab.agenda' },
  { key: 'members', label: 'gym.tab.members' },
];

const EXTRA_SECTIONS: Partial<Record<GymSection, TranslationKey>> = {
  market: 'gym.tab.market',
  ranking: 'gym.tab.ranking',
};

function roleLabel(role: GymRole): string {
  if (role === 'OWNER') return t('gym.role.OWNER');
  if (role === 'INSTRUCTOR') return t('gym.role.INSTRUCTOR');
  return t('gym.role.MEMBER');
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export default function GymHomeScreen() {
  const insets = useSafeAreaInsets();
  const myGym = useQuery({ queryKey: ['myGym'], queryFn: getMyGym });

  if (myGym.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      {myGym.data ? <GymView gym={myGym.data} /> : <NoGymView />}
    </View>
  );
}

function NoGymView() {
  const navigation = useNavigation<Nav>();
  const suggestions = useQuery({ queryKey: ['gymSuggestions'], queryFn: getGymSuggestions });

  return (
    <ScrollView contentContainerStyle={styles.noGymContent}>
      <View style={styles.noGymIcon}>
        <MaterialCommunityIcons name="town-hall" size={30} color={palette.primary} />
      </View>
      <Text variant="titleMedium" style={styles.noGymTitle}>
        {t('gym.none.title')}
      </Text>
      <Text variant="bodyMedium" style={styles.noGymSubtitle}>
        {t('gym.none.subtitle')}
      </Text>

      <Button
        mode="contained"
        style={styles.noGymButton}
        contentStyle={styles.buttonContent}
        onPress={() => navigation.navigate('JoinGym')}>
        {t('gym.none.join')}
      </Button>
      <Button
        mode="outlined"
        style={styles.noGymButton}
        contentStyle={styles.buttonContent}
        textColor={palette.textPrimary}
        onPress={() => navigation.navigate('CreateGym')}>
        {t('gym.none.create')}
      </Button>

      {(suggestions.data?.length ?? 0) > 0 && (
        <>
          <Text variant="bodySmall" style={styles.nearbyTitle}>
            {t('gym.none.nearby')}
          </Text>
          {suggestions.data!.map((g) => (
            <View key={g.id} style={styles.nearbyRow}>
              <View style={styles.nearbyAvatar}>
                <Text style={styles.nearbyAvatarText}>{initialsOf(g.name)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.nearbyName}>{g.name}</Text>
                <Text style={styles.nearbyMeta}>
                  {[g.city, `${g.memberCount} ${t('home.suggestions.members')}`]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const ROLE_CYCLE: GymRole[] = ['MEMBER', 'INSTRUCTOR', 'OWNER'];

function GymView({ gym }: { gym: Gym }) {
  const navigation = useNavigation<Nav>();
  const queryClient = useQueryClient();
  // Opens on the wall: what's new at the gym is the most common reason to come here.
  const [activeTab, setActiveTab] = useState<GymSection>('mural');
  const [menuVisible, setMenuVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const staff = gym.role === 'OWNER' || gym.role === 'INSTRUCTOR';

  const copyCode = async () => {
    setMenuVisible(false);
    if (!gym.inviteCode) return;
    await Clipboard.setStringAsync(gym.inviteCode);
    Haptics.selectionAsync();
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const changeRole = useMutation({
    mutationFn: () =>
      setMyGymRole(ROLE_CYCLE[(ROLE_CYCLE.indexOf(gym.role) + 1) % ROLE_CYCLE.length]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myGym'] });
      queryClient.invalidateQueries({ queryKey: ['gymMembers'] });
    },
  });

  const leave = useMutation({
    mutationFn: leaveGym,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myGym'] });
      queryClient.invalidateQueries({ queryKey: ['gymSuggestions'] });
      queryClient.invalidateQueries({ queryKey: ['gymMembers'] });
    },
  });

  const confirmLeave = () => {
    setMenuVisible(false);
    Alert.alert(t('gym.leave.title'), t('gym.leave.message'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('gym.leave.ok'), style: 'destructive', onPress: () => leave.mutate() },
    ]);
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.header}>
        <Pressable
          style={styles.headerTap}
          onPress={() => navigation.navigate('GymProfile')}>
          {gym.logoUrl ? (
            <Image
              source={{ uri: resolveMediaUrl(gym.logoUrl) }}
              style={styles.gymAvatar}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.gymAvatar, styles.gymAvatarFallback]}>
              <Text style={styles.gymAvatarText}>{initialsOf(gym.name)}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <View style={styles.gymNameRow}>
              <Text variant="titleMedium" style={styles.gymName}>
                {gym.name}
              </Text>
              {gym.verified && (
                <MaterialCommunityIcons name="check-decagram" size={16} color={palette.verified} />
              )}
            </View>
            <Text style={styles.gymMeta}>
              {gym.memberCount} {t('home.suggestions.members')}
            </Text>
          </View>
        </Pressable>
        {/* Role switching is a development tool (the server only allows it in dev). */}
        {__DEV__ && (
          <Pressable
            style={styles.roleChip}
            onPress={() => changeRole.mutate()}
            disabled={changeRole.isPending}
            accessibilityHint={t('gym.role.testHint')}>
            <Text style={styles.roleChipText}>{roleLabel(gym.role)}</Text>
            <MaterialCommunityIcons name="swap-horizontal" size={13} color={palette.textSecondary} />
          </Pressable>
        )}
        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={
            <IconButton
              icon="dots-horizontal"
              iconColor={palette.textSecondary}
              size={22}
              onPress={() => setMenuVisible(true)}
              accessibilityLabel={t('a11y.more')}
            />
          }>
          <Menu.Item
            onPress={() => {
              setMenuVisible(false);
              setActiveTab('market');
            }}
            title={t('gym.tab.market')}
            leadingIcon="storefront-outline"
          />
          <Menu.Item
            onPress={() => {
              setMenuVisible(false);
              setActiveTab('ranking');
            }}
            title={t('gym.tab.ranking')}
            leadingIcon="trophy-outline"
          />
          {staff && gym.inviteCode && (
            <Menu.Item onPress={copyCode} title={t('gym.invite.copy')} leadingIcon="key-variant" />
          )}
          <Menu.Item
            onPress={() => {
              setMenuVisible(false);
              navigation.navigate('GymProfile');
            }}
            title={t('gymProfile.title')}
            leadingIcon="information-outline"
          />
          {gym.role === 'OWNER' && (
            <Menu.Item
              onPress={() => {
                setMenuVisible(false);
                navigation.navigate('GymSettings');
              }}
              title={t('gym.settings.title')}
              leadingIcon="cog-outline"
            />
          )}
          <Menu.Item onPress={confirmLeave} title={t('gym.leave.title')} leadingIcon="exit-to-app" />
        </Menu>
      </View>

      {copied && (
        <View style={styles.inviteRow}>
          <MaterialCommunityIcons name="check" size={14} color="#4ADE80" />
          <Text style={styles.inviteText}>
            {t('gym.invite.copied')}: <Text style={styles.inviteCode}>{gym.inviteCode}</Text>
          </Text>
        </View>
      )}

      {EXTRA_SECTIONS[activeTab] ? (
        <View style={styles.extraHead}>
          <Pressable
            onPress={() => setActiveTab('mural')}
            hitSlop={8}
            style={styles.extraBack}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}>
            <MaterialCommunityIcons name="arrow-left" size={20} color={palette.textPrimary} />
          </Pressable>
          <Text style={styles.extraTitle}>{t(EXTRA_SECTIONS[activeTab]!)}</Text>
        </View>
      ) : (
        <View style={styles.segment} accessibilityRole="tablist">
          {MAIN_SECTIONS.map((section) => {
            const active = activeTab === section.key;
            return (
              <Pressable
                key={section.key}
                onPress={() => setActiveTab(section.key)}
                style={[styles.segmentItem, active && styles.segmentItemActive]}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                aria-selected={active}>
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{t(section.label)}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {activeTab === 'members' ? (
        <MembersList gym={gym} />
      ) : activeTab === 'mural' ? (
        <MuralFeed gym={gym} />
      ) : activeTab === 'agenda' ? (
        <AgendaScreen gym={gym} />
      ) : activeTab === 'market' ? (
        <MercadoScreen gym={gym} />
      ) : activeTab === 'ranking' ? (
        <RankingScreen />
      ) : (
        <ComingSoon />
      )}
    </View>
  );
}

function MembersList({ gym }: { gym: Gym }) {
  const navigation = useNavigation<Nav>();
  const members = useQuery({ queryKey: ['gymMembers'], queryFn: getGymMembers });
  const staff = gym.role === 'OWNER' || gym.role === 'INSTRUCTOR';
  const target = gym.graduationTarget || 40;

  // Instructors/owners tap a student straight into the admin panel; plain members
  // open the public profile.
  const openMember = (userId: number) =>
    staff
      ? navigation.navigate('StudentManagement', { userId })
      : navigation.navigate('MemberProfile', { userId });

  if (members.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.membersContent}
      refreshControl={
        <RefreshControl
          refreshing={members.isRefetching}
          onRefresh={() => members.refetch()}
          tintColor={palette.primary}
        />
      }>
      {members.data?.map((m: GymMember) => {
        const ready = m.classesAttended >= target;
        return (
          <Pressable
            key={m.userId}
            style={styles.memberRow}
            onPress={() => openMember(m.userId)}>
            <View style={styles.memberAvatar}>
              <Text style={styles.memberAvatarText}>{initialsOf(m.displayName)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.memberName}>
                {m.displayName}
                {m.role !== 'MEMBER' && (
                  <Text style={styles.memberRoleInline}> · {roleLabel(m.role)}</Text>
                )}
              </Text>
              {m.belt && (
                <View style={styles.memberBeltRow}>
                  <View style={styles.memberBelt}>
                    <BeltVisual
                      color={m.belt.colorHex}
                      rankBarColor={rankBarColorFor(m.belt.slug)}
                      stripes={m.belt.stripes}
                      height={9}
                    />
                  </View>
                  {staff ? (
                    <>
                      <View style={styles.memberProgressTrack}>
                        <View
                          style={[
                            styles.memberProgressFill,
                            { width: `${Math.min(100, (m.classesAttended / target) * 100)}%` },
                            ready && styles.memberProgressReady,
                          ]}
                        />
                      </View>
                      <Text style={[styles.memberBeltLabel, ready && styles.memberReadyLabel]}>
                        {ready ? 'Pronto!' : `${m.classesAttended}/${target}`}
                      </Text>
                    </>
                  ) : (
                    <Text style={styles.memberBeltLabel}>
                      {m.belt.namePt}
                      {m.belt.stripes > 0 ? ` · ${formatStripes(m.belt.stripes)}` : ''}
                    </Text>
                  )}
                </View>
              )}
            </View>
            {staff ? (
              <Text style={styles.graduarLink}>{t('member.promote')}</Text>
            ) : (
              <MaterialCommunityIcons name="chevron-right" size={18} color={palette.textSecondary} />
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function ComingSoon() {
  return (
    <View style={styles.center}>
      <MaterialCommunityIcons name="hammer" size={36} color={palette.surfaceVariant} />
      <Text style={styles.soon}>{t('gym.soon')}</Text>
    </View>
  );
}

const styles = makeStyles(() => ({
  segment: {
    flexDirection: 'row',
    backgroundColor: palette.surface,
    borderRadius: 12,
    padding: 3,
    marginTop: 4,
    marginBottom: 14,
  },
  segmentItem: { flex: 1, minHeight: 38, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  segmentItemActive: { backgroundColor: palette.surfaceVariant },
  segmentText: { color: palette.textSecondary, fontSize: 14, fontWeight: '600' },
  segmentTextActive: { color: palette.textPrimary },
  extraHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4, marginBottom: 14 },
  extraBack: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.surface },
  extraTitle: { color: palette.textPrimary, fontSize: 17, fontWeight: 'bold' },
  container: { flex: 1, backgroundColor: palette.background, paddingHorizontal: 20 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 40 },
  soon: { color: palette.textSecondary },
  buttonContent: { paddingVertical: 6 },

  noGymContent: { paddingBottom: 32, alignItems: 'stretch' },
  noGymIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: 16,
    marginBottom: 14,
  },
  noGymTitle: { color: palette.textPrimary, fontWeight: 'bold', textAlign: 'center' },
  noGymSubtitle: {
    color: palette.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  noGymButton: { marginBottom: 10, borderColor: palette.outline },
  nearbyTitle: { color: palette.textSecondary, marginTop: 16, marginBottom: 8 },
  nearbyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: palette.surface,
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
  },
  nearbyAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: palette.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nearbyAvatarText: { color: palette.textPrimary, fontWeight: 'bold', fontSize: 12 },
  nearbyName: { color: palette.textPrimary, fontSize: 13, fontWeight: 'bold' },
  nearbyMeta: { color: palette.textSecondary, fontSize: 11, marginTop: 2 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 10 },
  headerTap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  gymAvatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
  },
  gymAvatarFallback: {
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gymAvatarText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  gymNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  gymName: { color: palette.textPrimary, fontWeight: 'bold' },
  gymMeta: { color: palette.textSecondary, fontSize: 12 },
  roleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: palette.surfaceVariant,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  roleChipText: { color: palette.textSecondary, fontSize: 11 },
  inviteRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  inviteText: { color: palette.textSecondary, fontSize: 12 },
  inviteCode: { color: palette.textPrimary, fontWeight: 'bold', letterSpacing: 1 },

  membersContent: { paddingBottom: 24 },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: palette.surfaceVariant,
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: palette.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarText: { color: palette.textPrimary, fontWeight: 'bold', fontSize: 15 },
  memberName: { color: palette.textPrimary, fontSize: 15, fontWeight: 'bold' },
  memberRoleInline: { color: palette.primary, fontSize: 11, fontWeight: 'normal' },
  memberBeltRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  memberBelt: { width: 56 },
  memberBeltLabel: { color: palette.textSecondary, fontSize: 11 },
  memberProgressTrack: {
    width: 64,
    height: 6,
    borderRadius: 999,
    backgroundColor: palette.surfaceVariant,
    overflow: 'hidden',
  },
  memberProgressFill: { height: '100%', backgroundColor: palette.primary },
  memberProgressReady: { backgroundColor: '#16A34A' },
  memberReadyLabel: { color: '#4ADE80', fontWeight: 'bold' },
  graduarLink: { color: palette.primary, fontSize: 11, fontWeight: 'bold' },
}));
