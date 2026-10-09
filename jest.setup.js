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

// FlashList measures native layouts, which don't exist in Node. Give every measurement a fixed
// size so all rows render. (FlashList 2.0.2's own jestSetup.js mocks an export that no longer
// exists, so this is the working half of it.)
jest.mock('@shopify/flash-list/dist/recyclerview/utils/measureLayout', () => {
  const size = (width, height) => jest.fn(() => ({ x: 0, y: 0, width, height }));
  return {
    ...jest.requireActual('@shopify/flash-list/dist/recyclerview/utils/measureLayout'),
    measureParentSize: size(400, 900),
    measureFirstChildLayout: size(400, 900),
    measureItemLayout: size(100, 100),
  };
});

// react-native-webview needs its native module. In tests a WebView (e.g. the note editor) is a
// plain View; the editor's own behaviour is checked in a browser (see editor-web/).
jest.mock('react-native-webview', () => require('./src/test-utils/mockWebView'));

// Skia (image annotation) needs its native module. In tests its drawing elements are Views; the
// drawing itself is checked on the device.
jest.mock('@shopify/react-native-skia', () => require('./src/test-utils/mockSkia'));

// Gesture Handler's own Jest setup: fake native module, so gestures (e.g. drawing on an image)
// can be driven with `fireGestureHandler` from 'react-native-gesture-handler/jest-utils'.
require('react-native-gesture-handler/jestSetup');
