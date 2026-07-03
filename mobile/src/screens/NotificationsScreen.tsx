import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';

import { Settings, getSettings, updateSettings } from '../api/users';
import { t } from '../i18n';
import { makeStyles, palette } from '../theme/theme';

export default function NotificationsScreen() {
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ['settings'], queryFn: getSettings });

  const mut = useMutation({
    mutationFn: (patch: Partial<Settings>) => updateSettings(patch),
    onSuccess: (data) => queryClient.setQueryData(['settings'], data),
  });

  if (settings.isLoading || !settings.data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }
  const s = settings.data;

  const rows: { key: keyof Settings; label: string; value: boolean }[] = [
    { key: 'notifyCommunity', label: t('notif.community'), value: s.notifyCommunity },
    { key: 'notifyMessages', label: t('notif.messages'), value: s.notifyMessages },
    { key: 'notifyPromotions', label: t('notif.promotions'), value: s.notifyPromotions },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        {rows.map((r, i) => (
          <View key={r.key} style={[styles.row, i > 0 && styles.divider]}>
            <Text style={styles.label}>{r.label}</Text>
            <Switch
              value={r.value}
              onValueChange={(v) => mut.mutate({ [r.key]: v } as Partial<Settings>)}
              trackColor={{ true: palette.primary, false: palette.surfaceVariant }}
              thumbColor="#fff"
            />
          </View>
        ))}
      </View>
      <Text style={styles.note}>{t('notif.note')}</Text>
    </ScrollView>
  );
}

const styles = makeStyles(() => ({
  container: { flex: 1, backgroundColor: palette.background },
  content: { padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.background },
  card: { backgroundColor: palette.surface, borderRadius: 14, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.surfaceVariant },
  label: { color: palette.textPrimary, fontSize: 15, flex: 1 },
  note: { color: palette.textSecondary, fontSize: 12, marginTop: 14, marginHorizontal: 4 },
}));
