import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import { Locale } from '../i18n';
import { useLocaleStore } from '../store/localeStore';
import { makeStyles, palette } from '../theme/theme';

// Language names are shown in their own language (standard convention).
const OPTIONS: { code: Locale; label: string }[] = [
  { code: 'pt', label: 'Português' },
  { code: 'en', label: 'English' },
];

export default function LanguageScreen() {
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        {OPTIONS.map((o) => (
          <Pressable key={o.code} style={styles.row} onPress={() => setLocale(o.code)} android_ripple={{ color: palette.surfaceVariant }}>
            <Text style={styles.label}>{o.label}</Text>
            {locale === o.code && <MaterialCommunityIcons name="check" size={20} color={palette.primary} />}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = makeStyles(() => ({
  screen: { flex: 1, backgroundColor: palette.background, padding: 16 },
  card: { backgroundColor: palette.surface, borderRadius: 14, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  label: { color: palette.textPrimary, fontSize: 16 },
}));
