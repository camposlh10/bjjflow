import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, View } from 'react-native';
import { Text, TextInput } from 'react-native-paper';

import { t } from '../i18n';
import { makeStyles, palette } from '../theme/theme';

export type PickerOption = { key: string; label: string; left?: string };

// Strip combining diacritics (U+0300–U+036F) so "sao paulo" matches "São Paulo".
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** A tappable field that opens a searchable modal list. Use for long single-select
 *  inputs (countries, states, cities) where a dropdown/typeahead beats free text. */
export default function SearchablePicker({
  label,
  placeholder,
  value,
  options,
  onSelect,
  disabled,
  searchPlaceholder,
}: {
  label?: string;
  placeholder: string;
  value?: string | null;
  options: PickerOption[];
  onSelect: (key: string) => void;
  disabled?: boolean;
  searchPlaceholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = options.find((o) => o.key === value);
  const filtered = useMemo(() => {
    const q = norm(query.trim());
    if (!q) return options;
    return options.filter((o) => norm(o.label).includes(q));
  }, [options, query]);

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  return (
    <View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable
        onPress={() => !disabled && setOpen(true)}
        style={[styles.field, disabled && styles.fieldDisabled]}
        accessibilityRole="button"
        accessibilityLabel={selected?.label ?? placeholder}>
        <Text style={[styles.fieldText, !selected && styles.placeholder]} numberOfLines={1}>
          {selected ? `${selected.left ? selected.left + '  ' : ''}${selected.label}` : placeholder}
        </Text>
        <MaterialCommunityIcons name="chevron-down" size={20} color={palette.textSecondary} />
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close} />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <TextInput
              mode="outlined"
              dense
              autoFocus
              value={query}
              onChangeText={setQuery}
              placeholder={searchPlaceholder ?? t('picker.search')}
              left={<TextInput.Icon icon="magnify" />}
              style={styles.search}
            />
            <Pressable onPress={close} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('a11y.close')}>
              <MaterialCommunityIcons name="close" size={24} color={palette.textSecondary} />
            </Pressable>
          </View>
          <FlatList
            data={filtered}
            keyExtractor={(o) => o.key}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={20}
            ListEmptyComponent={<Text style={styles.empty}>{t('picker.empty')}</Text>}
            renderItem={({ item }) => {
              const on = item.key === value;
              return (
                <Pressable
                  style={styles.row}
                  onPress={() => {
                    onSelect(item.key);
                    close();
                  }}>
                  {item.left ? <Text style={styles.rowLeft}>{item.left}</Text> : null}
                  <Text style={[styles.rowText, on && styles.rowTextOn]} numberOfLines={1}>
                    {item.label}
                  </Text>
                  {on ? <MaterialCommunityIcons name="check" size={20} color={palette.primary} /> : null}
                </Pressable>
              );
            }}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = makeStyles(() => ({
  label: { color: palette.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 8, marginTop: 6 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: palette.surfaceVariant,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 12,
  },
  fieldDisabled: { opacity: 0.5 },
  fieldText: { color: palette.textPrimary, fontSize: 15, flex: 1 },
  placeholder: { color: palette.textSecondary },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    height: '80%',
    backgroundColor: palette.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingHorizontal: 16,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  search: { flex: 1, backgroundColor: palette.surface },
  empty: { color: palette.textSecondary, textAlign: 'center', marginTop: 40 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: palette.surfaceVariant,
  },
  rowLeft: { fontSize: 20 },
  rowText: { color: palette.textPrimary, fontSize: 15, flex: 1 },
  rowTextOn: { color: palette.primary, fontWeight: '700' },
}));
