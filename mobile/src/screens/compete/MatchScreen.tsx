import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { Text } from 'react-native-paper';


import { Match, getMatch, perspective } from '../../api/compete';
import { resolveMediaUrl } from '../../api/posts';
import { Avatar } from '../../components/CommunityFeed';
import Icon from '../../components/Icon';
import {
  RoundStrip,
  Scoreboard,
  WeekDots,
  daysUntil,
  firstName,
  shortDate,
  signed,
} from '../../components/compete/MatchParts';
import StorySheet from '../../components/compete/StorySheet';
import { useCompeteActions } from '../../components/compete/useCompete';
import { t, tf } from '../../i18n';
import { makeStyles, palette } from '../../theme/theme';
import SafeFade from '../../components/SafeFade';

type Props = {
  route: { params: { matchId: number } };
  navigation: { navigate: (screen: 'Match', params: { matchId: number }) => void; setOptions: (o: object) => void };
};

function Button({
  label,
  onPress,
  primary,
  icon,
  danger,
  disabled,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  icon?: Parameters<typeof Icon>[0]['name'];
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        primary && styles.buttonPrimary,
        (pressed || disabled) && { opacity: 0.7 },
      ]}
      accessibilityRole="button">
      {icon && <Icon name={icon} size={17} color={primary ? '#FFFFFF' : danger ? palette.primary : palette.textPrimary} />}
      <Text style={[styles.buttonText, primary && styles.buttonTextPrimary, danger && { color: palette.primary }]}>
        {label}
      </Text>
    </Pressable>
  );
}

function hoursLeft(iso: string): string {
  const ms = Date.parse(iso) - Date.now();
  const h = Math.max(0, Math.floor(ms / 3_600_000));
  return h >= 1 ? `${h} h` : `${Math.max(1, Math.floor(ms / 60_000))} min`;
}

/**
 * One match. Pending: accept or decline (or wait / cancel). Active: the score,
 * the five rounds, this week's training days for both, what's at stake and the
 * trainings that counted. Finished: the result, rating change, record between
 * the two, and Rematch / Post / Story.
 */
