import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AgendaOccurrence } from '../api/classes';
import { t } from '../i18n';
import ConversationScreen from '../screens/ConversationScreen';
import StudentManagementScreen from '../screens/gym/StudentManagementScreen';
import type { ConversationParams } from './ComunidadeNavigator';
import AdminVerificationsScreen from '../screens/gym/AdminVerificationsScreen';
import AttendanceScreen from '../screens/gym/AttendanceScreen';
import ClassDetailScreen from '../screens/gym/ClassDetailScreen';
import CreateClassScreen from '../screens/gym/CreateClassScreen';
import CreateGymScreen from '../screens/gym/CreateGymScreen';
import CreatePostScreen from '../screens/gym/CreatePostScreen';
import CreateProductScreen from '../screens/gym/CreateProductScreen';
import EditGymScreen from '../screens/gym/EditGymScreen';
import GymHomeScreen from '../screens/gym/GymHomeScreen';
import GymProfileScreen from '../screens/gym/GymProfileScreen';
import GymSettingsScreen from '../screens/gym/GymSettingsScreen';
import GymVerificationScreen from '../screens/gym/GymVerificationScreen';
import JoinGymScreen from '../screens/gym/JoinGymScreen';
import PostDetailScreen from '../screens/gym/PostDetailScreen';
import EditUserProfileScreen from '../screens/EditUserProfileScreen';
import SubmissionsScreen from '../screens/SubmissionsScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
import SavedPostsScreen from '../screens/gym/SavedPostsScreen';
import { palette } from '../theme/theme';

export type GymStackParamList = {
  GymHome: undefined;
  CreateGym: undefined;
  JoinGym: undefined;
  CreatePost: undefined;
  PostDetail: { postId: number };
  SavedPosts: undefined;
  CreateClass: undefined;
  ClassDetail: { occurrence: AgendaOccurrence };
  Attendance: { classId: number; date: string; title: string };
  MemberProfile: { userId: number };
  EditUserProfile: undefined;
  Submissions: { userId?: number } | undefined;
  CreateProduct: undefined;
  GymProfile: undefined;
  EditGym: undefined;
  GymVerification: undefined;
  AdminVerifications: undefined;
  Conversation: ConversationParams;
  StudentManagement: { userId: number };
  GymSettings: undefined;
};

const Stack = createNativeStackNavigator<GymStackParamList>();

export default function GymNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: palette.surface },
        headerTintColor: palette.textPrimary,
        headerTitleStyle: { color: palette.textPrimary },
        contentStyle: { backgroundColor: palette.background },
        animation: 'slide_from_right',
      }}>
      <Stack.Screen name="GymHome" component={GymHomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="CreateGym" component={CreateGymScreen} options={{ title: t('gym.create.title') }} />
      <Stack.Screen name="JoinGym" component={JoinGymScreen} options={{ title: t('gym.join.title') }} />
      <Stack.Screen name="CreatePost" component={CreatePostScreen} options={{ title: t('mural.publish') }} />
      <Stack.Screen
        name="PostDetail"
        component={PostDetailScreen}
        options={{ title: t('post.detail.title') }}
      />
      <Stack.Screen
        name="SavedPosts"
        component={SavedPostsScreen}
        options={{ title: t('mural.saved.title') }}
      />
      <Stack.Screen
        name="CreateClass"
        component={CreateClassScreen}
        options={{ title: t('agenda.class.create.title') }}
      />
      <Stack.Screen
        name="ClassDetail"
        component={ClassDetailScreen}
        options={{ title: t('agenda.detail.title') }}
      />
      <Stack.Screen
        name="Attendance"
        component={AttendanceScreen}
        options={{ title: t('agenda.attendance.title') }}
      />
      <Stack.Screen
        name="MemberProfile"
        component={UserProfileScreen}
        options={{ title: t('member.profile.title') }}
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
      <Stack.Screen
        name="CreateProduct"
        component={CreateProductScreen}
        options={{ title: t('market.create.title') }}
      />
      <Stack.Screen
        name="GymProfile"
        component={GymProfileScreen}
        options={{ title: t('gymProfile.title') }}
      />
      <Stack.Screen
        name="EditGym"
        component={EditGymScreen}
        options={{ title: t('gymProfile.edit.title') }}
      />
      <Stack.Screen
        name="GymVerification"
        component={GymVerificationScreen}
        options={{ title: t('verify.title') }}
      />
      <Stack.Screen
        name="AdminVerifications"
        component={AdminVerificationsScreen}
        options={{ title: t('admin.verifications.title') }}
      />
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
        name="GymSettings"
        component={GymSettingsScreen}
        options={{ title: t('gym.settings.title') }}
      />
    </Stack.Navigator>
  );
}
