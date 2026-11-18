import * as Sharing from 'expo-sharing';
import { LinearGradient } from 'expo-linear-gradient';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Platform, Pressable, View, useWindowDimensions } from 'react-native';
import { Text } from 'react-native-paper';
import { captureRef } from 'react-native-view-shot';

import { Match, perspective } from '../../api/compete';
import { t, tf } from '../../i18n';
import { palette } from '../../theme/theme';
import { makeStyles } from '../../theme/theme';
import { Avatar } from '../CommunityFeed';
import Icon from '../Icon';
import { firstName, shortDate } from './MatchParts';

// The card is laid out at 360×640 and saved at 3× (1080×1920, a story's size).
const W = 360;
const H = 640;

/** The 9:16 result card. Always drawn dark, whatever the app theme, so it looks the same on Instagram. */
function StoryCard({ match }: { match: Match }) {
  const side = perspective(match);
  const draw = side.result === 'DRAW';
  const winner = side.result === 'LOST' ? side.them : side.me;
  const winnerIsLeft = side.result !== 'LOST';
  const lastRound = match.rounds[match.rounds.length - 1];
  return (
    <LinearGradient colors={['#2A0B10', '#0D0D10', '#0D0D10']} locations={[0, 0.45, 1]} style={card.root}>
      <View style={card.top}>
        <Image source={require('../../../assets/brand/bjjflow-mark-512.png')} style={card.logo} />
        <Text style={card.brand}>BJJ Flow</Text>
      </View>
      <Text style={card.kicker}>{t('compete.match.title').toUpperCase()} · {t('compete.match.firstTo3').toUpperCase()}</Text>

      <View style={card.board}>
        <View style={card.player}>
          <View style={[card.ring, winnerIsLeft && !draw && card.ringWin]}>
            <Avatar name={side.me.displayName} url={side.me.avatarUrl} size={winnerIsLeft && !draw ? 96 : 76} />
          </View>
          <Text style={card.name} numberOfLines={1}>
            {firstName(side.me)}
          </Text>
        </View>
        <Text style={card.score}>
          {side.myRounds}
          <Text style={card.x}> × </Text>
          {side.theirRounds}
        </Text>
        <View style={card.player}>
          <View style={[card.ring, !winnerIsLeft && !draw && card.ringWin]}>
            <Avatar name={side.them.displayName} url={side.them.avatarUrl} size={!winnerIsLeft && !draw ? 96 : 76} />
          </View>
          <Text style={card.name} numberOfLines={1}>
            {firstName(side.them)}
          </Text>
        </View>
      </View>

      <Text style={card.headline}>
        {draw ? t('compete.story.draw') : `${firstName(winner)} ${t('compete.story.wonTheMatch')}`}
      </Text>

      <View style={card.rounds}>
        {side.rounds.map((r) => (
          <View key={r.roundNo} style={[card.round, r.result === 'WON' && card.roundWon, r.result === 'LOST' && card.roundLost]}>
            <Text style={card.roundNo}>R{r.roundNo}</Text>
            <Text style={card.roundDays}>
              {r.myDays}–{r.theirDays}
            </Text>
          </View>
        ))}
      </View>

      <View style={card.h2h}>
        <Text style={card.h2hLabel}>{t('compete.story.headToHead')}</Text>
        <Text style={card.h2hScore}>
          {firstName(side.me)} {side.myWins} × {side.theirWins} {firstName(side.them)}
        </Text>
      </View>

      {match.startsOn && lastRound && (
        <Text style={card.dates}>
          {shortDate(match.startsOn)} – {shortDate(lastRound.endsOn)}
        </Text>
      )}
      <View style={{ flex: 1 }} />
      <Text style={card.footer}>bjjflow</Text>
    </LinearGradient>
  );
}

/**
 * A preview of the result card with a Share button: the card is saved as a
 * 1080×1920 image and handed to the system share sheet, where Instagram
 * Stories (and WhatsApp, etc.) appear.
 */
