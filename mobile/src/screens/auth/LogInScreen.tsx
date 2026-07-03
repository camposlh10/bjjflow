import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import Animated, { FadeInRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { apiErrorMessage, completeMfa, login } from '../../api/auth';
import SocialAuthButtons from '../../components/SocialAuthButtons';
import { t } from '../../i18n';
import { AuthStackParamList } from '../../navigation/RootNavigator';
import { useAuthStore } from '../../store/authStore';
import { makeStyles, palette } from '../../theme/theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'LogIn'>;

export default function LogInScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [code, setCode] = useState('');

  const mutation = useMutation({
    mutationFn: () => login(email.trim().toLowerCase(), password),
    onSuccess: async (data) => {
      if (data.mfaRequired && data.mfaToken) {
        setError(null);
        setMfaToken(data.mfaToken);
        return;
      }
      await setAuth(
        { accessToken: data.accessToken, refreshToken: data.refreshToken },
        data.user,
      );
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const verify = useMutation({
    mutationFn: () => completeMfa(mfaToken!, code.trim()),
    onSuccess: async (data) => {
      await setAuth(
        { accessToken: data.accessToken, refreshToken: data.refreshToken },
        data.user,
      );
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const cancelMfa = () => {
    setMfaToken(null);
    setCode('');
    setError(null);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top + 24 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Animated.View entering={FadeInRight.duration(300)}>
          {mfaToken ? (
            <>
              <Text variant="headlineMedium" style={styles.title}>
                {t('mfa.challenge.title')}
              </Text>
              <Text variant="bodyLarge" style={styles.subtitle}>
                {t('mfa.challenge.subtitle')}
              </Text>
              <TextInput
                mode="outlined"
                label={t('mfa.code')}
                value={code}
                onChangeText={setCode}
                autoCapitalize="characters"
                autoCorrect={false}
                autoFocus
                maxLength={9}
                style={styles.input}
              />
              {error && (
                <Text variant="bodyMedium" style={styles.error}>
                  {error}
                </Text>
              )}
              <Button
                mode="contained"
                onPress={() => verify.mutate()}
                disabled={code.trim().length < 6 || verify.isPending}
                loading={verify.isPending}
                contentStyle={styles.buttonContent}
                style={styles.submit}>
                {t('mfa.challenge.verify')}
              </Button>
              <Button mode="text" textColor={palette.textSecondary} onPress={cancelMfa}>
                {t('mfa.challenge.back')}
              </Button>
            </>
          ) : (
            <>
              <Text variant="headlineMedium" style={styles.title}>
                {t('login.title')}
              </Text>
              <Text variant="bodyLarge" style={styles.subtitle}>
                {t('login.subtitle')}
              </Text>

              <TextInput
                mode="outlined"
                label={t('login.email')}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                style={styles.input}
              />
              <TextInput
                mode="outlined"
                label={t('login.password')}
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

              {error && (
                <Text variant="bodyMedium" style={styles.error}>
                  {error}
                </Text>
              )}

              <Button
                mode="contained"
                onPress={() => mutation.mutate()}
                disabled={!email || !password || mutation.isPending}
                loading={mutation.isPending}
                contentStyle={styles.buttonContent}
                style={styles.submit}>
                {t('login.submit')}
              </Button>
              <Button
                mode="text"
                textColor={palette.textSecondary}
                onPress={() => navigation.navigate('ForgotPassword')}>
                {t('login.forgot')}
              </Button>
              <SocialAuthButtons />
              <Button
                mode="text"
                textColor={palette.textSecondary}
                onPress={() => navigation.navigate('Onboarding')}>
                {t('login.noAccount')}
              </Button>
            </>
          )}
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = makeStyles(() => ({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  title: {
    color: palette.textPrimary,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    color: palette.textSecondary,
    marginBottom: 24,
  },
  input: {
    marginBottom: 12,
  },
  error: {
    color: palette.primary,
    marginTop: 8,
  },
  submit: {
    marginTop: 16,
    marginBottom: 8,
  },
  buttonContent: {
    paddingVertical: 6,
  },
}));
