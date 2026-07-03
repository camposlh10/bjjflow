import { NavigationContainer } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import ErrorBoundary from './src/components/ErrorBoundary';
import RootNavigator from './src/navigation/RootNavigator';
import { queryClient } from './src/queryClient';
import { useAuthStore } from './src/store/authStore';
import { useLocaleStore } from './src/store/localeStore';
import { useThemeStore } from './src/store/themeStore';
import { navigationThemeFor, paperThemeFor } from './src/theme/theme';

export default function App() {
  const hydrate = useAuthStore((s) => s.hydrate);
  const hydrateLocale = useLocaleStore((s) => s.hydrate);
  const hydrateTheme = useThemeStore((s) => s.hydrate);
  const locale = useLocaleStore((s) => s.locale);
  const scheme = useThemeStore((s) => s.scheme);

  useEffect(() => {
    hydrate();
    hydrateLocale();
    hydrateTheme();
  }, [hydrate, hydrateLocale, hydrateTheme]);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <PaperProvider theme={paperThemeFor(scheme)}>
          {/* Remount the tree on locale/scheme change so t() + themed styles re-read. */}
          <NavigationContainer key={`${locale}-${scheme}`} theme={navigationThemeFor(scheme)}>
            <ErrorBoundary>
              <RootNavigator />
            </ErrorBoundary>
            <StatusBar style={scheme === 'light' ? 'dark' : 'light'} />
          </NavigationContainer>
        </PaperProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