export default function StorySheet({ match, onClose }: { match: Match | null; onClose: () => void }) {
  const ref = useRef<View>(null);
  const [busy, setBusy] = useState(false);
  const { height } = useWindowDimensions();
  // Fit the preview on screen; the saved image is full size either way.
  const scale = Math.min(1, (height * 0.66) / H);

  const share = async () => {
    if (!ref.current) return;
    setBusy(true);
    try {
      if (Platform.OS === 'web' || !(await Sharing.isAvailableAsync())) {
        Alert.alert(t('compete.story.unavailable'));
        return;
      }
      const uri = await captureRef(ref, { format: 'png', quality: 1, width: W * 3, height: H * 3 });
      await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: t('compete.story.title') });
    } catch {
      // Closing the share sheet without choosing an app is not an error.
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={!!match} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.top}>
          <Text style={styles.title}>{t('compete.story.title')}</Text>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('a11y.close')}>
            <Icon name="close" size={26} color="#FFFFFF" />
          </Pressable>
        </View>
        <View style={{ width: W * scale, height: H * scale, alignSelf: 'center' }}>
          <View style={{ transform: [{ scale }], transformOrigin: 'top left', width: W, height: H }}>
            {match && (
              <View ref={ref} collapsable={false} style={{ width: W, height: H }}>
                <StoryCard match={match} />
              </View>
            )}
          </View>
        </View>
        <Pressable
          style={({ pressed }) => [styles.share, pressed && { opacity: 0.85 }]}
          onPress={share}
          disabled={busy}
          accessibilityRole="button">
          {busy ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Icon name="instagram" size={20} color="#FFFFFF" />
              <Text style={styles.shareText}>{t('compete.story.share')}</Text>
            </>
          )}
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = makeStyles(() => ({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', paddingHorizontal: 20, gap: 18 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: '#FFFFFF', fontSize: 17, fontWeight: 'bold' },
  share: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.primary,
    borderRadius: 14,
    paddingVertical: 14,
  },
  shareText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
}));

// Fixed colors: the card must look the same in light and dark mode.
const card = makeStyles(() => ({
  root: { width: W, height: H, paddingHorizontal: 26, paddingTop: 34, paddingBottom: 26, alignItems: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: { width: 28, height: 28, borderRadius: 7 },
  brand: { color: '#F4F4F5', fontSize: 16, fontWeight: 'bold' },
  kicker: { color: '#E63946', fontSize: 11, fontWeight: 'bold', letterSpacing: 1.4, marginTop: 34 },
  board: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', alignSelf: 'stretch', marginTop: 28 },
  player: { alignItems: 'center', width: 110, gap: 8 },
  ring: { borderRadius: 999, padding: 3, borderWidth: 2, borderColor: 'transparent' },
  ringWin: { borderColor: '#F5C518' },
  name: { color: '#F4F4F5', fontSize: 15, fontWeight: 'bold', maxWidth: 108 },
  score: { color: '#F4F4F5', fontSize: 52, fontWeight: 'bold' },
  x: { color: '#A1A1AA', fontSize: 26, fontWeight: 'normal' },
  headline: { color: '#F4F4F5', fontSize: 22, fontWeight: 'bold', marginTop: 26, textAlign: 'center' },
  rounds: { flexDirection: 'row', gap: 6, marginTop: 22 },
  round: {
    width: 52,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3F3F46',
    alignItems: 'center',
  },
  roundWon: { backgroundColor: '#E63946', borderColor: '#E63946' },
  roundLost: { backgroundColor: '#3F3F46' },
  roundNo: { color: '#E4E4E7', fontSize: 10, fontWeight: '600' },
  roundDays: { color: '#FFFFFF', fontSize: 15, fontWeight: 'bold' },
  h2h: {
    marginTop: 26,
    borderWidth: 1,
    borderColor: '#2A2A33',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  h2hLabel: { color: '#A1A1AA', fontSize: 11, fontWeight: '600' },
  h2hScore: { color: '#F4F4F5', fontSize: 17, fontWeight: 'bold', marginTop: 2 },
  dates: { color: '#A1A1AA', fontSize: 12, marginTop: 14 },
  footer: { color: '#71717A', fontSize: 13, fontWeight: 'bold', letterSpacing: 2 },
}));
