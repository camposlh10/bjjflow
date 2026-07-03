import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Text, TextInput } from 'react-native-paper';

import { apiErrorMessage } from '../api/auth';
import QueryState from '../components/QueryState';
import { enableMfa, disableMfa, enrollMfa, type MfaEnrollResponse } from '../api/mfa';
import { getSettings } from '../api/users';
import { t } from '../i18n';
import { makeStyles, palette } from '../theme/theme';

export default function MfaScreen() {
  const qc = useQueryClient();
  const { data: settings, isLoading, isError, refetch } = useQuery({ queryKey: ['settings'], queryFn: getSettings });

  const [enroll, setEnroll] = useState<MfaEnrollResponse | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const refreshSettings = () => qc.invalidateQueries({ queryKey: ['settings'] });

  const start = useMutation({
    mutationFn: enrollMfa,
    onSuccess: (d) => {
      setError(null);
      setEnroll(d);
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  const enable = useMutation({
    mutationFn: () => enableMfa(code.trim()),
    onSuccess: () => {
      setEnroll(null);
      setCode('');
      setError(null);
      refreshSettings();
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  const disable = useMutation({
    mutationFn: () => disableMfa(password),
    onSuccess: () => {
      setPassword('');
      setError(null);
      refreshSettings();
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  const copySecret = async () => {
    if (enroll) {
      await Clipboard.setStringAsync(enroll.secret);
      Alert.alert(t('mfa.copied'));
    }
  };

  if (isLoading || !settings) {
    return <QueryState isLoading={isLoading} isError={isError} onRetry={() => refetch()} />;
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      <Text style={styles.subtitle}>{t('mfa.subtitle')}</Text>

      {settings.mfaEnabled ? (
        <View style={styles.card}>
          <View style={styles.statusRow}>
            <MaterialCommunityIcons name="shield-check" size={22} color="#16A34A" />
            <Text style={styles.statusOn}>{t('mfa.enabled.title')}</Text>
          </View>
          <Text style={styles.hint}>{t('mfa.enabled.desc')}</Text>
          <Text style={[styles.hint, { marginTop: 16 }]}>{t('mfa.disable.hint')}</Text>
          <TextInput
            mode="outlined"
            label={t('login.password')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            style={styles.input}
          />
          {error && <Text style={styles.error}>{error}</Text>}
          <Button
            mode="contained"
            buttonColor={palette.primary}
            style={styles.btn}
            loading={disable.isPending}
            disabled={!password || disable.isPending}
            onPress={() => disable.mutate()}>
            {t('mfa.disable')}
          </Button>
        </View>
      ) : enroll ? (
        <>
          <View style={styles.card}>
            <Text style={styles.stepTitle}>{t('mfa.step.add')}</Text>
            <Button mode="contained" icon="cellphone-key" style={styles.btn} onPress={() => Linking.openURL(enroll.otpauthUri).catch(() => undefined)}>
              {t('mfa.openApp')}
            </Button>
            <Text style={[styles.hint, { marginTop: 14 }]}>{t('mfa.secret')}</Text>
            <View style={styles.secretRow}>
              <Text selectable style={styles.secret}>
                {enroll.secret}
              </Text>
              <MaterialCommunityIcons name="content-copy" size={20} color={palette.primary} onPress={copySecret} />
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.stepTitle}>{t('mfa.recovery.title')}</Text>
            <View style={styles.recoveryGrid}>
              {enroll.recoveryCodes.map((c) => (
                <Text key={c} selectable style={styles.recovery}>
                  {c}
                </Text>
              ))}
            </View>
            <Text style={styles.hint}>{t('mfa.recovery.hint')}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.stepTitle}>{t('mfa.step.confirm')}</Text>
            <TextInput
              mode="outlined"
              label={t('mfa.code')}
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={6}
              style={styles.input}
            />
            {error && <Text style={styles.error}>{error}</Text>}
            <Button
              mode="contained"
              style={styles.btn}
              loading={enable.isPending}
              disabled={code.trim().length < 6 || enable.isPending}
              onPress={() => enable.mutate()}>
              {t('mfa.confirm')}
            </Button>
          </View>
        </>
      ) : (
        <View style={styles.card}>
          {error && <Text style={styles.error}>{error}</Text>}
          <Button
            mode="contained"
            icon="shield-plus-outline"
            style={styles.btn}
            loading={start.isPending}
            disabled={start.isPending}
            onPress={() => start.mutate()}>
            {t('mfa.enable')}
          </Button>
        </View>
      )}
    </ScrollView>
  );
}

const styles = makeStyles(() => ({
  screen: { flex: 1, backgroundColor: palette.background },
  body: { padding: 16 },
  subtitle: { color: palette.textSecondary, lineHeight: 20, marginBottom: 16 },
  card: { backgroundColor: palette.surface, borderRadius: 14, padding: 16, marginBottom: 14 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusOn: { color: '#16A34A', fontWeight: '700', fontSize: 16 },
  stepTitle: { color: palette.textPrimary, fontWeight: '700', marginBottom: 12 },
  hint: { color: palette.textSecondary, fontSize: 13, lineHeight: 18 },
  input: { backgroundColor: palette.background, marginTop: 10 },
  btn: { borderRadius: 12, marginTop: 8 },
  error: { color: palette.primary, marginTop: 8 },
  secretRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: palette.background,
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
  },
  secret: { color: palette.textPrimary, fontFamily: 'monospace', letterSpacing: 1, flex: 1 },
  recoveryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  recovery: {
    color: palette.textPrimary,
    fontFamily: 'monospace',
    fontSize: 13,
    backgroundColor: palette.background,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
}));
