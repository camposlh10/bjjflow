import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import { Locale, setActiveLocale } from '../i18n';

const LOCALE_KEY = 'bjjflow.locale';

type LocaleState = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  hydrate: () => Promise<void>;
};

export const useLocaleStore = create<LocaleState>((set) => ({
  locale: 'pt',
  setLocale: (locale) => {
    setActiveLocale(locale);
    SecureStore.setItemAsync(LOCALE_KEY, locale).catch(() => undefined);
    set({ locale });
  },
  hydrate: async () => {
    try {
      const saved = await SecureStore.getItemAsync(LOCALE_KEY);
      if (saved === 'pt' || saved === 'en') {
        setActiveLocale(saved);
        set({ locale: saved });
      }
    } catch {
      // keep the default (pt)
    }
  },
}));
