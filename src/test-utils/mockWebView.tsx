import { forwardRef, useImperativeHandle } from 'react';
import { View } from 'react-native';

// Stands in for react-native-webview in Jest (see jest.setup.js): a plain View that accepts the
// calls the app makes on a WebView ref and ignores them.
export const WebView = forwardRef<unknown, { accessibilityLabel?: string }>(
  function WebView(props, ref) {
    useImperativeHandle(ref, () => ({ postMessage: () => {}, injectJavaScript: () => {} }));
    return <View testID="webview" accessibilityLabel={props.accessibilityLabel} />;
  },
);

export default WebView;
