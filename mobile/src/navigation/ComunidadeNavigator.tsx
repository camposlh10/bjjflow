import { createNativeStackNavigator } from '@react-navigation/native-stack';

import type { FeedItem } from '../api/feed';
import { t } from '../i18n';
import ComunidadeScreen from '../screens/ComunidadeScreen';
import ConversationScreen from '../screens/ConversationScreen';
import DirectInboxScreen from '../screens/DirectInboxScreen';
import EditUserProfileScreen from '../screens/EditUserProfileScreen';
import FeedCommentsScreen from '../screens/FeedCommentsScreen';
import NotificationCenterScreen from '../screens/NotificationCenterScreen';
import StudentManagementScreen from '../screens/gym/StudentManagementScreen';
import SubmissionsScreen from '../screens/SubmissionsScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
import { palette } from '../theme/theme';

export type ConversationParams = {
  conversationId?: number;
  userId?: number;
  title?: string;
  username?: string | null;
  avatarUrl?: string | null;
};

export type ComunidadeStackParamList = {
  ComunidadeFeed: undefined;
  FeedComments: { item: FeedItem };
  UserProfile: { userId?: number } | undefined;
  EditUserProfile: undefined;
  Submissions: { userId?: number } | undefined;
  Direct: undefined;
  Conversation: ConversationParams;
  StudentManagement: { userId: number };
  NotificationCenter: undefined;
};

const Stack = createNativeStackNavigator<ComunidadeStackParamList>();

export default function ComunidadeNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: palette.surface },
        headerTintColor: palette.textPrimary,
        headerTitleStyle: { color: palette.textPrimary },
        contentStyle: { backgroundColor: palette.background },
        animation: 'slide_from_right',
      }}>
      <Stack.Screen name="ComunidadeFeed" component={ComunidadeScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="FeedComments"
        component={FeedCommentsScreen}
        options={{ title: t('feed.comments.title') }}
      />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} options={{ title: t('tabs.profile') }} />
      <Stack.Screen
        name="EditUserProfile"
        component={EditUserProfileScreen}
        options={{ title: t('profile.edit.title') }}
      />
      <Stack.Screen name="Submissions" component={SubmissionsScreen} options={{ title: t('submissions.title') }} />
      <Stack.Screen name="Direct" component={DirectInboxScreen} options={{ title: t('dm.title') }} />
      <Stack.Screen
        name="Conversation"
        component={ConversationScreen}
        options={({ route }) => ({ title: route.params?.title ?? t('dm.title') })}
      />
      <Stack.Screen
        name="StudentManagement"
        component={StudentManagementScreen}
        options={{ title: t('student.manage') }}
      />
      <Stack.Screen
        name="NotificationCenter"
        component={NotificationCenterScreen}
        options={{ title: t('notifications.center.title') }}
      />
    </Stack.Navigator>
  );
}
