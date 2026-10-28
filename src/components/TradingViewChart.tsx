/**
 * Veltravia Wallet — real TradingView chart (Trust parity).
 *
 * Renders the TradingView Advanced Charts library (CL v32.1.0, staged into
 * android/app/src/main/assets/charting_library/ from Trust's APK layout)
 * inside a WebView and drives it through the host page's bridge protocol.
 * All protocol logic lives in services/tvBridge.ts (pure, unit-tested).
 *
 * RN is the single source of candle truth: bars come from candleEngine
 * until api.veltraviawallet.com serves real OHLC.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import {
  handleWebMessage, initPayload, makeBarSource,
  type TvColors, type TvMarket, type TvResolution,
} from '../services/tvBridge';

export interface TradingViewChartProps {
  symbol: string;
  description: string;
  exchange: string;
  last: number;
  resolution: TvResolution;
  chartType?: 'candle' | 'line';
  theme?: 'dark' | 'light';
  colors: TvColors;
  showVolume?: boolean;
  pricescale?: number;
  /** distinct series seed; defaults to the symbol */
  seed?: string;
  onEmptyChange?: (empty: boolean) => void;
  onGesture?: (active: boolean) => void;
  onReady?: (pageVersion: number) => void;
}

const HTML_URL_ANDROID = 'file:///android_asset/charting_library/index.html';
// iOS stages the same tree in the bundle root
const HTML_URL_IOS = 'charting_library/index.html';

export default function TradingViewChart({
  symbol, description, exchange, last, resolution, chartType = 'candle',
  theme = 'light', colors, showVolume = true, pricescale, seed, onEmptyChange, onGesture, onReady,
}: TradingViewChartProps) {
  const webRef = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const seedKey = seed ?? symbol;
  const clock = useMemo(() => Date.now(), [seedKey]); // frozen per market
  const getBars = useMemo(() => makeBarSource(`${seedKey}`, last, clock), [seedKey, last, clock]);

  const post = useCallback((type: string, payload: object) => {
    webRef.current?.postMessage(JSON.stringify({ type, payload }));
  }, []);

  const market = useCallback((): TvMarket => ({
    symbol, description, exchange, last, pricescale, theme, resolution, chartType, showVolume, colors,
  }), [symbol, description, exchange, last, pricescale, theme, resolution, chartType, showVolume, colors]);

  const onMessage = useCallback((e: WebViewMessageEvent) => {
    const res = handleWebMessage(e.nativeEvent.data, {
      post, getBars, market, onEmptyChange, onGesture, onReady,
      onError: (where, message) => console.warn('[TradingView]', where, message),
    });
    if (res?.type === 'ready') setReady(true);
  }, [post, getBars, market, onEmptyChange, onGesture, onReady]);

  // market / volume changes rebuild the widget (the page's INIT path)
  useEffect(() => {
    if (!ready) return;
    post('init', initPayload(market()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, showVolume, pricescale, ready]);

  // live setters for resolution / theme / chart type
  useEffect(() => { if (ready) post('setResolution', { resolution }); }, [ready, resolution, post]);
  useEffect(() => { if (ready) post('theme', { colors }); }, [ready, colors, post]);
  useEffect(() => { if (ready) post('setChartType', { chartType }); }, [ready, chartType, post]);

  // the live price ticks the newest bar
  const tick = useRef(last);
  if (tick.current !== last) {
    tick.current = last;
    if (ready) post('updateTick', {
      resolution,
      bar: { time: Math.floor(Date.now() / 1000), open: last, high: last, low: last, close: last },
    });
  }

  return (
    <View style={styles.wrap} accessibilityLabel="TradingView chart">
      <WebView
        ref={webRef as any}
        source={Platform.OS === 'android' ? { uri: HTML_URL_ANDROID } : { uri: HTML_URL_IOS }}
        style={styles.web}
        originWhitelist={['file://']}
        javaScriptEnabled
        domStorageEnabled={false}
        allowFileAccess
        allowUniversalAccessFromFileURLs
        mixedContentMode="never"
        setSupportMultipleWindows={false}
        onMessage={onMessage}
        onShouldStartLoadWithRequest={(req) => req.url.startsWith('file://')}
        containerStyle={{ backgroundColor: colors.backgroundPrimary }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, overflow: 'hidden' },
  web: { backgroundColor: 'transparent' },
});
