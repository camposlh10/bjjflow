import { DarkTheme as NavigationDarkTheme, DefaultTheme as NavigationLightTheme } from '@react-navigation/native';
import { MD3DarkTheme, MD3LightTheme, adaptNavigationTheme } from 'react-native-paper';
import { StyleSheet } from 'react-native';

export type Palette = {
  background: string;
  surface: string;
  surfaceVariant: string;
  primary: string;
  onPrimary: string;
  textPrimary: string;
  textSecondary: string;
  outline: string;
  verified: string;
  pro: string;
};

export type ColorScheme = 'light' | 'dark';

// BJJ Flow palette: dark (default) + a light variant. Same keys; the crimson accent stays.
const darkColors: Palette = {
  background: '#0D0D10',
  surface: '#17171C',
  surfaceVariant: '#22222A',
  primary: '#E63946',
  onPrimary: '#FFFFFF',
  textPrimary: '#F4F4F5',
  textSecondary: '#A1A1AA',
  outline: '#3F3F46',
  verified: '#3897F0',
  pro: '#F5C518',
};

const lightColors: Palette = {
  background: '#F4F4F6',
  surface: '#FFFFFF',
  surfaceVariant: '#E9E9EE',
  primary: '#E63946',
  onPrimary: '#FFFFFF',
  textPrimary: '#18181B',
  textSecondary: '#6B7280',
  outline: '#D4D4D8',
  verified: '#2F80D6',
  pro: '#B7860B',
};

const COLORS: Record<ColorScheme, Palette> = { light: lightColors, dark: darkColors };

let activeScheme: ColorScheme = 'dark';

export function setActiveScheme(scheme: ColorScheme): void {
  activeScheme = scheme;
}

export function getActiveScheme(): ColorScheme {
  return activeScheme;
}

/**
 * Live view of the active scheme's colors. Read at access time, so JSX color props
 * follow the theme after the tree re-mounts on a scheme change. (Styles created at
 * module load capture the value then — convert those with makeStyles below.)
 */
export const palette = new Proxy({} as Palette, {
  get: (_target, prop: string) => COLORS[activeScheme][prop as keyof Palette],
}) as Palette;

/**
 * Theme-aware StyleSheet. Replace `const styles = StyleSheet.create({...})` with
 * `const styles = makeStyles(() => ({...}))`. The returned `styles` is a proxy: each
 * `styles.key` access resolves to the active scheme's StyleSheet (cached per scheme),
 * so styles follow the theme after the tree re-mounts — no per-component changes.
 */
export function makeStyles<T extends StyleSheet.NamedStyles<T>>(factory: () => T): T {
  const cache: Partial<Record<ColorScheme, T>> = {};
  const resolve = () => (cache[activeScheme] ??= StyleSheet.create(factory()));
  return new Proxy({} as Record<string | symbol, unknown>, {
    get: (_t, key) => resolve()[key as keyof T],
  }) as T;
}

const { DarkTheme: adaptedDark, LightTheme: adaptedLight } = adaptNavigationTheme({
  reactNavigationDark: NavigationDarkTheme,
  reactNavigationLight: NavigationLightTheme,
});

export function paperThemeFor(scheme: ColorScheme) {
  const base = scheme === 'light' ? MD3LightTheme : MD3DarkTheme;
  const c = COLORS[scheme];
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: c.primary,
      onPrimary: c.onPrimary,
      background: c.background,
      surface: c.surface,
      surfaceVariant: c.surfaceVariant,
      outline: c.outline,
    },
  };
}

export function navigationThemeFor(scheme: ColorScheme) {
  const adapted = scheme === 'light' ? adaptedLight : adaptedDark;
  const navBase = scheme === 'light' ? NavigationLightTheme : NavigationDarkTheme;
  const c = COLORS[scheme];
  return {
    ...adapted,
    fonts: navBase.fonts,
    colors: {
      ...adapted.colors,
      primary: c.primary,
      background: c.background,
      card: c.surface,
      text: c.textPrimary,
      border: c.outline,
    },
  };
}

// Backwards-compatible dark defaults (until App switches to the *For helpers).
export const paperTheme = paperThemeFor('dark');
export const navigationTheme = navigationThemeFor('dark');
