import { createNativeStackNavigator } from '@react-navigation/native-stack';

import type { PersonalTechnique } from '../api/techniques';
import { t } from '../i18n';
import BodyMapScreen from '../screens/BodyMapScreen';
import MetricsScreen from '../screens/MetricsScreen';
import PersonalTechniqueEditorScreen from '../screens/PersonalTechniqueEditorScreen';
import ProgressScreen from '../screens/ProgressScreen';
import SubmissionsScreen from '../screens/SubmissionsScreen';
import TechniqueDetailScreen from '../screens/TechniqueDetailScreen';
import TechniquesScreen from '../screens/TechniquesScreen';
import { palette } from '../theme/theme';

/** Progresso: your stats and the tools that feed them (techniques, body map, submissions). */
export type ProgressStackParamList = {
  ProgressMain: undefined;
  Metrics: undefined;
  Techniques: undefined;
  TechniqueDetail: { id: number };
  PersonalTechniqueEditor: { technique?: PersonalTechnique } | undefined;
  BodyMap: undefined;
  Submissions: { userId?: number } | undefined;
};

const Stack = createNativeStackNavigator<ProgressStackParamList>();

export default function ProgressNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: palette.surface },
        headerTintColor: palette.textPrimary,
        headerTitleStyle: { color: palette.textPrimary },
        contentStyle: { backgroundColor: palette.background },
        animation: 'slide_from_right',
      }}>
      <Stack.Screen name="ProgressMain" component={ProgressScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Metrics" component={MetricsScreen} options={{ title: t('metrics.title') }} />
      <Stack.Screen name="Techniques" component={TechniquesScreen} options={{ title: t('techniques.title') }} />
      <Stack.Screen name="TechniqueDetail" component={TechniqueDetailScreen} options={{ title: t('techniques.title') }} />
      <Stack.Screen
        name="PersonalTechniqueEditor"
        component={PersonalTechniqueEditorScreen}
        options={{ title: t('techniques.tab.mine') }}
      />
      <Stack.Screen name="BodyMap" component={BodyMapScreen} options={{ title: t('body.title') }} />
      <Stack.Screen name="Submissions" component={SubmissionsScreen} options={{ title: t('submissions.title') }} />
    </Stack.Navigator>
  );
}
