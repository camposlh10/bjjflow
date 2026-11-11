import { MaterialCommunityIcons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Pressable, StyleSheet, View } from 'react-native';

import CheckInSheet from '../components/CheckInSheet';
import SyncBridge from '../components/SyncBridge';
import { t } from '../i18n';
import { useCheckInSheet } from '../store/checkInSheetStore';
import GymNavigator from './GymNavigator';
import HomeNavigator from './HomeNavigator';
import ProgressNavigator from './ProgressNavigator';
import ProfileNavigator from './ProfileNavigator';
import { makeStyles, palette } from '../theme/theme';

export type AppTabsParamList = {
  Home: undefined;
  Progress: undefined;
  CheckIn: undefined;
  Gym: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<AppTabsParamList>();

function EmptyScreen() {
  return null;
}

export default function AppTabs() {
  const checkInOpen = useCheckInSheet((s) => s.visible);
  const openCheckIn = useCheckInSheet((s) => s.open);
  const closeCheckIn = useCheckInSheet((s) => s.close);

  return (
    <>
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: palette.textSecondary,
        tabBarLabelStyle: styles.tabLabel,
      }}>
      <Tab.Screen
        name="Home"
        component={HomeNavigator}
        options={{
          tabBarLabel: t('tabs.home'),
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="home-variant" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Progress"
        component={ProgressNavigator}
        options={{
          tabBarLabel: t('tabs.progress'),
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="chart-line" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="CheckIn"
        component={EmptyScreen}
        options={{
          tabBarLabel: '',
          tabBarButton: () => (
            <View style={styles.centerWrap}>
              <Pressable
                onPress={openCheckIn}
                style={({ pressed }) => [styles.centerButton, pressed && styles.centerPressed]}
                accessibilityLabel={t('home.checkin.button')}>
                <MaterialCommunityIcons name="plus" size={26} color="#FFFFFF" />
              </Pressable>
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="Gym"
        component={GymNavigator}
        options={{
          tabBarLabel: t('tabs.gym'),
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="town-hall" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileNavigator}
        options={{
          tabBarLabel: t('tabs.profile'),
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="account" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
    <CheckInSheet visible={checkInOpen} onClose={closeCheckIn} />
    <SyncBridge />
    </>
  );
}

const styles = makeStyles(() => ({
  tabBar: {
    backgroundColor: palette.surface,
    borderTopColor: palette.surfaceVariant,
  },
  tabLabel: {
    fontSize: 10,
  },
  centerWrap: {
    flex: 1,
    alignItems: 'center',
  },
  centerButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -20,
    borderWidth: 4,
    borderColor: palette.background,
  },
  centerPressed: {
    transform: [{ scale: 0.94 }],
  },
}));