export default function MatchScreen({ route, navigation }: Props) {
  const { matchId } = route.params;
  const query = useQuery({ queryKey: ['match', matchId], queryFn: () => getMatch(matchId) });
  const actions = useCompeteActions((m) => navigation.navigate('Match', { matchId: m.id }));
  const [story, setStory] = useState<Match | null>(null);

  useEffect(() => {
    navigation.setOptions({ title: t('compete.match.title') });
  }, [navigation]);

  const m = query.data;
  if (!m) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={palette.primary} />
      </View>
    );
  }
  const side = perspective(m);
  const viewer = side.isViewer;
  const c = m.current;
  const started = m.status === 'ACTIVE' && m.startsOn != null && daysUntil(m.startsOn) <= 0;

  return (
    <>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} tintColor={palette.primary} />}>
        <View style={styles.head}>
          <Icon name="karate" size={15} color={palette.textSecondary} />
          <Text style={styles.kicker}>
            {t('compete.match.firstTo3')}
            {m.status === 'ACTIVE' && c ? ` · ${tf('compete.match.round', { n: c.roundNo })}` : ''}
          </Text>
        </View>

        {m.status === 'FINISHED' && (
          <SafeFade delay={350} fromScale={0.8}>
            <Text style={styles.result}>
            {side.result === 'DRAW'
              ? t('compete.result.draw')
              : side.result === 'WON'
                ? viewer
                  ? t('compete.result.won')
                  : tf('compete.result.someoneWon', { name: firstName(side.me) })
                : tf('compete.result.lost', { name: firstName(side.them) })}
          </Text>
          </SafeFade>
        )}

        <Scoreboard side={side} />

        {m.status === 'FINISHED' && viewer && side.myDelta != null && (
          <SafeFade delay={550} offsetY={10} style={styles.deltas}>
            <View style={styles.deltaBox}>
              <Text style={styles.deltaName}>{t('compete.you')}</Text>
              <Text style={styles.deltaValue}>
                {side.me.rating}{' '}
                <Text style={side.myDelta >= 0 ? styles.up : styles.down}>{signed(side.myDelta)}</Text>
              </Text>
            </View>
            <View style={styles.deltaBox}>
              <Text style={styles.deltaName}>{firstName(side.them)}</Text>
              <Text style={styles.deltaValue}>
                {side.them.rating}{' '}
                <Text style={(side.theirDelta ?? 0) >= 0 ? styles.up : styles.down}>{signed(side.theirDelta ?? 0)}</Text>
              </Text>
            </View>
          </SafeFade>
        )}
        {m.status === 'FINISHED' && m.endReason === 'FORFEIT' && (
          <Text style={styles.note}>
            {tf('compete.result.forfeit', { name: firstName(side.result === 'WON' ? side.them : side.me) })}
          </Text>
        )}

        {(m.status === 'ACTIVE' || m.status === 'FINISHED') && (
          <View style={{ marginTop: 18 }}>
            <RoundStrip side={side} current={started && c ? c.roundNo : null} />
          </View>
        )}

        {/* Pending */}
        {m.status === 'PENDING' && (
          <SafeFade style={styles.panel}>
            <Text style={styles.panelTitle}>
              {m.myRole === 'OPPONENT'
                ? tf('compete.match.challengedYou', { name: firstName(side.them) })
                : tf('compete.match.waiting', { name: firstName(side.them) })}
            </Text>
            {m.expiresAt && <Text style={styles.panelSub}>{tf('compete.match.expiresIn', { time: hoursLeft(m.expiresAt) })}</Text>}
            <Text style={styles.panelBody}>{t('compete.challenge.confirm.body')}</Text>
            {side.myStake != null && (
              <Text style={styles.stake}>
                {tf('compete.match.stake', { win: side.myStake, loss: side.theirStake ?? 0 })}
              </Text>
            )}
            {m.myRole === 'OPPONENT' ? (
              <>
                <View style={styles.row}>
                  <Button label={t('compete.match.decline')} onPress={() => actions.decline(m.id)} disabled={actions.acting} />
                  <Button label={t('compete.match.accept')} primary onPress={() => actions.accept(m.id)} disabled={actions.acting} />
                </View>
                <View style={styles.quietRow}>
                  <Pressable onPress={() => actions.respondAsync(m.id, 'silence').catch(() => undefined)} hitSlop={8} accessibilityRole="button">
                    <Text style={styles.quiet}>{t('compete.invite.silence')}</Text>
                  </Pressable>
                  <Text style={styles.quietDot}>·</Text>
                  <Pressable onPress={() => actions.respondAsync(m.id, 'block').catch(() => undefined)} hitSlop={8} accessibilityRole="button">
                    <Text style={styles.quiet}>{tf('compete.invite.block', { name: firstName(side.them) })}</Text>
                  </Pressable>
                </View>
              </>
            ) : m.myRole === 'CHALLENGER' ? (
              <View style={styles.row}>
                <Button label={t('compete.match.cancel')} onPress={() => actions.cancel(m.id)} disabled={actions.acting} />
              </View>
            ) : null}
          </SafeFade>
        )}

        {/* Active: not started yet */}
        {m.status === 'ACTIVE' && !started && m.startsOn && (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>
              {daysUntil(m.startsOn) === 1
                ? t('compete.match.startsTomorrow')
                : tf('compete.match.startsOn', { date: shortDate(m.startsOn) })}
            </Text>
            <Text style={styles.panelBody}>{t('compete.match.rules')}</Text>
          </View>
        )}

        {/* Active: this round */}
        {started && c && (
          <View style={styles.panel}>
            <View style={styles.panelHead}>
              <Text style={styles.panelLabel}>{t('compete.match.thisRound')}</Text>
              <Text style={styles.panelLabel}>
                {daysUntil(c.endsOn) <= 0 ? t('compete.match.lastDay') : tf('compete.match.daysLeft', { n: daysUntil(c.endsOn) + 1 })}
              </Text>
            </View>
            <Text style={styles.roundScore}>
              {side.myDays} <Text style={styles.roundX}>×</Text> {side.theirDays}
            </Text>
            <View style={styles.dotRow}>
              <Text style={styles.dotName} numberOfLines={1}>
                {viewer ? t('compete.you') : firstName(side.me)}
              </Text>
              <WeekDots startsOn={c.startsOn} dates={side.myDates} mine />
            </View>
            <View style={styles.dotRow}>
              <Text style={styles.dotName} numberOfLines={1}>
                {firstName(side.them)}
              </Text>
              <WeekDots startsOn={c.startsOn} dates={side.theirDates} mine={false} />
            </View>
            {side.myRounds === 2 && (
              <View style={styles.matchPointRow}>
                <Icon name="fire" size={14} color={palette.primary} />
                <Text style={styles.matchPoint}>{t('compete.match.matchPoint')}</Text>
              </View>
            )}
            {side.theirRounds === 2 && side.myRounds < 2 && (
              <Text style={styles.panelSub}>{tf('compete.match.theirMatchPoint', { name: firstName(side.them) })}</Text>
            )}
          </View>
        )}

        {m.status === 'ACTIVE' && viewer && side.myStake != null && (
          <Text style={styles.stakeCenter}>
            {tf('compete.match.stake', { win: side.myStake, loss: side.theirStake ?? 0 })}
          </Text>
        )}

        {/* Finished actions */}
        {m.status === 'FINISHED' && viewer && (
          <SafeFade delay={700} offsetY={10} style={[styles.row, { marginTop: 22 }]}>
            <Button label={t('compete.rematch')} primary icon="karate" onPress={() => actions.challenge(side.them)} disabled={actions.challenging} />
            <Button
              label={m.postedByMe ? t('compete.posted') : t('compete.post')}
              icon={m.postedByMe ? 'check' : 'send'}
              onPress={() => actions.post(m.id)}
              disabled={m.postedByMe || actions.posting}
            />
            <Button label={t('compete.story')} icon="instagram" onPress={() => setStory(m)} />
          </SafeFade>
        )}
        {m.status === 'FINISHED' && viewer && <Text style={styles.note}>{t('compete.result.reset')}</Text>}

        {(m.status === 'ACTIVE' || m.status === 'FINISHED') && (
          <Text style={styles.record}>
            {tf('compete.match.record', { a: side.myWins, b: side.theirWins })}
          </Text>
        )}

        {/* Timeline */}
        {m.timeline && (m.status === 'FINISHED' || started) && (
          <View style={{ marginTop: 22 }}>
            <Text style={styles.section}>{t('compete.match.timeline')}</Text>
            {m.timeline.length === 0 ? (
              <Text style={styles.panelSub}>{t('compete.match.timeline.empty')}</Text>
            ) : (
              m.timeline.map((p, i) => {
                const who = p.userId === side.me.id ? side.me : side.them;
                return (
                  <SafeFade delay={Math.min(i, 8) * 40} offsetY={8} key={`${p.userId}-${p.date}`} style={styles.proof}>
                    <Avatar name={who.displayName} url={who.avatarUrl} size={32} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.proofName}>
                        {who.id === side.me.id && viewer ? t('compete.you') : firstName(who)} · {shortDate(p.date)}
                      </Text>
                      <View style={styles.proofKind}>
                        <Icon name={p.gym ? 'check-decagram' : 'camera'} size={13} color={palette.textSecondary} />
                        <Text style={styles.proofText}>
                          {p.gym ? t('compete.match.proof.gym') : t('compete.match.proof.photo')}
                        </Text>
                      </View>
                    </View>
                    {p.photoUrl && <Image source={{ uri: resolveMediaUrl(p.photoUrl) }} style={styles.proofPhoto} />}
                  </SafeFade>
                );
              })
            )}
            <Text style={[styles.note, { textAlign: 'left' }]}>{t('compete.match.rules')}</Text>
          </View>
        )}

        {m.status === 'ACTIVE' && viewer && (
          <View style={{ marginTop: 26, alignItems: 'center' }}>
            <Button label={t('compete.match.forfeit')} danger onPress={() => actions.forfeit(m.id)} disabled={actions.acting} />
          </View>
        )}
      </ScrollView>
      <StorySheet match={story} onClose={() => setStory(null)} />
    </>
  );
}

