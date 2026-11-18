import { createNavigationContainerRef } from '@react-navigation/native';

/**
 * The app's navigation container, for the few things drawn outside any
 * navigator (the tab bar's overlays) that still need to open a screen.
 */
export const navigationRef = createNavigationContainerRef();

/** Opens a match from anywhere, on the Início tab's stack. */
export function openMatch(matchId: number) {
  if (!navigationRef.isReady()) return;
  // Untyped on purpose: the ref spans every navigator in the app.
  (navigationRef.navigate as (name: string, params: object) => void)('Home', {
    screen: 'Match',
    params: { matchId },
    initial: false,
  });
}
