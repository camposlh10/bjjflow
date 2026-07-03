import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import SocialAuthButtons from '../../components/SocialAuthButtons';
import { t } from '../../i18n';
import { AuthStackParamList } from '../../navigation/RootNavigator';
import { makeStyles, palette } from '../../theme/theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;

export default function WelcomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.brand}>
        <Animated.View entering={FadeInDown.duration(600)}>
          <Text variant="displayMedium" style={styles.title}>
            BJJ Flow
          </Text>
        </Animated.View>
        <Animated.View entering={FadeInDown.duration(600).delay(200)}>
          <Text variant="titleMedium" style={styles.tagline}>
            {t('welcome.tagline')}
          </Text>
        </Animated.View>
      </View>

      <Animated.View entering={FadeInUp.duration(600).delay(400)} style={styles.actions}>
        <Button
          mode="contained"
          contentStyle={styles.buttonContent}
          onPress={() => navigation.navigate('Onboarding')}>
          {t('welcome.start')}
        </Button>
        <SocialAuthButtons />
        <Button
          mode="text"
          textColor={palette.textSecondary}
          onPress={() => navigation.navigate('LogIn')}>
          {t('welcome.haveAccount')}
        </Button>
      </Animated.View>
    </View>
  );
}

const styles = makeStyles(() => ({
  container: {
    flex: 1,
    backgroundColor: palette.background,
    paddingHorizontal: 24,
  },
  brand: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: palette.textPrimary,
    fontWeight: 'bold',
  },
  tagline: {
    color: palette.primary,
    marginTop: 8,
    letterSpacing: 1,
  },
  actions: {
    gap: 8,
  },
  buttonContent: {
    paddingVertical: 6,
  },
}));
