import { api } from './client';
import type { FeedBelt } from './feed';

/** A member as shown in rankings and matches. */
export type Player = {
  id: number;
  username: string | null;
  displayName: string;
  avatarUrl: string | null;
  belt: FeedBelt | null;
  rating: number;
};

export type MyRating = {
  rating: number;
  /** Rating change since the 1st of this month. */
  monthDelta: number;
  gymPosition: number | null;
  gymSize: number | null;
  /** Training days this week (Mon–Sun) and the goal the weekly bonus needs. */
  weekDays: number;
  weeklyGoal: number;
  weekBonusEarned: boolean;
  acceptsChallenges: boolean;
  openMatches: number;
};

export type RankingScope = 'gym' | 'following';

export type RankingEntry = { position: number; player: Player; monthDelta: number; me: boolean };

export type Ranking = { scope: RankingScope; available: boolean; entries: RankingEntry[] };

export type MatchStatus = 'PENDING' | 'ACTIVE' | 'FINISHED' | 'DECLINED' | 'CANCELLED' | 'EXPIRED';

export type MatchRound = {
  roundNo: number;
  startsOn: string;
  endsOn: string;
  challengerDays: number;
  opponentDays: number;
  /** null: a tied week. */
  winnerId: number | null;
};

export type CurrentRound = {
  roundNo: number;
  startsOn: string;
  endsOn: string;
  settlesAt: string;
  challengerDays: number;
  opponentDays: number;
  challengerDates: string[];
  opponentDates: string[];
};

export type Proof = { userId: number; date: string; gym: boolean; photoUrl: string | null };

/** A match from neither side; {@link perspective} turns it into "you vs them". */
export type Match = {
  id: number;
  status: MatchStatus;
  myRole: 'CHALLENGER' | 'OPPONENT' | null;
  challenger: Player;
  opponent: Player;
  startsOn: string | null;
  challengerRounds: number;
  opponentRounds: number;
  roundsPlayed: number;
  winnerId: number | null;
  endReason: 'FIRST_TO_3' | 'ROUND_CAP' | 'FORFEIT' | null;
  challengerDelta: number | null;
  opponentDelta: number | null;
  createdAt: string;
  expiresAt: string | null;
  finishedAt: string | null;
  rounds: MatchRound[];
  current: CurrentRound | null;
  /** Rating each side gains by winning (the loser loses the same). */
  stake: { challengerWin: number; opponentWin: number } | null;
  headToHead: { challengerWins: number; opponentWins: number; draws: number };
  timeline: Proof[] | null;
  postedByMe: boolean;
};

export type MatchList = { incoming: Match[]; outgoing: Match[]; active: Match[]; finished: Match[] };

export type BlockedReason =
  | 'SELF'
  | 'NOT_CONNECTED'
  | 'DISABLED'
  | 'TOO_MANY_MINE'
  | 'TOO_MANY_THEIRS'
  | 'OPEN_MATCH';

export type Versus = {
  them: Player;
  myWins: number;
  theirWins: number;
  draws: number;
  openMatch: Match | null;
  canChallenge: boolean;
  blockedReason: BlockedReason | null;
  winGain: number;
  lossCost: number;
};

export type MatchPost = {
  id: number;
  author: Player;
  /** The original poster, when this is a repost. */
  repostOf: Player | null;
  originalPostId: number;
  caption: string | null;
  createdAt: string;
  match: Match;
  repostCount: number;
  sharedByMe: boolean;
};

// The same match seen from one player's side. A third party (a post in the
// feed) sees it from the winner's side, or the challenger's after a draw.
export type Side = {
  me: Player;
  them: Player;
  myRounds: number;
  theirRounds: number;
  myDelta: number | null;
  theirDelta: number | null;
  myWins: number;
  theirWins: number;
  myDays: number;
  theirDays: number;
  myDates: string[];
  theirDates: string[];
  myStake: number | null;
  theirStake: number | null;
  /** WON / LOST / DRAW once finished, else null. */
  result: 'WON' | 'LOST' | 'DRAW' | null;
  /** Whether "me" is actually the viewer. */
  isViewer: boolean;
  /** Round results from "me"'s side. */
  rounds: { roundNo: number; myDays: number; theirDays: number; result: 'WON' | 'LOST' | 'TIE' }[];
};

