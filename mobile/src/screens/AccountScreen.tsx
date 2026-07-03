import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Text, TextInput } from 'react-native-paper';

import { apiErrorMessage } from '../api/auth';
import { changeEmail, changePassword, getSettings } from '../api/users';
import { t } from '../i18n';
import { makeStyles, palette } from '../theme/theme';

export default function AccountScreen() {
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ['settings'], queryFn: getSettings });

  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');

  const emailMut = useMutation({
    mutationFn: () => changeEmail(emailPassword, newEmail.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      setNewEmail('');
      setEmailPassword('');
      Alert.alert(t('account.email.saved'));
    },
    onError: (e) => Alert.alert(apiErrorMessage(e)),
  });

  const passwordMut = useMutation({
    mutationFn: () => changePassword(current, next),
    onSuccess: () => {
      setCurrent('');
      setNext('');
      Alert.alert(t('account.password.saved'));
    },
    onError: (e) => Alert.alert(apiErrorMessage(e)),
  });

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.section}>{t('account.email')}</Text>
        <View style={styles.card}>
          <Text style={styles.current}>
            {t('account.email.current')}: {settings.data ? settings.data.email : <ActivityIndicator size={12} />}
          </Text>
          <TextInput
            mode="outlined"
            label={t('account.email.new')}
            value={newEmail}
            onChangeText={setNewEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            style={styles.input}
          />
          <TextInput
            mode="outlined"
            label={t('account.email.password')}
            value={emailPassword}
            onChangeText={setEmailPassword}
            secureTextEntry
            style={styles.input}
          />
          <Button
            mode="contained"
            disabled={newEmail.trim().length < 3 || emailPassword.length < 8 || emailMut.isPending}
            loading={emailMut.isPending}
            onPress={() => emailMut.mutate()}
            style={styles.btn}>
            {t('account.email.change')}
          </Button>
        </View>

        <Text style={styles.section}>{t('account.password')}</Text>
        <View style={styles.card}>
          <TextInput
            mode="outlined"
            label={t('account.password.current')}
            value={current}
            onChangeText={setCurrent}
            secureTextEntry
            style={styles.input}
          />
          <TextInput
            mode="outlined"
            label={t('account.password.new')}
            value={next}
            onChangeText={setNext}
            secureTextEntry
            style={styles.input}
          />
          <Text style={styles.hint}>{t('account.password.hint')}</Text>
          <Button
            mode="contained"
            disabled={current.length < 8 || next.length < 8 || passwordMut.isPending}
            loading={passwordMut.isPending}
            onPress={() => passwordMut.mutate()}
            style={styles.btn}>
            {t('account.password.change')}
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = makeStyles(() => ({
  container: { flex: 1, backgroundColor: palette.background },
  content: { padding: 16, paddingBottom: 40 },
  section: { color: palette.textSecondary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 8, marginBottom: 8, marginLeft: 4 },
  card: { backgroundColor: palette.surface, borderRadius: 14, padding: 16, marginBottom: 16 },
  current: { color: palette.textSecondary, fontSize: 13, marginBottom: 10 },
  input: { backgroundColor: palette.surface, marginBottom: 10 },
  hint: { color: palette.textSecondary, fontSize: 11, marginBottom: 8 },
  btn: { marginTop: 4 },
}));
