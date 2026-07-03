import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Alert, FlatList, Image, Linking, Pressable, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Text } from 'react-native-paper';

import { apiErrorMessage } from '../../api/auth';
import { Gym } from '../../api/gyms';
import { Product, buyProduct, deleteProduct, formatPrice, getProducts } from '../../api/market';
import { resolveMediaUrl } from '../../api/posts';
import { t, tf } from '../../i18n';
import { GymStackParamList } from '../../navigation/GymNavigator';
import { makeStyles, palette } from '../../theme/theme';

type Nav = NativeStackNavigationProp<GymStackParamList>;

export default function MercadoScreen({ gym }: { gym: Gym }) {
  const navigation = useNavigation<Nav>();
  const queryClient = useQueryClient();
  const staff = gym.role === 'OWNER' || gym.role === 'INSTRUCTOR';

  const products = useQuery({ queryKey: ['gymProducts'], queryFn: getProducts });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['gymProducts'] });

  const buy = useMutation({
    mutationFn: (p: Product) => buyProduct(p.id),
    onSuccess: (_, p) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      invalidate();
      if (p.link) {
        Linking.openURL(p.link).catch(() => undefined);
      } else {
        Alert.alert(t('market.bought'));
      }
    },
    onError: (e) => Alert.alert(apiErrorMessage(e)),
  });

  const remove = useMutation({ mutationFn: (id: number) => deleteProduct(id), onSuccess: invalidate });

  const confirmDelete = (p: Product) =>
    Alert.alert(t('market.delete.title'), t('market.delete.message'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('market.delete'), style: 'destructive', onPress: () => remove.mutate(p.id) },
    ]);

  if (products.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <FlatList
      data={products.data ?? []}
      keyExtractor={(p) => String(p.id)}
      numColumns={2}
      columnWrapperStyle={styles.columns}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        staff ? (
          <Button
            mode="outlined"
            icon="plus"
            textColor={palette.primary}
            style={styles.add}
            onPress={() => navigation.navigate('CreateProduct')}>
            {t('market.add')}
          </Button>
        ) : undefined
      }
      ListEmptyComponent={<Text style={styles.empty}>{t('market.empty')}</Text>}
      renderItem={({ item }) => (
        <Pressable
          style={styles.card}
          onLongPress={staff ? () => confirmDelete(item) : undefined}
          delayLongPress={400}>
          <View style={styles.imageBox}>
            {item.imageUrl ? (
              <Image source={{ uri: resolveMediaUrl(item.imageUrl) }} style={styles.image} resizeMode="contain" />
            ) : (
              <MaterialCommunityIcons name="tshirt-crew" size={32} color={palette.outline} />
            )}
          </View>
          <Text numberOfLines={1} style={styles.name}>
            {item.name}
          </Text>
          {item.description && (
            <Text numberOfLines={2} style={styles.desc}>
              {item.description}
            </Text>
          )}
          <Text style={styles.price}>{formatPrice(item.priceCents)}</Text>
          {staff && item.orderCount > 0 && (
            <Text style={styles.orders}>{tf('market.orders', { n: item.orderCount })}</Text>
          )}
          <Button
            mode="contained"
            compact
            labelStyle={styles.buyLabel}
            onPress={() => buy.mutate(item)}
            disabled={buy.isPending}>
            {t('market.buy')}
          </Button>
        </Pressable>
      )}
    />
  );
}

const styles = makeStyles(() => ({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  content: { paddingBottom: 24 },
  columns: { gap: 10 },
  add: { borderColor: palette.primary, marginBottom: 14 },
  empty: { color: palette.textSecondary, textAlign: 'center', paddingVertical: 32 },
  card: {
    flex: 1,
    backgroundColor: palette.surface,
    borderRadius: 14,
    padding: 10,
    marginBottom: 10,
  },
  imageBox: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 10,
    backgroundColor: palette.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 8,
  },
  image: { width: '100%', height: '100%' },
  name: { color: palette.textPrimary, fontSize: 12, fontWeight: 'bold' },
  desc: { color: palette.textSecondary, fontSize: 10, marginTop: 2 },
  price: { color: palette.textPrimary, fontSize: 13, fontWeight: 'bold', marginVertical: 6 },
  orders: { color: palette.textSecondary, fontSize: 10, marginBottom: 6 },
  buyLabel: { fontSize: 11, marginVertical: 4 },
}));
