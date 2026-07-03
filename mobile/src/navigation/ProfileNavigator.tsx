import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { t } from '../i18n';
import AccountScreen from '../screens/AccountScreen';
import AppearanceScreen from '../screens/AppearanceScreen';
import DonationsScreen from '../screens/DonationsScreen';
import EditUserProfileScreen from '../screens/EditUserProfileScreen';
import HelpScreen from '../screens/HelpScreen';
import LanguageScreen from '../screens/LanguageScreen';
import MfaScreen from '../screens/MfaScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import PrivacyScreen from '../screens/PrivacyScreen';
import SettingsScreen from '../screens/SettingsScreen';
import SubmissionsScreen from '../screens/SubmissionsScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
import { palette } from '../theme/theme';

export type ProfileStackParamList = {
  UserProfile: { userId?: number } | undefined;
  EditUserProfile: undefined;
  Submissions: { userId?: number } | undefined;
  Settings: undefined;
  Account: undefined;
  Notifications: undefined;
  Privacy: undefined;
  Help: undefined;
  Mfa: undefined;
  Language: undefined;
  Appearance: undefined;
  Donations: undefined;
};

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export default function ProfileNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: palette.surface },
        headerTintColor: palette.textPrimary,
        headerTitleStyle: { color: palette.textPrimary },
        contentStyle: { backgroundColor: palette.background },
        animation: 'slide_from_right',
      }}>
      <Stack.Screen
        name="UserProfile"
        component={UserProfileScreen}
        options={{ title: t('tabs.profile'), headerStyle: { backgroundColor: palette.background }, headerShadowVisible: false }}
      />
      <Stack.Screen
        name="EditUserProfile"
        component={EditUserProfileScreen}
        options={{ title: t('profile.edit.title') }}
      />
      <Stack.Screen
        name="Submissions"
        component={SubmissionsScreen}
        options={{ title: t('submissions.title') }}
      />
      {/* Settings + its sub-screens are registered here so the profile gear opens
          them within the Profile tab (back returns to the profile). */}
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: t('settings.title') }} />
      <Stack.Screen name="Account" component={AccountScreen} options={{ title: t('settings.account') }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: t('settings.notifications') }} />
      <Stack.Screen name="Privacy" component={PrivacyScreen} options={{ title: t('settings.privacy') }} />
      <Stack.Screen name="Help" component={HelpScreen} options={{ title: t('settings.help') }} />
      <Stack.Screen name="Mfa" component={MfaScreen} options={{ title: t('mfa.title') }} />
      <Stack.Screen name="Language" component={LanguageScreen} options={{ title: t('language.title') }} />
      <Stack.Screen name="Appearance" component={AppearanceScreen} options={{ title: t('settings.appearance') }} />
      <Stack.Screen name="Donations" component={DonationsScreen} options={{ title: t('donations.title') }} />
    </Stack.Navigator>
  );
}
