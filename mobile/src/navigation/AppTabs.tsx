import { BottomTabBar, createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createContext, useContext, useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';


import CheckInSheet from '../components/CheckInSheet';
import Icon, { type IconName } from '../components/Icon';
import SyncBridge from '../components/SyncBridge';
import SyncStatus from '../components/SyncStatus';
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

/**
 * Tab icon: thin line glyph that lifts slightly when active, with a short
 * accent bar sliding in above it.
 */
/** The focused tab's route name, published by the tab bar. React Navigation
 * draws each icon twice (active + inactive copies), so the icons read focus from
 * here: both copies then animate together. */
const ActiveTab = createContext<string | undefined>(undefined);

function TabIcon({ route, name, color }: { route: keyof AppTabsParamList; name: IconName; color: string }) {
  const focused = useContext(ActiveTab) === route;
  const progress = useSharedValue(focused ? 1 : 0);
  useEffect(() => {
    progress.value = focused ? withSpring(1, { damping: 14, stiffness: 180 }) : withTiming(0, { duration: 160 });
  }, [focused, progress]);
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -2 * progress.value }, { scale: 1 + 0.08 * progress.value }],
  }));
  const barStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scaleX: progress.value }],
  }));
  return (
    <View style={styles.iconWrap}>
      <Animated.View style={[styles.activeBar, barStyle]} />
      <Animated.View style={iconStyle}>
        <Icon name={name} size={22} color={color} strokeWidth={focused ? 2 : 1.5} />
      </Animated.View>
    </View>
  );
}

export default function AppTabs() {
  const checkInOpen = useCheckInSheet((s) => s.visible);
  const openCheckIn = useCheckInSheet((s) => s.open);
  const closeCheckIn = useCheckInSheet((s) => s.close);

  return (
    <>
    <Tab.Navigator
      // The sync status pill floats just above the tab bar, on every tab.
      tabBar={(props) => (
        <ActiveTab.Provider value={props.state.routes[props.state.index]?.name}>
          <View>
            <SyncStatus />
            <BottomTabBar {...props} />
          </View>
        </ActiveTab.Provider>
      )}
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: palette.textSecondary,
        tabBarLabelStyle: styles.tabLabel,
        // Switching tabs: the new screen fades in with a short slide.
        animation: 'shift',
      }}>
      <Tab.Screen
        name="Home"
        component={HomeNavigator}
        options={{
          tabBarLabel: t('tabs.home'),
          tabBarIcon: ({ color }) => <TabIcon route="Home" name="home-variant" color={color} />,
        }}
      />
      <Tab.Screen
        name="Progress"
        component={ProgressNavigator}
        options={{
          tabBarLabel: t('tabs.progress'),
          tabBarIcon: ({ color }) => <TabIcon route="Progress" name="chart-line" color={color} />,
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
                <Icon name="plus" size={26} color="#FFFFFF" />
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
          tabBarIcon: ({ color }) => <TabIcon route="CheckIn" name="town-hall" color={color} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileNavigator}
        options={{
          tabBarLabel: t('tabs.profile'),
          tabBarIcon: ({ color }) => <TabIcon route="Profile" name="account" color={color} />,
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
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  iconWrap: {
    alignItems: 'center',
  },
  activeBar: {
    position: 'absolute',
    top: -7,
    width: 18,
    height: 2,
    borderRadius: 1,
    backgroundColor: palette.primary,
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
