import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import Animated, { FadeInRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { apiErrorMessage, forgotPassword, resetPassword } from '../../api/auth';
import { t } from '../../i18n';
import { AuthStackParamList } from '../../navigation/RootNavigator';
import { makeStyles, palette } from '../../theme/theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const request = useMutation({
    mutationFn: () => forgotPassword(email),
    onSuccess: () => {
      setError(null);
      setStep('reset');
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  const reset = useMutation({
    mutationFn: () => resetPassword(email, code, password),
    onSuccess: () => {
      Alert.alert(t('forgot.success'));
      navigation.navigate('LogIn');
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  const emailValid = EMAIL_REGEX.test(email.trim());
  const resetValid = code.trim().length >= 4 && password.length >= 8;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top + 24 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Animated.View entering={FadeInRight.duration(300)}>
          <Text variant="headlineMedium" style={styles.title}>
            {t('forgot.title')}
          </Text>

          {step === 'request' ? (
            <>
              <Text variant="bodyLarge" style={styles.subtitle}>
                {t('forgot.subtitle.request')}
              </Text>
              <TextInput
                mode="outlined"
                label={t('forgot.email')}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                autoFocus
                style={styles.input}
              />
              {error && <Text variant="bodyMedium" style={styles.error}>{error}</Text>}
              <Button
                mode="contained"
                onPress={() => request.mutate()}
                disabled={!emailValid || request.isPending}
                loading={request.isPending}
                contentStyle={styles.buttonContent}
                style={styles.submit}>
                {t('forgot.send')}
              </Button>
            </>
          ) : (
            <>
              <Text variant="bodyLarge" style={styles.subtitle}>
                {t('forgot.subtitle.reset')}
              </Text>
              <TextInput
                mode="outlined"
                label={t('forgot.code')}
                value={code}
                onChangeText={(v) => setCode(v.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                autoFocus
                maxLength={6}
                style={styles.input}
              />
              <TextInput
                mode="outlined"
                label={t('forgot.newPassword')}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                right={
                  <TextInput.Icon
                    icon={showPassword ? 'eye-off' : 'eye'}
                    onPress={() => setShowPassword((v) => !v)}
                  />
                }
                style={styles.input}
              />
              <Text variant="bodySmall" style={styles.hint}>
                {t('forgot.passwordHint')}
              </Text>
              {error && <Text variant="bodyMedium" style={styles.error}>{error}</Text>}
              <Button
                mode="contained"
                onPress={() => reset.mutate()}
                disabled={!resetValid || reset.isPending}
                loading={reset.isPending}
                contentStyle={styles.buttonContent}
                style={styles.submit}>
                {t('forgot.reset')}
              </Button>
              <Button mode="text" textColor={palette.textSecondary} onPress={() => request.mutate()} disabled={request.isPending}>
                {t('forgot.resend')}
              </Button>
            </>
          )}

          <Button mode="text" textColor={palette.textSecondary} onPress={() => navigation.navigate('LogIn')}>
            {t('forgot.back')}
          </Button>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = makeStyles(() => ({
  container: { flex: 1, backgroundColor: palette.background },
  content: { paddingHorizontal: 24, paddingBottom: 32 },
  title: { color: palette.textPrimary, fontWeight: 'bold', marginBottom: 8 },
  subtitle: { color: palette.textSecondary, marginBottom: 24 },
  input: { marginBottom: 12 },
  hint: { color: palette.textSecondary, marginBottom: 8 },
  error: { color: palette.primary, marginTop: 8 },
  submit: { marginTop: 16, marginBottom: 8 },
  buttonContent: { paddingVertical: 6 },
}));