const styles = makeStyles(() => ({
  screen: { flex: 1, backgroundColor: palette.background },
  content: { padding: 18, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.background },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 6 },
  kicker: { color: palette.textSecondary, fontSize: 13, fontWeight: '600' },
  result: { color: palette.textPrimary, fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginVertical: 6 },
  deltas: { flexDirection: 'row', gap: 10, marginTop: 10 },
  deltaBox: { flex: 1, backgroundColor: palette.surface, borderRadius: 12, padding: 12 },
  deltaName: { color: palette.textSecondary, fontSize: 12 },
  deltaValue: { color: palette.textPrimary, fontSize: 19, fontWeight: 'bold', marginTop: 2 },
  up: { color: '#22C55E', fontSize: 14 },
  down: { color: palette.primary, fontSize: 14 },
  panel: { backgroundColor: palette.surface, borderRadius: 16, padding: 16, marginTop: 18, gap: 8 },
  panelHead: { flexDirection: 'row', justifyContent: 'space-between' },
  panelLabel: { color: palette.textSecondary, fontSize: 12, fontWeight: '600' },
  panelTitle: { color: palette.textPrimary, fontSize: 17, fontWeight: 'bold' },
  panelSub: { color: palette.textSecondary, fontSize: 13 },
  panelBody: { color: palette.textPrimary, fontSize: 14, lineHeight: 20 },
  stake: { color: palette.textPrimary, fontSize: 13, fontWeight: '600' },
  stakeCenter: { color: palette.textSecondary, fontSize: 13, textAlign: 'center', marginTop: 14 },
  roundScore: { color: palette.textPrimary, fontSize: 30, fontWeight: 'bold' },
  roundX: { color: palette.textSecondary, fontSize: 18 },
  dotRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dotName: { color: palette.textSecondary, fontSize: 12, width: 60 },
  matchPointRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  matchPoint: { color: palette.textPrimary, fontSize: 13, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 10, marginTop: 6 },
  button: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.outline,
  },
  buttonPrimary: { backgroundColor: palette.primary, borderColor: palette.primary },
  buttonText: { color: palette.textPrimary, fontSize: 14, fontWeight: '600' },
  buttonTextPrimary: { color: '#FFFFFF' },
  note: { color: palette.textSecondary, fontSize: 12, textAlign: 'center', marginTop: 10 },
  quietRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  quiet: { color: palette.textSecondary, fontSize: 13, fontWeight: '600' },
  quietDot: { color: palette.textSecondary, fontSize: 13 },
  record: { color: palette.textSecondary, fontSize: 13, textAlign: 'center', marginTop: 16 },
  section: { color: palette.textPrimary, fontSize: 16, fontWeight: 'bold', marginBottom: 8 },
  proof: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    borderBottomWidth: 0.5,
    borderBottomColor: palette.surfaceVariant,
  },
  proofName: { color: palette.textPrimary, fontSize: 14, fontWeight: '600' },
  proofKind: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  proofText: { color: palette.textSecondary, fontSize: 12 },
  proofPhoto: { width: 44, height: 44, borderRadius: 8, backgroundColor: palette.surfaceVariant },
}));
