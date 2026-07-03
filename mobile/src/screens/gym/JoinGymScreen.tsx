import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';

import { apiErrorMessage } from '../../api/auth';
import { joinGymByCode } from '../../api/gyms';
import { t } from '../../i18n';
import { makeStyles, palette } from '../../theme/theme';

export default function JoinGymScreen({ navigation }: { navigation: { goBack: () => void } }) {
  const queryClient = useQueryClient();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => joinGymByCode(code.trim().toUpperCase()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myGym'] });
      queryClient.invalidateQueries({ queryKey: ['gymSuggestions'] });
      queryClient.invalidateQueries({ queryKey: ['gymMembers'] });
      navigation.goBack();
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.content}>
        <Text variant="bodyMedium" style={styles.subtitle}>
          {t('gym.join.subtitle')}
        </Text>
        <TextInput
          mode="outlined"
          label={t('gym.join.code')}
          value={code}
          onChangeText={(v) => setCode(v.toUpperCase())}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={12}
          style={styles.input}
        />
        {error && (
          <Text variant="bodyMedium" style={styles.error}>
            {error}
          </Text>
        )}
        <Button
          mode="contained"
          onPress={() => mutation.mutate()}
          disabled={code.trim().length < 4 || mutation.isPending}
          loading={mutation.isPending}
          contentStyle={styles.buttonContent}
          style={styles.submit}>
          {t('gym.join.submit')}
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = makeStyles(() => ({
  container: { flex: 1, backgroundColor: palette.background },
  content: { padding: 20 },
  subtitle: { color: palette.textSecondary, marginBottom: 16 },
  input: { marginBottom: 12 },
  error: { color: palette.primary, marginBottom: 8 },
  submit: { marginTop: 8 },
  buttonContent: { paddingVertical: 6 },
}));
