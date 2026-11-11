import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Cross-platform drop-in for the subset of expo-secure-store this app uses.
 *
 * expo-secure-store has no web implementation — its ExpoSecureStore.web module
 * is an empty object — so every call throws in a browser, which breaks login in
 * the `expo start --web` preview. Native behaviour is untouched: on iOS and
 * Android these delegate straight to the keychain/keystore as before.
 *
 * The web path uses localStorage. That is NOT equivalent security (no keychain
 * exists in a browser), which is fine because web is a development preview here,
 * not a shipped target. Do not treat the web build as a place to hold real
 * credentials.
 */

function webGet(key: string): string | null {
  // localStorage throws in private mode / when site data is blocked.
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function getItemAsync(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return webGet(key);
  }
  return SecureStore.getItemAsync(key);
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Non-fatal: the session simply won't survive a reload.
    }
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function deleteItemAsync(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Non-fatal.
    }
    return;
  }
  await SecureStore.deleteItemAsync(key);
}
