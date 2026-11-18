import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { RankingWithMine } from '../../components/compete/RankingList';
import type { GymStackParamList } from '../../navigation/GymNavigator';
import { useAuthStore } from '../../store/authStore';

type Nav = NativeStackNavigationProp<GymStackParamList>;

/** The gym's ranking by rating (the Academia tab's Ranking section). */
export default function RankingScreen() {
  const navigation = useNavigation<Nav>();
  const myUserId = useAuthStore((s) => s.user?.id);
  return (
    <RankingWithMine
      fixedScope="gym"
      padded={false}
      onPressPlayer={(p) => {
        if (p.id !== myUserId) navigation.navigate('MemberProfile', { userId: p.id });
      }}
    />
  );
}
