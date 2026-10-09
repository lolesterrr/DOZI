/* global jest */
// Runs before every test file.

// Reanimated and Worklets need native code; use their official JS mocks in tests.
// The Reanimated mock leaves out a few hooks, so they are filled in here.
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => ({
  ...require('react-native-reanimated/mock'),
  useReducedMotion: () => false,
}));
