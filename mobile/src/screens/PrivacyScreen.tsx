import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';

import { Settings, getSettings, updateSettings } from '../api/users';
import { t } from '../i18n';
import { makeStyles, palette } from '../theme/theme';

export default function PrivacyScreen() {
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
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
      </View>
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
  note: { color: palette.textSecondary, fontSize: 12, marginTop: 14, marginHorizontal: 4 },
}));
