import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import { t, type TranslationKey } from '../i18n';
import { makeStyles, palette } from '../theme/theme';

// Phase 4: donations are external links only — no in-app payments.
// Replace these placeholder URLs with the real ones when they exist.
const LINKS: { key: string; icon: string; label: TranslationKey; url: string }[] = [
  { key: 'pix', icon: 'qrcode', label: 'donations.pix', url: 'https://livepix.gg/bjjflow' },
  { key: 'coffee', icon: 'coffee', label: 'donations.coffee', url: 'https://www.buymeacoffee.com/bjjflow' },
  { key: 'card', icon: 'credit-card-outline', label: 'donations.card', url: 'https://donate.stripe.com/bjjflow' },
];

export default function DonationsScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.body}>
      <View style={styles.hero}>
        <MaterialCommunityIcons name="heart" size={40} color={palette.primary} />
        <Text style={styles.intro}>{t('donations.intro')}</Text>
      </View>

      {LINKS.map((l) => (
        <Pressable key={l.key} style={styles.row} onPress={() => Linking.openURL(l.url)}>
          <MaterialCommunityIcons name={l.icon as never} size={22} color={palette.primary} />
          <Text style={styles.rowLabel}>{t(l.label)}</Text>
          <MaterialCommunityIcons name="open-in-new" size={18} color={palette.textSecondary} />
        </Pressable>
      ))}

      <Text style={styles.note}>{t('donations.note')}</Text>
    </ScrollView>
  );
}

const styles = makeStyles(() => ({
  screen: { flex: 1, backgroundColor: palette.background },
  body: { padding: 16 },
  hero: { alignItems: 'center', gap: 12, paddingVertical: 24 },
  intro: { color: palette.textPrimary, textAlign: 'center', lineHeight: 22, fontSize: 15 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: palette.surface,
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
  },
  rowLabel: { color: palette.textPrimary, fontWeight: '600', flex: 1 },
  note: { color: palette.textSecondary, fontSize: 12, textAlign: 'center', marginTop: 24, lineHeight: 18 },
}));
