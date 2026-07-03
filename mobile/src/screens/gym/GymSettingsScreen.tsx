import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { ActivityIndicator, Button, Text, TextInput } from 'react-native-paper';

import { apiErrorMessage } from '../../api/auth';
import { addTestBot, getMyGym, updateGymRules } from '../../api/gyms';
import { t } from '../../i18n';
import { makeStyles, palette } from '../../theme/theme';

export default function GymSettingsScreen() {
  const queryClient = useQueryClient();
  const gym = useQuery({ queryKey: ['myGym'], queryFn: getMyGym });

  const [target, setTarget] = useState('');
  const [instructorsOnly, setInstructorsOnly] = useState(false);
  const [ready, setReady] = useState(false);

  // Seed local state once the gym loads.
  if (gym.data && !ready) {
    setTarget(String(gym.data.graduationTarget ?? 40));
    setInstructorsOnly(!!gym.data.instructorsOnlyPosts);
    setReady(true);
  }

  const save = useMutation({
    mutationFn: () =>
      updateGymRules({
        graduationTarget: Math.max(1, Math.min(500, Number(target) || 40)),
        instructorsOnlyPosts: instructorsOnly,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myGym'] });
      Alert.alert(t('gym.settings.saved'));
    },
    onError: (e) => Alert.alert(apiErrorMessage(e)),
  });

  const bot = useMutation({
    mutationFn: addTestBot,
    onSuccess: (b) => {
      queryClient.invalidateQueries({ queryKey: ['gymMembers'] });
      queryClient.invalidateQueries({ queryKey: ['communityFeed'] });
      queryClient.invalidateQueries({ queryKey: ['myGym'] });
      Alert.alert(t('gym.settings.bot.added'), `@${b.username}`);
    },
    onError: (e) => Alert.alert(apiErrorMessage(e)),
  });

  if (gym.isLoading || !gym.data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.section}>{t('gym.settings.rules')}</Text>

      <View style={styles.card}>
        <Text style={styles.label}>{t('gym.settings.target')}</Text>
        <Text style={styles.hint}>{t('gym.settings.target.hint')}</Text>
        <TextInput
          mode="outlined"
          value={target}
          onChangeText={(v) => setTarget(v.replace(/[^0-9]/g, ''))}
          keyboardType="number-pad"
          dense
          style={styles.input}
        />
      </View>

      <View style={[styles.card, styles.rowCard]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>{t('gym.settings.instructorsOnly')}</Text>
          <Text style={styles.hint}>{t('gym.settings.instructorsOnly.hint')}</Text>
        </View>
        <Switch
          value={instructorsOnly}
          onValueChange={setInstructorsOnly}
          trackColor={{ true: palette.primary, false: palette.surfaceVariant }}
          thumbColor="#fff"
        />
      </View>

      <Button
        mode="contained"
        icon="content-save"
        loading={save.isPending}
        disabled={save.isPending}
        onPress={() => save.mutate()}
        style={{ marginTop: 6 }}>
        {t('gym.settings.save')}
      </Button>

      <Text style={[styles.section, { marginTop: 28 }]}>{t('gym.settings.testing')}</Text>
      <View style={styles.card}>
        <View style={styles.botHead}>
          <MaterialCommunityIcons name="robot-happy-outline" size={22} color={palette.primary} />
          <Text style={styles.label}>{t('gym.settings.bot')}</Text>
        </View>
        <Text style={styles.hint}>{t('gym.settings.bot.hint')}</Text>
        <Button
          mode="outlined"
          icon="robot"
          loading={bot.isPending}
          disabled={bot.isPending}
          onPress={() => bot.mutate()}
          style={{ marginTop: 12 }}>
          {t('gym.settings.bot.add')}
        </Button>
      </View>
    </ScrollView>
  );
}

const styles = makeStyles(() => ({
  container: { flex: 1, backgroundColor: palette.background },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.background },
  section: { color: palette.textSecondary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  card: { backgroundColor: palette.surface, borderRadius: 14, padding: 16, marginBottom: 12 },
  rowCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  label: { color: palette.textPrimary, fontSize: 15, fontWeight: '600' },
  hint: { color: palette.textSecondary, fontSize: 12, marginTop: 3 },
  input: { backgroundColor: palette.surface, marginTop: 10, width: 120 },
  botHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
}));
