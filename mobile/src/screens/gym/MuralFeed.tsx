import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, IconButton } from 'react-native-paper';

import { Gym } from '../../api/gyms';
import { getFeed } from '../../api/posts';
import PostList from '../../components/PostList';
import { t } from '../../i18n';
import { GymStackParamList } from '../../navigation/GymNavigator';
import { makeStyles, palette } from '../../theme/theme';

type Nav = NativeStackNavigationProp<GymStackParamList>;

export default function MuralFeed({ gym }: { gym: Gym }) {
  const navigation = useNavigation<Nav>();
  const feed = useQuery({ queryKey: ['gymFeed'], queryFn: getFeed });

  if (feed.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  const header = (
    <View style={styles.headerRow}>
      <Button
        mode="contained"
        icon="plus"
        style={styles.publish}
        contentStyle={styles.publishContent}
        onPress={() => navigation.navigate('CreatePost')}>
        {t('mural.publish')}
      </Button>
      <IconButton
        icon="bookmark-outline"
        iconColor={palette.textSecondary}
        size={22}
        onPress={() => navigation.navigate('SavedPosts')}
        accessibilityLabel={t('a11y.savedPosts')}
      />
    </View>
  );

  return (
    <PostList
      posts={feed.data ?? []}
      gym={gym}
      header={header}
      emptyText={t('mural.empty')}
      refreshing={feed.isRefetching}
      onRefresh={() => feed.refetch()}
    />
  );
}

const styles = makeStyles(() => ({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 18 },
  publish: { flex: 1, borderRadius: 10 },
  publishContent: { paddingVertical: 4 },
}));
