import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { AxiosError } from 'axios';

import { apiErrorMessage } from '../../api/auth';
import {
  BlockedReason,
  COMPETE_KEYS,
  Match,
  MatchAction,
  Player,
  challenge,
  matchAction,
  postMatch,
  repostMatch,
} from '../../api/compete';
import { t, tf } from '../../i18n';
import { firstName } from './MatchParts';

export function blockedMessage(reason: BlockedReason, them: Pick<Player, 'displayName'>): string | null {
  if (reason === 'SELF') return null;
  return tf(`compete.blocked.${reason}` as 'compete.blocked.DISABLED', { name: firstName(them as Player) });
}

/** The server's refusal of a challenge, as a sentence (CHALLENGE_<reason> codes). */
function challengeError(error: unknown, them: Player): string {
  const code = (error as AxiosError<{ code?: string }>)?.response?.data?.code ?? '';
  if (code.startsWith('CHALLENGE_') && code !== 'CHALLENGE_EXPIRED') {
    return blockedMessage(code.slice('CHALLENGE_'.length) as BlockedReason, them) ?? apiErrorMessage(error);
  }
  return apiErrorMessage(error);
}

/**
 * Challenge, accept/decline/cancel/forfeit, post and repost, with the
 * confirmations they need. Every success refreshes ratings, rankings and matches.
 */
export function useCompeteActions(onMatch?: (m: Match) => void) {
  const queryClient = useQueryClient();
  const refresh = () => {
    for (const key of COMPETE_KEYS) queryClient.invalidateQueries({ queryKey: [key] });
  };

  const send = useMutation({
    mutationFn: (them: Player) => challenge(them.id),
    onSuccess: (m, them) => {
      refresh();
      Alert.alert(tf('compete.challenge.sent', { name: firstName(them) }));
      onMatch?.(m);
    },
    onError: (e, them) => Alert.alert(challengeError(e, them)),
  });

  const act = useMutation({
    mutationFn: (v: { id: number; action: MatchAction }) => matchAction(v.id, v.action),
    onSuccess: (m) => {
      refresh();
      queryClient.setQueryData(['match', m.id], (old: Match | undefined) => (old ? { ...old, ...m, timeline: old.timeline } : m));
    },
    onError: (e) => Alert.alert(apiErrorMessage(e)),
  });

  const post = useMutation({
    mutationFn: (id: number) => postMatch(id),
    onSuccess: refresh,
    onError: (e) => Alert.alert(apiErrorMessage(e)),
  });

  const repost = useMutation({
    mutationFn: (postId: number) => repostMatch(postId),
    onSuccess: refresh,
    onError: (e) => Alert.alert(apiErrorMessage(e)),
  });

  return {
    /** Asks first: the rules and that the opponent sees proof photos. */
    challenge: (them: Player) =>
      Alert.alert(tf('compete.challenge.confirm.title', { name: firstName(them) }), t('compete.challenge.confirm.body'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('compete.challenge'), onPress: () => send.mutate(them) },
      ]),
    challenging: send.isPending,
    accept: (id: number) => act.mutate({ id, action: 'accept' }),
    decline: (id: number) => act.mutate({ id, action: 'decline' }),
    cancel: (id: number) => act.mutate({ id, action: 'cancel' }),
    forfeit: (id: number) =>
      Alert.alert(t('compete.match.forfeit'), t('compete.match.forfeit.confirm'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('compete.match.forfeit'), style: 'destructive', onPress: () => act.mutate({ id, action: 'forfeit' }) },
      ]),
    acting: act.isPending,
    post: (id: number) =>
      Alert.alert(t('compete.post.confirm.title'), t('compete.post.confirm.body'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('compete.post'), onPress: () => post.mutate(id) },
      ]),
    posting: post.isPending,
    repost: (postId: number) => repost.mutate(postId),
    reposting: repost.isPending,
  };
}
