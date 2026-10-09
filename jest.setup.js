/* global jest */
// Runs before every test file.

// Reanimated and Worklets need native code; use their official JS mocks in tests.
// The Reanimated mock leaves out a few hooks, so they are filled in here.
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => ({
  ...require('react-native-reanimated/mock'),
  useReducedMotion: () => false,
}));

// expo-crypto's native UUID isn't available in Node; use Node's own (also UUID v4).
jest.mock('expo-crypto', () => ({
  ...jest.requireActual('expo-crypto'),
  randomUUID: () => require('node:crypto').randomUUID(),
}));
