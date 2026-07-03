import { useQuery } from '@tanstack/react-query';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';

import { getMyGym } from '../../api/gyms';
import { getSavedPosts } from '../../api/posts';
import PostList from '../../components/PostList';
import { t } from '../../i18n';
import { makeStyles, palette } from '../../theme/theme';

export default function SavedPostsScreen() {
  const gym = useQuery({ queryKey: ['myGym'], queryFn: getMyGym });
  const saved = useQuery({ queryKey: ['savedPosts'], queryFn: getSavedPosts });

  if (gym.isLoading || saved.isLoading || !gym.data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <PostList
        posts={saved.data ?? []}
        gym={gym.data}
        emptyText={t('mural.saved.empty')}
        refreshing={saved.isRefetching}
        onRefresh={() => saved.refetch()}
      />
    </View>
  );
}

const styles = makeStyles(() => ({
  container: { flex: 1, backgroundColor: palette.background, paddingHorizontal: 16, paddingTop: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.background },
}));
