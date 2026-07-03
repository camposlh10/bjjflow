# BJJ Flow — Mobile

React Native app for BJJ Flow, a training companion and community app for jiu-jitsu practitioners.

## Stack

- Expo SDK 54 (React Native 0.81), TypeScript
  (pinned to SDK 54 to match the Expo Go version available on the team's devices)
- React Navigation 7 (native stack)
- TanStack Query 5 (server state) + Zustand 5 (local state)
- React Native Paper 5 (Material Design 3, custom dark theme)
- Axios

## Running

```
npm install
npx expo start
```

Then scan the QR code with the Expo Go app (Android/iOS) or press `a`/`i` for an emulator.

To test the backend connection from the Home screen, start the backend
(`bjj-flow-backend`) on the same machine — the app derives the API host from
Metro automatically, so a physical phone on the same Wi-Fi can reach it.

## Project layout

```
App.tsx                 # providers: SafeArea, React Query, Paper, Navigation
src/
  api/                  # axios client, API hooks
  components/           # shared UI components
  navigation/           # navigators + route types
  screens/              # one file per screen
  store/                # zustand stores
  theme/                # dark theme (Paper + Navigation)
  types/                # shared TypeScript types
```

## Type check

```
npx tsc --noEmit
```
