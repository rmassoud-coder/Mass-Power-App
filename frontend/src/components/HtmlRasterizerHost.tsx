import React, { useEffect, useRef } from 'react';
import { Platform, View } from 'react-native';
import {
  _registerRasterizerHost,
  _onRasterizerMessage,
  getRasterizerHostHtml,
} from '../utils/htmlRasterizer';

/**
 * Mounts a single hidden WebView that the Cat Printer print path uses to
 * rasterize HTML → 1-bit dithered bitmap. Safe no-op on web (react-native-web
 * doesn't ship a WebView we can use for this).
 *
 * NOTE: Do NOT unmount this component during a print job — the WebView owns
 * the render bridge. It lives at the root layout for the entire app session.
 */
export default function HtmlRasterizerHost(): React.ReactElement | null {
  const webRef = useRef<any>(null);
  // Guard against missing native module on web / when RN WebView isn't linked.
  let WebView: any = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, import/no-extraneous-dependencies
    WebView = require('react-native-webview').WebView;
  } catch {
    WebView = null;
  }

  useEffect(() => {
    if (Platform.OS === 'web' || !WebView) return;
    // Register the host bridge — rasterizeHtml() will start returning real bitmaps.
    _registerRasterizerHost((js: string) => {
      const w = webRef.current;
      if (!w) throw new Error('WebView ref not ready');
      if (typeof w.injectJavaScript === 'function') w.injectJavaScript(js);
    });
    return () => {
      _registerRasterizerHost(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (Platform.OS === 'web' || !WebView) return null;

  return (
    <View
      pointerEvents="none"
      style={{
        // Fully off-screen but still layouted so the WebView actually renders.
        position: 'absolute',
        left: -10000,
        top: -10000,
        width: 500,
        height: 400,
        opacity: 0,
      }}
    >
      <WebView
        ref={webRef}
        source={{ html: getRasterizerHostHtml() }}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        allowFileAccess
        androidLayerType="software"
        onMessage={(evt: any) => {
          const data = evt?.nativeEvent?.data;
          if (typeof data === 'string') _onRasterizerMessage(data);
        }}
        style={{ width: 500, height: 400, backgroundColor: '#fff' }}
      />
    </View>
  );
}