export function perspective(m: Match): Side {
  const viewerIsOpponent = m.myRole === 'OPPONENT';
  const thirdPartyFlip = m.myRole === null && m.winnerId != null && m.winnerId === m.opponent.id;
  const flip = viewerIsOpponent || thirdPartyFlip;
  const c = m.current;
  const mine = flip ? m.opponent : m.challenger;
  const result =
    m.status !== 'FINISHED' ? null : m.winnerId == null ? 'DRAW' : m.winnerId === mine.id ? 'WON' : 'LOST';
  return {
    me: mine,
    them: flip ? m.challenger : m.opponent,
    myRounds: flip ? m.opponentRounds : m.challengerRounds,
    theirRounds: flip ? m.challengerRounds : m.opponentRounds,
    myDelta: flip ? m.opponentDelta : m.challengerDelta,
    theirDelta: flip ? m.challengerDelta : m.opponentDelta,
    myWins: flip ? m.headToHead.opponentWins : m.headToHead.challengerWins,
    theirWins: flip ? m.headToHead.challengerWins : m.headToHead.opponentWins,
    myDays: c ? (flip ? c.opponentDays : c.challengerDays) : 0,
    theirDays: c ? (flip ? c.challengerDays : c.opponentDays) : 0,
    myDates: c ? (flip ? c.opponentDates : c.challengerDates) : [],
    theirDates: c ? (flip ? c.challengerDates : c.opponentDates) : [],
    myStake: m.stake ? (flip ? m.stake.opponentWin : m.stake.challengerWin) : null,
    theirStake: m.stake ? (flip ? m.stake.challengerWin : m.stake.opponentWin) : null,
    result,
    isViewer: m.myRole !== null,
    rounds: m.rounds.map((r) => {
      const myDays = flip ? r.opponentDays : r.challengerDays;
      const theirDays = flip ? r.challengerDays : r.opponentDays;
      return {
        roundNo: r.roundNo,
        myDays,
        theirDays,
        result: r.winnerId == null ? 'TIE' : r.winnerId === mine.id ? 'WON' : 'LOST',
      };
    }),
  };
}

export async function getMyRating(): Promise<MyRating> {
  const { data } = await api.get<MyRating>('/compete/me');
  return data;
}

export async function setAcceptsChallenges(acceptsChallenges: boolean): Promise<MyRating> {
  const { data } = await api.put<MyRating>('/compete/me/settings', { acceptsChallenges });
  return data;
}

export async function getRanking(scope: RankingScope): Promise<Ranking> {
  const { data } = await api.get<Ranking>('/compete/ranking', { params: { scope } });
  return data;
}

export async function getVersus(userId: number): Promise<Versus> {
  const { data } = await api.get<Versus>(`/compete/vs/${userId}`);
  return data;
}

export async function getMatches(): Promise<MatchList> {
  const { data } = await api.get<MatchList>('/matches');
  return data;
}

export async function getMatch(id: number): Promise<Match> {
  const { data } = await api.get<Match>(`/matches/${id}`);
  return data;
}

export async function challenge(opponentId: number): Promise<Match> {
  const { data } = await api.post<Match>('/matches', { opponentId });
  return data;
}

export type MatchAction = 'accept' | 'decline' | 'cancel' | 'forfeit';

export async function matchAction(id: number, action: MatchAction): Promise<Match> {
  const { data } = await api.post<Match>(`/matches/${id}/${action}`);
  return data;
}

export async function postMatch(id: number, caption?: string): Promise<MatchPost> {
  const { data } = await api.post<MatchPost>(`/matches/${id}/post`, { caption: caption || null });
  return data;
}

export async function getMatchPosts(scope: 'following' | 'all'): Promise<MatchPost[]> {
  const { data } = await api.get<MatchPost[]>('/match-posts', { params: { scope } });
  return Array.isArray(data) ? data : [];
}

export async function repostMatch(postId: number): Promise<MatchPost> {
  const { data } = await api.post<MatchPost>(`/match-posts/${postId}/repost`);
  return data;
}

export async function deleteMatchPost(postId: number): Promise<void> {
  await api.delete(`/match-posts/${postId}`);
}

/** Refreshes everything that shows ratings or matches. */
export const COMPETE_KEYS = ['myRating', 'ranking', 'matches', 'match', 'versus', 'matchPosts'] as const;
