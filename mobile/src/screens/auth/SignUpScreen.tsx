import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import Animated, { FadeInRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { apiErrorMessage, register } from '../../api/auth';
import { t } from '../../i18n';
import { AuthStackParamList } from '../../navigation/RootNavigator';
import { useAuthStore } from '../../store/authStore';
import { makeStyles, palette } from '../../theme/theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignUp'>;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignUpScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const onboarding = useAuthStore((s) => s.onboarding);
  const setAuth = useAuthStore((s) => s.setAuth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sem as respostas do onboarding não dá para registrar — volta para o início
  useEffect(() => {
    if (!onboarding.firstName || !onboarding.username || !onboarding.age || !onboarding.beltSlug) {
      navigation.replace('Onboarding');
    }
  }, [onboarding.firstName, onboarding.username, onboarding.age, onboarding.beltSlug, navigation]);

  const mutation = useMutation({
    mutationFn: () =>
      register({
        email: email.trim().toLowerCase(),
        password,
        displayName: [onboarding.firstName, onboarding.lastName].filter(Boolean).join(' ').trim(),
        firstName: onboarding.firstName,
        lastName: onboarding.lastName,
        username: onboarding.username,
        gender: onboarding.gender,
        city: onboarding.city,
        country: onboarding.country,
        state: onboarding.state,
        favoriteArt: onboarding.favoriteArt,
        trainingStartYear: onboarding.trainingStartYear,
        age: onboarding.age!,
        beltSlug: onboarding.beltSlug!,
        stripes: onboarding.stripes ?? 0,
        weightKg: onboarding.weightKg,
        heightCm: onboarding.heightCm,
      }),
    onSuccess: async (data) => {
      await setAuth(
        { accessToken: data.accessToken, refreshToken: data.refreshToken },
        data.user,
      );
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const formValid = EMAIL_REGEX.test(email.trim()) && password.length >= 8;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top + 24 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Animated.View entering={FadeInRight.duration(300)}>
          <Text variant="headlineMedium" style={styles.title}>
            {t('signup.title')}
          </Text>
          <Text variant="bodyLarge" style={styles.subtitle}>
            {t('signup.subtitle')}
          </Text>

          <TextInput
            mode="outlined"
            label={t('signup.email')}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            style={styles.input}
          />
          <TextInput
            mode="outlined"
            label={t('signup.password')}
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
            {t('signup.passwordHint')}
          </Text>

          {error && (
            <Text variant="bodyMedium" style={styles.error}>
              {error}
            </Text>
          )}

          <Button
            mode="contained"
            onPress={() => mutation.mutate()}
            disabled={!formValid || mutation.isPending}
            loading={mutation.isPending}
            contentStyle={styles.buttonContent}
            style={styles.submit}>
            {t('signup.submit')}
          </Button>
          <Button
            mode="text"
            textColor={palette.textSecondary}
            onPress={() => navigation.navigate('LogIn')}>
            {t('signup.haveAccount')}
          </Button>
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
  hint: {
    color: palette.textSecondary,
    marginBottom: 8,
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
