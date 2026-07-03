import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import { clearPersistedCache } from '../queryClient';

export type Belt = {
  slug: string;
  name: string;
  namePt: string;
  colorHex: string;
  stripes: number;
};

export type User = {
  id: number;
  email: string;
  username?: string;
  displayName: string;
  age: number | null;
  weightKg: number | null;
  heightCm: number | null;
  belt: Belt | null;
  admin?: boolean;
  pro?: boolean;
};

export type OnboardingAnswers = {
  firstName?: string;
  lastName?: string;
  username?: string;
  age?: number;
  gender?: string;
  city?: string;
  country?: string;
  state?: string;
  favoriteArt?: string;
  trainingStartYear?: number;
  beltSlug?: string;
  stripes?: number;
  weightKg?: number;
  heightCm?: number;
};

type Tokens = { accessToken: string; refreshToken: string };

type AuthState = {
  hydrated: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  onboarding: OnboardingAnswers;
  setOnboarding: (answers: Partial<OnboardingAnswers>) => void;
  setAuth: (tokens: Tokens, user: User) => Promise<void>;
  setTokens: (tokens: Tokens) => Promise<void>;
  setUser: (user: User) => void;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
};

const ACCESS_KEY = 'bjjflow.accessToken';
const REFRESH_KEY = 'bjjflow.refreshToken';
const USER_KEY = 'bjjflow.user';

export const useAuthStore = create<AuthState>((set) => ({
  hydrated: false,
  accessToken: null,
  refreshToken: null,
  user: null,
  onboarding: {},

  setOnboarding: (answers) =>
    set((state) => ({ onboarding: { ...state.onboarding, ...answers } })),

  setAuth: async (tokens, user) => {
    await Promise.all([
      SecureStore.setItemAsync(ACCESS_KEY, tokens.accessToken),
      SecureStore.setItemAsync(REFRESH_KEY, tokens.refreshToken),
      SecureStore.setItemAsync(USER_KEY, JSON.stringify(user)),
    ]);
    set({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, user, onboarding: {} });
  },

  setTokens: async (tokens) => {
    await Promise.all([
      SecureStore.setItemAsync(ACCESS_KEY, tokens.accessToken),
      SecureStore.setItemAsync(REFRESH_KEY, tokens.refreshToken),
    ]);
    set({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
  },

  setUser: (user) => {
    SecureStore.setItemAsync(USER_KEY, JSON.stringify(user)).catch(() => undefined);
    set({ user });
  },

  logout: async () => {
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_KEY),
      SecureStore.deleteItemAsync(REFRESH_KEY),
      SecureStore.deleteItemAsync(USER_KEY),
    ]);
    // Drop the previous user's persisted query cache so the next login starts clean.
    await clearPersistedCache();
    set({ accessToken: null, refreshToken: null, user: null });
  },

  hydrate: async () => {
    try {
      const [accessToken, refreshToken, userJson] = await Promise.all([
        SecureStore.getItemAsync(ACCESS_KEY),
        SecureStore.getItemAsync(REFRESH_KEY),
        SecureStore.getItemAsync(USER_KEY),
      ]);
      set({
        accessToken,
        refreshToken,
        user: userJson ? (JSON.parse(userJson) as User) : null,
        hydrated: true,
      });
    } catch {
      set({ hydrated: true });
    }
  },
}));
