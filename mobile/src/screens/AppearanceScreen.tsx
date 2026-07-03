import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';
import { Text } from 'react-native-paper';

import { t, type TranslationKey } from '../i18n';
import { ThemePref, useThemeStore } from '../store/themeStore';
import { makeStyles, palette } from '../theme/theme';

const OPTIONS: { pref: ThemePref; key: TranslationKey; icon: string }[] = [
  { pref: 'system', key: 'settings.appearance.system', icon: 'theme-light-dark' },
  { pref: 'light', key: 'settings.appearance.light', icon: 'white-balance-sunny' },
  { pref: 'dark', key: 'settings.appearance.dark', icon: 'moon-waning-crescent' },
];

export default function AppearanceScreen() {
  const preference = useThemeStore((s) => s.preference);
  const setPreference = useThemeStore((s) => s.setPreference);

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        {OPTIONS.map((o) => (
          <Pressable
            key={o.pref}
            style={styles.row}
            onPress={() => setPreference(o.pref)}
            android_ripple={{ color: palette.surfaceVariant }}>
            <MaterialCommunityIcons name={o.icon as never} size={20} color={palette.textSecondary} />
            <Text style={styles.label}>{t(o.key)}</Text>
            {preference === o.pref && <MaterialCommunityIcons name="check" size={20} color={palette.primary} />}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = makeStyles(() => ({
  screen: { flex: 1, backgroundColor: palette.background, padding: 16 },
  card: { backgroundColor: palette.surface, borderRadius: 14, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  label: { color: palette.textPrimary, fontSize: 16, flex: 1 },
}));
