import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid, type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Platform, Pressable, View } from 'react-native';
import { Button, Text } from 'react-native-paper';

import { t } from '../i18n';
import { useThemeStore } from '../store/themeStore';
import { makeStyles, palette } from '../theme/theme';

const pad = (n: number) => String(n).padStart(2, '0');
function label(d: Date, mode: 'date' | 'time'): string {
  return mode === 'time'
    ? `${pad(d.getHours())}:${pad(d.getMinutes())}`
    : `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** Tappable date/time field backed by the native picker (inline calendar/spinner on
 *  iOS in a sheet, dialog on Android). Use instead of a free-text date input. */
export default function DateField({
  value,
  onChange,
  mode = 'date',
  maximumDate,
  minimumDate,
}: {
  value: Date;
  onChange: (d: Date) => void;
  mode?: 'date' | 'time';
  maximumDate?: Date;
  minimumDate?: Date;
}) {
  const scheme = useThemeStore((s) => s.scheme);
  const [open, setOpen] = useState(false);
  const [temp, setTemp] = useState(value);

  const openPicker = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value,
        mode,
        maximumDate,
        minimumDate,
        onChange: (e: DateTimePickerEvent, d?: Date) => {
          if (e.type === 'set' && d) onChange(d);
        },
      });
    } else {
      setTemp(value);
      setOpen(true);
    }
  };

  return (
    <>
      <Pressable onPress={openPicker} style={styles.field} accessibilityRole="button" accessibilityLabel={label(value, mode)}>
        <MaterialCommunityIcons name={mode === 'time' ? 'clock-outline' : 'calendar'} size={18} color={palette.textSecondary} />
        <Text style={styles.fieldText}>{label(value, mode)}</Text>
        <MaterialCommunityIcons name="chevron-down" size={18} color={palette.textSecondary} />
      </Pressable>
      {Platform.OS === 'ios' && (
        <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
            <Pressable style={styles.sheet} onPress={() => undefined}>
              <View style={styles.sheetTop}>
                <Button mode="text" textColor={palette.textSecondary} onPress={() => setOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button mode="text" onPress={() => { onChange(temp); setOpen(false); }}>
                  {t('common.done')}
                </Button>
              </View>
              <DateTimePicker
                value={temp}
                mode={mode}
                display={mode === 'time' ? 'spinner' : 'inline'}
                maximumDate={maximumDate}
                minimumDate={minimumDate}
                themeVariant={scheme === 'light' ? 'light' : 'dark'}
                onChange={(_e, d) => { if (d) setTemp(d); }}
                style={styles.picker}
              />
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </>
  );
}

const styles = makeStyles(() => ({
  field: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: palette.surfaceVariant, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11 },
  fieldText: { color: palette.textPrimary, fontSize: 14, flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: palette.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 24 },
  sheetTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 6, paddingTop: 4, borderBottomWidth: 1, borderBottomColor: palette.surfaceVariant },
  picker: { alignSelf: 'stretch' },
}));
