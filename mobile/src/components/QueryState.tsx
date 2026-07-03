import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Text } from 'react-native-paper';

import { t } from '../i18n';
import { makeStyles, palette } from '../theme/theme';

/**
 * Standard loading/error block for a screen whose body needs a fetched value.
 * Crucial: it NEVER spins forever — once the query errors it shows a retry button
 * instead of a perpetual spinner. Use in place of `return <ActivityIndicator/>`.
 */
export default function QueryState({
  isLoading,
  isError,
  onRetry,
}: {
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  if (isError && !isLoading) {
    return (
      <View style={styles.wrap}>
        <MaterialCommunityIcons name="cloud-off-outline" size={44} color={palette.surfaceVariant} />
        <Text style={styles.text}>{t('common.loadError')}</Text>
        <Pressable
          style={styles.retry}
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel={t('common.retry')}>
          <MaterialCommunityIcons name="refresh" size={16} color={palette.primary} />
          <Text style={styles.retryText}>{t('common.retry')}</Text>
        </Pressable>
      </View>
    );
  }
  return <ActivityIndicator style={{ marginTop: 48 }} color={palette.primary} />;
}

const styles = makeStyles(() => ({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  text: { color: palette.textSecondary, fontSize: 14, textAlign: 'center' },
  retry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: palette.surface,
  },
  retryText: { color: palette.primary, fontWeight: '700', fontSize: 13 },
}));
