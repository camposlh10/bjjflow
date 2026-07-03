import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';

import { apiErrorMessage } from '../../api/auth';
import { createGym } from '../../api/gyms';
import { t } from '../../i18n';
import { makeStyles, palette } from '../../theme/theme';

export default function CreateGymScreen({ navigation }: { navigation: { goBack: () => void } }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      createGym({
        name: name.trim(),
        city: city.trim() || undefined,
        description: description.trim() || undefined,
      }),
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
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TextInput
          mode="outlined"
          label={t('gym.create.name')}
          value={name}
          onChangeText={setName}
          style={styles.input}
        />
        <TextInput
          mode="outlined"
          label={t('gym.create.city')}
          value={city}
          onChangeText={setCity}
          style={styles.input}
        />
        <TextInput
          mode="outlined"
          label={t('gym.create.description')}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
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
          disabled={name.trim().length === 0 || mutation.isPending}
          loading={mutation.isPending}
          contentStyle={styles.buttonContent}
          style={styles.submit}>
          {t('gym.create.submit')}
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = makeStyles(() => ({
  container: { flex: 1, backgroundColor: palette.background },
  content: { padding: 20 },
  input: { marginBottom: 12 },
  error: { color: palette.primary, marginBottom: 8 },
  submit: { marginTop: 8 },
  buttonContent: { paddingVertical: 6 },
}));
