import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';

import { apiErrorMessage } from '../api/auth';
import { sendFeedback } from '../api/users';
import { t } from '../i18n';
import { makeStyles, palette } from '../theme/theme';

const FAQ: { q: string; a: string }[] = [
  { q: 'faq.checkin.q', a: 'faq.checkin.a' },
  { q: 'faq.streak.q', a: 'faq.streak.a' },
  { q: 'faq.graduate.q', a: 'faq.graduate.a' },
  { q: 'faq.private.q', a: 'faq.private.a' },
];

function FaqItem({ qKey, aKey }: { qKey: string; aKey: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Pressable style={styles.faqRow} onPress={() => setOpen((o) => !o)}>
      <View style={styles.faqHead}>
        <Text style={styles.faqQ}>{t(qKey as never)}</Text>
        <MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={palette.textSecondary} />
      </View>
      {open && <Text style={styles.faqA}>{t(aKey as never)}</Text>}
    </Pressable>
  );
}

export default function HelpScreen() {
  const [message, setMessage] = useState('');
  const feedback = useMutation({
    mutationFn: () => sendFeedback(message.trim()),
    onSuccess: () => {
      setMessage('');
      Alert.alert(t('help.feedback.sent'));
    },
    onError: (e) => Alert.alert(apiErrorMessage(e)),
  });

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.section}>{t('help.faq')}</Text>
        <View style={styles.card}>
          {FAQ.map((f, i) => (
            <View key={i} style={i > 0 ? styles.divider : undefined}>
              <FaqItem qKey={f.q} aKey={f.a} />
            </View>
          ))}
        </View>

        <Text style={styles.section}>{t('help.feedback')}</Text>
        <View style={styles.card}>
          <Text style={styles.hint}>{t('help.feedback.hint')}</Text>
          <TextInput
            mode="outlined"
            value={message}
            onChangeText={setMessage}
            placeholder={t('help.feedback.placeholder')}
            multiline
            numberOfLines={4}
            style={styles.input}
          />
          <Button
            mode="contained"
            icon="send"
            disabled={message.trim().length < 3 || feedback.isPending}
            loading={feedback.isPending}
            onPress={() => feedback.mutate()}>
            {t('help.feedback.send')}
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = makeStyles(() => ({
  container: { flex: 1, backgroundColor: palette.background },
  content: { padding: 16, paddingBottom: 40 },
  section: { color: palette.textSecondary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 8, marginBottom: 8, marginLeft: 4 },
  card: { backgroundColor: palette.surface, borderRadius: 14, padding: 16, marginBottom: 16 },
  faqRow: { paddingVertical: 12 },
  faqHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  faqQ: { color: palette.textPrimary, fontSize: 14, fontWeight: '600', flex: 1 },
  faqA: { color: palette.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 8 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.surfaceVariant },
  hint: { color: palette.textSecondary, fontSize: 12, marginBottom: 10 },
  input: { backgroundColor: palette.surface, marginBottom: 12 },
}));
