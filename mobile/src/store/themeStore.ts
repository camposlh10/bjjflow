import * as SecureStore from 'expo-secure-store';
import { Appearance } from 'react-native';
import { create } from 'zustand';

import { ColorScheme, setActiveScheme } from '../theme/theme';

export type ThemePref = 'system' | 'light' | 'dark';

const THEME_KEY = 'bjjflow.theme';

function resolve(pref: ThemePref): ColorScheme {
  if (pref === 'system') {
    return Appearance.getColorScheme() === 'light' ? 'light' : 'dark';
  }
  return pref;
}

type ThemeState = {
  preference: ThemePref;
  scheme: ColorScheme;
  setPreference: (pref: ThemePref) => void;
  hydrate: () => Promise<void>;
};

export const useThemeStore = create<ThemeState>((set) => ({
  preference: 'dark',
  scheme: 'dark',
  setPreference: (preference) => {
    const scheme = resolve(preference);
    setActiveScheme(scheme);
    SecureStore.setItemAsync(THEME_KEY, preference).catch(() => undefined);
    set({ preference, scheme });
  },
  hydrate: async () => {
    try {
      const saved = (await SecureStore.getItemAsync(THEME_KEY)) as ThemePref | null;
      const preference: ThemePref = saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'dark';
      const scheme = resolve(preference);
      setActiveScheme(scheme);
      set({ preference, scheme });
    } catch {
      setActiveScheme('dark');
    }
  },
}));
