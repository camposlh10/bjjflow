import { createNativeStackNavigator } from '@react-navigation/native-stack';

import type { PersonalTechnique } from '../api/techniques';
import { t } from '../i18n';
import AccountScreen from '../screens/AccountScreen';
import AppearanceScreen from '../screens/AppearanceScreen';
import BodyMapScreen from '../screens/BodyMapScreen';
import DonationsScreen from '../screens/DonationsScreen';
import EditUserProfileScreen from '../screens/EditUserProfileScreen';
import HelpScreen from '../screens/HelpScreen';
import HomeScreen from '../screens/HomeScreen';
import LanguageScreen from '../screens/LanguageScreen';
import MetricsScreen from '../screens/MetricsScreen';
import MfaScreen from '../screens/MfaScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import PersonalTechniqueEditorScreen from '../screens/PersonalTechniqueEditorScreen';
import PrivacyScreen from '../screens/PrivacyScreen';
import SettingsScreen from '../screens/SettingsScreen';
import SubmissionsScreen from '../screens/SubmissionsScreen';
import TechniqueDetailScreen from '../screens/TechniqueDetailScreen';
import TechniquesScreen from '../screens/TechniquesScreen';
import { palette } from '../theme/theme';

export type HomeStackParamList = {
  HomeMain: undefined;
  Settings: undefined;
  EditUserProfile: undefined;
  Account: undefined;
  Notifications: undefined;
  Privacy: undefined;
  Help: undefined;
  Metrics: undefined;
  Mfa: undefined;
  Language: undefined;
  Appearance: undefined;
  Techniques: undefined;
  TechniqueDetail: { id: number };
  PersonalTechniqueEditor: { technique?: PersonalTechnique } | undefined;
  Donations: undefined;
  BodyMap: undefined;
  Submissions: { userId?: number } | undefined;
};

const Stack = createNativeStackNavigator<HomeStackParamList>();

export default function HomeNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: palette.surface },
        headerTintColor: palette.textPrimary,
        headerTitleStyle: { color: palette.textPrimary },
        contentStyle: { backgroundColor: palette.background },
        animation: 'slide_from_right',
      }}>
      <Stack.Screen name="HomeMain" component={HomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: t('settings.title') }} />
      <Stack.Screen
        name="EditUserProfile"
        component={EditUserProfileScreen}
        options={{ title: t('profile.edit.title') }}
      />
      <Stack.Screen name="Account" component={AccountScreen} options={{ title: t('settings.account') }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: t('settings.notifications') }} />
      <Stack.Screen name="Privacy" component={PrivacyScreen} options={{ title: t('settings.privacy') }} />
      <Stack.Screen name="Help" component={HelpScreen} options={{ title: t('settings.help') }} />
      <Stack.Screen name="Metrics" component={MetricsScreen} options={{ title: t('metrics.title') }} />
      <Stack.Screen name="Mfa" component={MfaScreen} options={{ title: t('mfa.title') }} />
      <Stack.Screen name="Language" component={LanguageScreen} options={{ title: t('language.title') }} />
      <Stack.Screen name="Appearance" component={AppearanceScreen} options={{ title: t('settings.appearance') }} />
      <Stack.Screen name="Techniques" component={TechniquesScreen} options={{ title: t('techniques.title') }} />
      <Stack.Screen
        name="TechniqueDetail"
        component={TechniqueDetailScreen}
        options={{ title: t('techniques.title') }}
      />
      <Stack.Screen
        name="PersonalTechniqueEditor"
        component={PersonalTechniqueEditorScreen}
        options={{ title: t('techniques.tab.mine') }}
      />
      <Stack.Screen name="Donations" component={DonationsScreen} options={{ title: t('donations.title') }} />
      <Stack.Screen name="BodyMap" component={BodyMapScreen} options={{ title: t('body.title') }} />
      <Stack.Screen name="Submissions" component={SubmissionsScreen} options={{ title: t('submissions.title') }} />
    </Stack.Navigator>
  );
}
