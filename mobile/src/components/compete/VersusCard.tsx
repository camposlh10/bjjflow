import { useQuery } from '@tanstack/react-query';
import { Pressable, View } from 'react-native';
import { Text } from 'react-native-paper';

import { Match, getVersus } from '../../api/compete';
import { t, tf } from '../../i18n';
import { makeStyles, palette } from '../../theme/theme';
import Icon from '../Icon';
import { MatchCard, firstName } from './MatchParts';
import { blockedMessage, useCompeteActions } from './useCompete';

/**
 * On someone else's profile: your record against them, their rating, and either
 * the open match between you or a Challenge button with what it's worth.
 */
export default function VersusCard({ userId, onOpenMatch }: { userId: number; onOpenMatch: (m: Match) => void }) {
  const versus = useQuery({ queryKey: ['versus', userId], queryFn: () => getVersus(userId) });
  const actions = useCompeteActions(onOpenMatch);
  const v = versus.data;
  if (!v) return null;
  const blocked = v.blockedReason && v.blockedReason !== 'OPEN_MATCH' ? blockedMessage(v.blockedReason, v.them) : null;
  const played = v.myWins + v.theirWins + v.draws > 0;

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title}>{t('compete.profile.record')}</Text>
        <Text style={styles.rating}>
          {t('compete.rating')} {v.them.rating}
        </Text>
      </View>
      {played && (
        <Text style={styles.record}>
          {t('compete.you')} {v.myWins} <Text style={styles.x}>×</Text> {v.theirWins} {firstName(v.them)}
        </Text>
      )}
      {v.openMatch ? (
        <MatchCard match={v.openMatch} highlight onPress={() => onOpenMatch(v.openMatch!)} />
      ) : v.canChallenge ? (
        <Pressable
          style={({ pressed }) => [styles.button, (pressed || actions.challenging) && { opacity: 0.8 }]}
          onPress={() => actions.challenge(v.them)}
          disabled={actions.challenging}
          accessibilityRole="button">
          <Icon name="karate" size={18} color="#FFFFFF" />
          <View>
            <Text style={styles.buttonText}>{t('compete.challenge')}</Text>
            <Text style={styles.buttonSub}>{tf('compete.challenge.stake', { win: v.winGain, loss: v.lossCost })}</Text>
          </View>
        </Pressable>
      ) : blocked ? (
        <Text style={styles.blocked}>{blocked}</Text>
      ) : null}
    </View>
  );
}

const styles = makeStyles(() => ({
  card: { backgroundColor: palette.surface, borderRadius: 16, padding: 14, gap: 10, marginTop: 14 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: palette.textPrimary, fontSize: 15, fontWeight: 'bold' },
  rating: { color: palette.textSecondary, fontSize: 13, fontWeight: '600' },
  record: { color: palette.textPrimary, fontSize: 20, fontWeight: 'bold' },
  x: { color: palette.textSecondary, fontSize: 15 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: palette.primary,
    borderRadius: 12,
    paddingVertical: 10,
  },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: 'bold' },
  buttonSub: { color: '#FFFFFFCC', fontSize: 11 },
  blocked: { color: palette.textSecondary, fontSize: 13 },
}));
