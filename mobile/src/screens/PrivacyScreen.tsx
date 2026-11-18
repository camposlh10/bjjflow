import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';

import { MyRating, getChallengeBlocks, getMyRating, setAcceptsChallenges, unblockChallenges } from '../api/compete';
import { Avatar } from '../components/CommunityFeed';
import { shortDate } from '../components/compete/MatchParts';
import { Settings, getSettings, updateSettings } from '../api/users';
import { t, tf } from '../i18n';
import { makeStyles, palette } from '../theme/theme';

export default function PrivacyScreen() {
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ['settings'], queryFn: getSettings });

  const mut = useMutation({
    mutationFn: (patch: Partial<Settings>) => updateSettings(patch),
    onSuccess: (data) => queryClient.setQueryData(['settings'], data),
  });
  const rating = useQuery({ queryKey: ['myRating'], queryFn: getMyRating });
  const challenges = useMutation({
    mutationFn: (accepts: boolean) => setAcceptsChallenges(accepts),
    onMutate: (accepts) =>
      queryClient.setQueryData<MyRating>(['myRating'], (old) => (old ? { ...old, acceptsChallenges: accepts } : old)),
    onSuccess: (data) => queryClient.setQueryData(['myRating'], data),
    onError: () => queryClient.invalidateQueries({ queryKey: ['myRating'] }),
  });
  const blocks = useQuery({ queryKey: ['challengeBlocks'], queryFn: getChallengeBlocks });
  const unblock = useMutation({
    mutationFn: (userId: number) => unblockChallenges(userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['challengeBlocks'] }),
  });

  if (settings.isLoading || !settings.data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }
  const s = settings.data;

  return (
    <ScrollView showsVerticalScrollIndicator={false} style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>{t('privacy.private')}</Text>
            <Text style={styles.hint}>{t('privacy.private.hint')}</Text>
          </View>
          <Switch
            value={s.privateAccount}
            onValueChange={(v) => mut.mutate({ privateAccount: v })}
            trackColor={{ true: palette.primary, false: palette.surfaceVariant }}
            thumbColor="#fff"
          />
        </View>
        <View style={[styles.row, styles.rowDivider]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>{t('privacy.beltSync')}</Text>
            <Text style={styles.hint}>{t('privacy.beltSync.hint')}</Text>
          </View>
          <Switch
            value={s.gymBeltSync}
            onValueChange={(v) => mut.mutate({ gymBeltSync: v })}
            trackColor={{ true: palette.primary, false: palette.surfaceVariant }}
            thumbColor="#fff"
          />
        </View>
        {rating.data && (
          <View style={[styles.row, styles.rowDivider]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>{t('compete.setting.title')}</Text>
              <Text style={styles.hint}>{t('compete.setting.sub')}</Text>
            </View>
            <Switch
              value={rating.data.acceptsChallenges}
              onValueChange={(v) => challenges.mutate(v)}
              trackColor={{ true: palette.primary, false: palette.surfaceVariant }}
              thumbColor="#fff"
            />
          </View>
        )}
      </View>
      {(blocks.data?.length ?? 0) > 0 && (
        <>
          <Text style={styles.blockTitle}>{t('compete.blocks.title')}</Text>
          <View style={styles.card}>
            {blocks.data!.map((b, i) => (
              <View key={b.user.id} style={[styles.row, i > 0 && styles.rowDivider]}>
                <Avatar name={b.user.displayName} url={b.user.avatarUrl} size={36} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>{b.user.displayName}</Text>
                  <Text style={styles.hint}>
                    {b.until ? tf('compete.blocks.until', { date: shortDate(b.until.slice(0, 10)) }) : t('compete.blocks.forever')}
                  </Text>
                </View>
                <Pressable onPress={() => unblock.mutate(b.user.id)} hitSlop={8} accessibilityRole="button">
                  <Text style={styles.unblock}>{t('compete.blocks.unblock')}</Text>
                </Pressable>
              </View>
            ))}
          </View>
        </>
      )}
      <Text style={styles.note}>{t('privacy.note')}</Text>
    </ScrollView>
  );
}

const styles = makeStyles(() => ({
  container: { flex: 1, backgroundColor: palette.background },
  content: { padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.background },
  card: { backgroundColor: palette.surface, borderRadius: 14, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16 },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.surfaceVariant },
  label: { color: palette.textPrimary, fontSize: 15, fontWeight: '600' },
  hint: { color: palette.textSecondary, fontSize: 12, marginTop: 3 },
  blockTitle: { color: palette.textSecondary, fontSize: 13, fontWeight: '600', marginTop: 22, marginBottom: 8, marginHorizontal: 4 },
  unblock: { color: palette.primary, fontSize: 14, fontWeight: '700' },
  note: { color: palette.textSecondary, fontSize: 12, marginTop: 14, marginHorizontal: 4 },
}));
