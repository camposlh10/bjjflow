import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';

import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import LogInScreen from '../screens/auth/LogInScreen';
import OnboardingScreen from '../screens/auth/OnboardingScreen';
import SignUpScreen from '../screens/auth/SignUpScreen';
import WelcomeScreen from '../screens/auth/WelcomeScreen';
import { useAuthStore } from '../store/authStore';
import { makeStyles, palette } from '../theme/theme';
import AppTabs from './AppTabs';

export type AuthStackParamList = {
  Welcome: undefined;
  Onboarding: undefined;
  SignUp: undefined;
  LogIn: undefined;
  ForgotPassword: undefined;
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();

export default function RootNavigator() {
  const hydrated = useAuthStore((s) => s.hydrated);
  const accessToken = useAuthStore((s) => s.accessToken);

  if (!hydrated) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!accessToken) {
    return (
      <AuthStack.Navigator
        screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        <AuthStack.Screen name="Welcome" component={WelcomeScreen} />
        <AuthStack.Screen name="Onboarding" component={OnboardingScreen} />
        <AuthStack.Screen name="SignUp" component={SignUpScreen} />
        <AuthStack.Screen name="LogIn" component={LogInScreen} />
        <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      </AuthStack.Navigator>
    );
  }

  return <AppTabs />;
}

const styles = makeStyles(() => ({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.background,
  },
}));
