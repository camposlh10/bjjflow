import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, View } from 'react-native';
import { Text } from 'react-native-paper';
import Animated, {
  Easing,
  FadeIn,
  FadeOutUp,
  SlideInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Match, getMatches } from '../../api/compete';
import { t, tf } from '../../i18n';
import { openMatch } from '../../navigation/navigationRef';
import { useAuthStore } from '../../store/authStore';
import { makeStyles, palette } from '../../theme/theme';
import { Avatar } from '../CommunityFeed';
import Icon from '../Icon';
import { firstName } from './MatchParts';
import { useCompeteActions } from './useCompete';

const DISMISSED_KEY = 'bjjflow.challengeInvites.dismissed';

function hoursLeft(iso: string): string {
  const ms = Date.parse(iso) - Date.now();
  const h = Math.floor(ms / 3_600_000);
  return h >= 1 ? `${h} h` : `${Math.max(1, Math.floor(ms / 60_000))} min`;
}

/** The crossed swords, rocking for a moment when the invite lands. */
function Swords() {
  const r = useSharedValue(0);
  useEffect(() => {
    r.value = withRepeat(
      withSequence(withTiming(-14, { duration: 90 }), withTiming(14, { duration: 120 }), withTiming(0, { duration: 90 })),
      3,
      false,
    );
  }, [r]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${r.value}deg` }] }));
  return (
    <Animated.View style={[styles.swords, style]}>
      <Icon name="karate" size={15} color="#FFFFFF" strokeWidth={2.25} />
    </Animated.View>
  );
}

function OptionRow({ icon, title, sub, onPress, danger }: { icon: Parameters<typeof Icon>[0]['name']; title: string; sub: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable style={({ pressed }) => [styles.option, pressed && { opacity: 0.7 }]} onPress={onPress} accessibilityRole="button">
      <Icon name={icon} size={20} color={danger ? palette.primary : palette.textSecondary} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.optionTitle, danger && { color: palette.primary }]}>{title}</Text>
        <Text style={styles.optionSub}>{sub}</Text>
      </View>
    </Pressable>
  );
}

/**
 * A challenge someone sent you, dropped in from the top wherever you are in the
 * app: accept, decline, or under "more" silence them for a week, block their
 * challenges, or ignore it for now (it stays in Partidas until it expires).
 * Shows the newest unanswered challenge you haven't ignored.
 */
export default function ChallengeInvite() {
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.user?.id);
  const [dismissed, setDismissed] = useState<number[] | null>(null);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const shown = useRef<number | null>(null);
  const actions = useCompeteActions();

  const matches = useQuery({ queryKey: ['matches'], queryFn: getMatches, enabled: !!userId, refetchInterval: 120_000 });

  useEffect(() => {
    AsyncStorage.getItem(DISMISSED_KEY)
      .then((raw) => setDismissed(raw ? (JSON.parse(raw) as number[]) : []))
      .catch(() => setDismissed([]));
  }, []);

  // Back in the app: look for challenges that arrived as a push meanwhile.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') matches.refetch();
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const invite: Match | undefined = useMemo(() => {
    // Only fresh data: a cached list from last time may hold answered challenges.
    if (!dismissed || !matches.isFetchedAfterMount) return undefined;
    return (matches.data?.incoming ?? []).find(
      (m) => m.status === 'PENDING' && !dismissed.includes(m.id) && (!m.expiresAt || Date.parse(m.expiresAt) > Date.now()),
    );
  }, [matches.data, matches.isFetchedAfterMount, dismissed]);

  useEffect(() => {
    if (invite && shown.current !== invite.id) {
      shown.current = invite.id;
      setMore(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  }, [invite]);

  if (!invite) return null;

  const them = invite.challenger;
  const name = firstName(them);
  const win = invite.stake?.opponentWin ?? 0;
  const loss = invite.stake?.challengerWin ?? 0;

  const ignore = () => {
    const next = [...(dismissed ?? []), invite.id].slice(-50);
    setDismissed(next);
    void AsyncStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
  };
  const respond = async (action: 'accept' | 'decline' | 'silence' | 'block') => {
    setBusy(true);
    Haptics.selectionAsync();
    try {
      if (action === 'accept') {
        await actions.acceptAsync(invite.id);
        openMatch(invite.id);
      } else {
        await actions.respondAsync(invite.id, action);
      }
    } catch {
      // The hook already showed what went wrong.
    } finally {
      setBusy(false);
    }
  };

  return (
    <Animated.View
      key={invite.id}
      entering={SlideInUp.springify().damping(16)}
      exiting={FadeOutUp.duration(200)}
      style={[styles.wrap, { top: insets.top + 8 }]}
      pointerEvents="box-none">
      <View style={styles.card} accessibilityRole="alert">
        <View style={styles.head}>
          <View>
            <Avatar name={them.displayName} url={them.avatarUrl} size={52} />
            <Swords />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>
              {t('compete.invite.label').toUpperCase()} · {t('compete.match.firstTo3').toUpperCase()}
            </Text>
            <Text style={styles.title} numberOfLines={1}>
              {tf('compete.match.challengedYou', { name })}
            </Text>
            <Text style={styles.sub} numberOfLines={1}>
              {t('compete.rating')} {them.rating}
              {invite.expiresAt ? ` · ${tf('compete.match.expiresIn', { time: hoursLeft(invite.expiresAt) })}` : ''}
            </Text>
          </View>
          <Pressable onPress={ignore} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('compete.invite.ignore')}>
            <Icon name="close" size={22} color={palette.textSecondary} />
          </Pressable>
        </View>

        <Text style={styles.stake}>{tf('compete.invite.stake', { win, loss })}</Text>

        {busy ? (
          <ActivityIndicator style={{ marginVertical: 12 }} color={palette.primary} />
        ) : (
          <View style={styles.buttons}>
            <Pressable
              style={({ pressed }) => [styles.more, more && styles.moreOn, pressed && { opacity: 0.8 }]}
              onPress={() => setMore((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={t('compete.invite.more')}
              accessibilityState={{ expanded: more }}>
              <Icon name="dots-horizontal" size={22} color={palette.textPrimary} />
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.decline, pressed && { opacity: 0.8 }]}
              onPress={() => respond('decline')}
              accessibilityRole="button">
              <Text style={styles.declineText}>{t('compete.match.decline')}</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.accept, pressed && { opacity: 0.85 }]}
              onPress={() => respond('accept')}
              accessibilityRole="button">
              <Icon name="karate" size={18} color="#FFFFFF" />
              <Text style={styles.acceptText}>{t('compete.match.accept')}</Text>
            </Pressable>
          </View>
        )}

        {more && !busy && (
          <Animated.View entering={FadeIn.duration(180).easing(Easing.out(Easing.quad))} style={styles.options}>
            <OptionRow icon="bell-off-outline" title={t('compete.invite.silence')} sub={tf('compete.invite.silenceSub', { name })} onPress={() => respond('silence')} />
            <OptionRow icon="cancel" title={tf('compete.invite.block', { name })} sub={tf('compete.invite.blockSub', { name })} onPress={() => respond('block')} danger />
            <OptionRow icon="clock-outline" title={t('compete.invite.ignore')} sub={t('compete.invite.ignoreSub')} onPress={ignore} />
          </Animated.View>
        )}
      </View>
    </Animated.View>
  );
}

const styles = makeStyles(() => ({
  wrap: { position: 'absolute', left: 12, right: 12, zIndex: 1100, elevation: 14 },
  card: {
    backgroundColor: palette.surface,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: palette.primary,
    padding: 14,
    shadowColor: palette.primary,
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  swords: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: palette.primary,
    borderWidth: 2,
    borderColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { color: palette.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  title: { color: palette.textPrimary, fontSize: 17, fontWeight: '800', marginTop: 2 },
  sub: { color: palette.textSecondary, fontSize: 13, marginTop: 1 },
  stake: { color: palette.textPrimary, fontSize: 13, fontWeight: '600', marginTop: 10 },
  buttons: { flexDirection: 'row', gap: 8, marginTop: 12 },
  more: {
    width: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.outline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreOn: { backgroundColor: palette.surfaceVariant },
  decline: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.outline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineText: { color: palette.textPrimary, fontSize: 15, fontWeight: '700' },
  accept: {
    flex: 1.4,
    height: 46,
    borderRadius: 12,
    backgroundColor: palette.primary,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  options: { marginTop: 10, borderTopWidth: 1, borderTopColor: palette.surfaceVariant, paddingTop: 4 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  optionTitle: { color: palette.textPrimary, fontSize: 14, fontWeight: '700' },
  optionSub: { color: palette.textSecondary, fontSize: 12, marginTop: 1 },
}));
