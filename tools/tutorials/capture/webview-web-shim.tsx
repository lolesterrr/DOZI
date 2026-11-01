// Capture-only shim: a tiny react-native-webview for the browser (iframe + postMessage).
import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { View } from 'react-native';

export const WebView = forwardRef(function WebView(props: any, ref) {
  const frame = useRef<HTMLIFrameElement | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  useImperativeHandle(ref, () => ({
    injectJavaScript: (js: string) => {
      try {
        (frame.current?.contentWindow as any)?.eval(js);
      } catch (e) {
        console.warn('inject failed', e);
      }
    },
    postMessage: (data: string) => frame.current?.contentWindow?.postMessage(data, '*'),
    requestFocus: () => frame.current?.focus(),
    reload: () => {},
    goBack: () => {},
    goForward: () => {},
    stopLoading: () => {},
    clearCache: () => {},
  }));
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (!frame.current || e.source !== frame.current.contentWindow) return;
      propsRef.current.onMessage?.({ nativeEvent: { data: e.data } });
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);
  const html: string = props.source?.html ?? '';
  const boot =
    '<script>window.ReactNativeWebView={postMessage:function(d){parent.postMessage(d,"*")}};' +
    (props.injectedJavaScriptBeforeContentLoaded ?? '') +
    '</script>';
  const doc = html.includes('<head>') ? html.replace('<head>', '<head>' + boot) : boot + html;
  const onLoad = () => {
    const p = propsRef.current;
    p.onLoadStart?.({ nativeEvent: {} });
    if (p.injectedJavaScript) {
      try {
        (frame.current?.contentWindow as any)?.eval(p.injectedJavaScript);
      } catch {}
    }
    p.onLoad?.({ nativeEvent: {} });
    p.onLoadEnd?.({ nativeEvent: {} });
  };
  return (
    <View style={[{ flex: 1 }, props.containerStyle, props.style]}>
      <iframe
        ref={frame}
        srcDoc={doc}
        onLoad={onLoad}
        style={{ border: 0, width: '100%', height: '100%', background: 'transparent' }}
      />
    </View>
  );
});
export default WebView;
