import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ComponentProps } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import { togglePro } from '../api/users';
import { t } from '../i18n';
import { useAuthStore } from '../store/authStore';
import { useLocaleStore } from '../store/localeStore';
import { useThemeStore } from '../store/themeStore';
import { makeStyles, palette } from '../theme/theme';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

function Row({
  icon,
  label,
  value,
  soon,
  danger,
  onPress,
}: {
  icon: IconName;
  label: string;
  value?: string;
  soon?: boolean;
  danger?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      style={styles.row}
      onPress={onPress ?? (soon ? () => Alert.alert(t('common.soon')) : undefined)}
      android_ripple={{ color: palette.surfaceVariant }}>
      <MaterialCommunityIcons name={icon} size={20} color={danger ? palette.primary : palette.textSecondary} />
      <Text style={[styles.rowLabel, danger && { color: palette.primary }]} numberOfLines={1}>
        {label}
      </Text>
      {value ? (
        <Text style={styles.rowValue} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {soon && <Text style={styles.soon}>{t('settings.soon')}</Text>}
      {!danger && !soon && <MaterialCommunityIcons name="chevron-right" size={18} color={palette.outline} />}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);
  const locale = useLocaleStore((s) => s.locale);
  const themePref = useThemeStore((s) => s.preference);

  const pro = useMutation({
    mutationFn: togglePro,
    onSuccess: (p) => {
      if (user) setUser({ ...user, pro: p.pro });
      queryClient.invalidateQueries({ queryKey: ['userProfile', user?.id ?? 0] });
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });

  const confirmLogout = () =>
    Alert.alert(t('settings.logout'), t('settings.logout.confirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('settings.logout'), style: 'destructive', onPress: () => logout() },
    ]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.section}>{t('settings.account')}</Text>
      <View style={styles.card}>
        <Row icon="account-edit" label={t('settings.editProfile')} onPress={() => navigation.navigate('EditUserProfile')} />
        <Row icon="at" label={t('settings.username')} value={user?.username ? `@${user.username}` : '—'} onPress={() => navigation.navigate('EditUserProfile')} />
        <Row icon="email-outline" label={t('settings.email')} value={user?.email} onPress={() => navigation.navigate('Account')} />
        <Row icon="lock-outline" label={t('settings.password')} onPress={() => navigation.navigate('Account')} />
        <Row icon="shield-check-outline" label={t('settings.mfa')} onPress={() => navigation.navigate('Mfa')} />
      </View>

      <Text style={styles.section}>{t('settings.preferences')}</Text>
      <View style={styles.card}>
        <Row icon="bell-outline" label={t('settings.notifications')} onPress={() => navigation.navigate('Notifications')} />
        <Row icon="lock-outline" label={t('settings.privacy')} onPress={() => navigation.navigate('Privacy')} />
        <Row
          icon="theme-light-dark"
          label={t('settings.appearance')}
          value={
            themePref === 'light'
              ? t('settings.appearance.light')
              : themePref === 'system'
                ? t('settings.appearance.system')
                : t('settings.appearance.dark')
          }
          onPress={() => navigation.navigate('Appearance')}
        />
        <Row
          icon="translate"
          label={t('settings.language')}
          value={locale === 'en' ? t('settings.language.en') : t('settings.language.pt')}
          onPress={() => navigation.navigate('Language')}
        />
      </View>

      <Text style={styles.section}>{t('settings.subscription')}</Text>
      <View style={styles.card}>
        <Row
          icon="star-outline"
          label={t('settings.plan')}
          value={user?.pro ? t('settings.plan.pro') : t('settings.plan.free')}
          onPress={() => pro.mutate()}
        />
      </View>

      <Text style={styles.section}>{t('settings.support')}</Text>
      <View style={styles.card}>
        <Row icon="help-circle-outline" label={t('settings.help')} onPress={() => navigation.navigate('Help')} />
        <Row icon="message-alert-outline" label={t('settings.feedback')} onPress={() => navigation.navigate('Help')} />
        <Row icon="heart-outline" label={t('settings.donations')} onPress={() => navigation.navigate('Donations')} />
      </View>

      <View style={[styles.card, { marginTop: 18 }]}>
        <Row icon="logout" label={t('settings.logout')} danger onPress={confirmLogout} />
      </View>

      <Text style={styles.version}>BJJ Flow</Text>
    </ScrollView>
  );
}

const styles = makeStyles(() => ({
  container: { flex: 1, backgroundColor: palette.background },
  content: { padding: 16, paddingBottom: 40 },
  section: {
    color: palette.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 14,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: { backgroundColor: palette.surface, borderRadius: 14, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 14 },
  rowLabel: { color: palette.textPrimary, fontSize: 15, flex: 1 },
  rowValue: { color: palette.textSecondary, fontSize: 13, maxWidth: 160 },
  soon: { color: palette.textSecondary, fontSize: 10, backgroundColor: palette.surfaceVariant, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, overflow: 'hidden' },
  version: { color: palette.outline, fontSize: 12, textAlign: 'center', marginTop: 24 },
}));
