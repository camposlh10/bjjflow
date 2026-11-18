import { BottomTabBar, createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createContext, useContext, useEffect } from 'react';
import { NavigatorScreenParams } from '@react-navigation/native';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';


import CheckInSheet from '../components/CheckInSheet';
import Icon, { type IconName } from '../components/Icon';
import RatingBurst from '../components/RatingBurst';
import ChallengeInvite from '../components/compete/ChallengeInvite';
import SyncBridge from '../components/SyncBridge';
import SyncStatus from '../components/SyncStatus';
import { t } from '../i18n';
import { useCheckInSheet } from '../store/checkInSheetStore';
import GymNavigator, { type GymStackParamList } from './GymNavigator';
import HomeNavigator from './HomeNavigator';
import ProgressNavigator from './ProgressNavigator';
import ProfileNavigator from './ProfileNavigator';
import { makeStyles, palette } from '../theme/theme';

export type AppTabsParamList = {
  Home: undefined;
  Progress: undefined;
  CheckIn: undefined;
  Gym: NavigatorScreenParams<GymStackParamList> | undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<AppTabsParamList>();

function EmptyScreen() {
  return null;
}

/** The focused tab's route name, published by the tab bar. React Navigation
 * draws each icon twice (active + inactive copies), so the icons read focus from
 * here: both copies then animate together. */
const ActiveTab = createContext<string | undefined>(undefined);

/** Tab icon: thin line glyph that lifts slightly when active (tinted red, like its label). */
function TabIcon({ route, name, color }: { route: keyof AppTabsParamList; name: IconName; color: string }) {
  const focused = useContext(ActiveTab) === route;
  const progress = useSharedValue(focused ? 1 : 0);
  useEffect(() => {
    progress.value = focused ? withSpring(1, { damping: 14, stiffness: 180 }) : withTiming(0, { duration: 160 });
  }, [focused, progress]);
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -2 * progress.value }, { scale: 1 + 0.08 * progress.value }],
  }));
  return (
    <View style={styles.iconWrap}>
      <Animated.View style={iconStyle}>
        <Icon name={name} size={24} color={color} strokeWidth={focused ? 2 : 1.5} />
      </Animated.View>
    </View>
  );
}

export default function AppTabs() {
  const checkInOpen = useCheckInSheet((s) => s.visible);
  const openCheckIn = useCheckInSheet((s) => s.open);
  const closeCheckIn = useCheckInSheet((s) => s.close);
  const insets = useSafeAreaInsets();

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
        // Taller than the default 49pt so the labels and the raised Criar button fit.
        tabBarStyle: [styles.tabBar, { height: 64 + insets.bottom, paddingTop: 6, paddingBottom: insets.bottom + 6 }],
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
          // "Criar": the raised red button opens the training check-in sheet.
          tabBarButton: () => (
            <Pressable
              onPress={openCheckIn}
              style={styles.centerWrap}
              accessibilityRole="button"
              accessibilityLabel={t('home.checkin.button')}>
              {({ pressed }) => (
                <>
                  <View style={[styles.centerButton, pressed && styles.centerPressed]}>
                    <Icon name="plus" size={30} color="#FFFFFF" strokeWidth={2.25} />
                  </View>
                  <Text style={styles.centerLabel}>{t('tabs.create')}</Text>
                </>
              )}
            </Pressable>
          ),
        }}
      />
      <Tab.Screen
        name="Gym"
        component={GymNavigator}
        options={{
          tabBarLabel: t('tabs.gym'),
          tabBarIcon: ({ color }) => <TabIcon route="Gym" name="town-hall" color={color} />,
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
    <RatingBurst />
    <ChallengeInvite />
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
    fontSize: 11,
    fontWeight: '600',
  },
  iconWrap: {
    alignItems: 'center',
  },
  centerWrap: {
    flex: 1,
    alignItems: 'center',
  },
  centerButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -24,
    borderWidth: 4,
    borderColor: palette.surface,
  },
  centerLabel: {
    color: palette.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  centerPressed: {
    transform: [{ scale: 0.94 }],
  },
}));
