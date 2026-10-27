/**
 * Veltravia Wallet — in-app browser (Trust parity, from the screen recording).
 *
 *  - Header: X (close), lock + domain, 3-dot menu; a thin purple progress line
 *    under it fills while the page loads.
 *  - Bottom bar: open-tabs counter, back/forward pill (dimmed when it can't
 *    go), heart (favorite, with the "Added to favorites" toast), reload.
 *  - 3-dot menu: Network, Request Desktop Website, Share, Fullscreen mode.
 *  - Fullscreen mode hides all chrome; a small floating exit button restores it.
 *
 * Safety: only http(s) pages load. Any other scheme (javascript:, intent:,
 * file:, data:) is blocked at the WebView, and popups stay in this view.
 * No history is persisted; the web view has no access to the wallet's keys.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, Easing, Share, StatusBar, Platform, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { WebView, type WebViewNavigation } from 'react-native-webview';
import { useTheme } from '../theme/ThemeProvider';
import {
  CloseIcon, MoreIcon, LockSmallIcon, HeartIcon, ReloadIcon, ChevronLeftIcon, ChevronRightIcon,
} from '../components/icons';
import AppModal from '../components/AppModal';
import { copyToClipboard } from '../core/clipboard';
import { showToast } from '../components/Toast';
import {
  useBrowserState, updateTab, hostOf, isFavorite, toggleFavorite, normalizeUrl, isAllowedNavigation, siteModeLabel,
  nextBarsVisible, parseScrollMessage, SCROLL_REPORTER_JS,
} from '../services/browserState';

// A real desktop Chrome UA. Mobile mode passes `undefined` so the WebView uses
// the device's own mobile UA.
const DESKTOP_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/**
 * Sites pick mobile vs desktop from the UA *and* the viewport. Changing only
 * the UA leaves a phone-width viewport (the page still looks mobile), so in
 * desktop mode we also force a 1280px layout viewport before any page script
 * runs, and mark the page so media queries see a desktop width.
 */
const DESKTOP_VIEWPORT_JS = `
(function () {
  try {
    var apply = function () {
      var head = document.head || document.documentElement;
      var m = document.querySelector('meta[name=viewport]');
      if (!m) { m = document.createElement('meta'); m.name = 'viewport'; head.appendChild(m); }
      m.setAttribute('content', 'width=1280, initial-scale=0.3, minimum-scale=0.1, maximum-scale=5, user-scalable=yes');
    };
    apply();
    document.addEventListener('DOMContentLoaded', apply);
    new MutationObserver(apply).observe(document.documentElement, { childList: true, subtree: true });
  } catch (e) {}
})();
true;`;

const HEADER_H = 44;
const CIRCLE = 40;

export default function BrowserScreen() {
  const { theme } = useTheme();
  const dark = theme.mode === 'dark';
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { tabs } = useBrowserState();
  const { width } = useWindowDimensions();

  const tabId: string = route.params?.tabId;
  const startUrl: string = normalizeUrl(route.params?.url ?? 'about:blank');

  const webRef = useRef<any>(null);
  const [url, setUrl] = useState(startUrl);
  const [canBack, setCanBack] = useState(false);
  const [canForward, setCanForward] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [desktop, setDesktop] = useState(false);
  // Bumped on every mode switch: remounts the WebView so the new UA + viewport apply cleanly.
  const [webKey, setWebKey] = useState(0);
  const [sourceUrl, setSourceUrl] = useState(startUrl);
  const [fullscreen, setFullscreen] = useState(false);
  const [fav, setFav] = useState(isFavorite(startUrl));
  const [loadFailed, setLoadFailed] = useState(false);

  // Auto-hiding bars (Trust): 0 = shown, 1 = hidden. Drives both slide-outs.
  const barsHidden = useRef(new Animated.Value(0)).current;
  const barsLayout = useRef(new Animated.Value(0)).current; // JS-driven twin for layout margins
  const barsVisibleRef = useRef(true);
  const lastY = useRef(0);
  const setBarsVisible = useCallback((visible: boolean) => {
    if (barsVisibleRef.current === visible) return;
    barsVisibleRef.current = visible;
    const cfg = { toValue: visible ? 0 : 1, duration: 220, easing: Easing.out(Easing.cubic) };
    Animated.timing(barsHidden, { ...cfg, useNativeDriver: true }).start();
    Animated.timing(barsLayout, { ...cfg, useNativeDriver: false }).start();
  }, [barsHidden, barsLayout]);

  const onWebMessage = useCallback((e: { nativeEvent: { data: string } }) => {
    const sample = parseScrollMessage(e.nativeEvent.data);
    if (!sample) return;
    const visible = nextBarsVisible(lastY.current, sample, barsVisibleRef.current);
    lastY.current = sample.y;
    setBarsVisible(visible);
  }, [setBarsVisible]);

  // progress line
  const progress = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const onProgress = (p: number) => {
    fade.setValue(p >= 1 ? 0 : 1);
    Animated.timing(progress, { toValue: p, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();
  };

  useEffect(() => {
    setFav(isFavorite(url));
  }, [url]);

  const close = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
  }, [navigation]);

  const onNavChange = (n: WebViewNavigation) => {
    setCanBack(n.canGoBack);
    setCanForward(n.canGoForward);
    if (n.url && /^https?:/i.test(n.url)) {
      if (n.url !== url) { lastY.current = 0; setBarsVisible(true); }
      setUrl(n.url);
      if (tabId) updateTab(tabId, { url: n.url, title: n.title || hostOf(n.url) });
    }
  };

  // Only http(s) may load inside the web view. about:blank / about:srcdoc are
  // in-page (iframes, wallet-connect shims) and harmless. Everything else —
  // javascript:, intent:, file:, data: top-level navigations — is refused.
  const shouldLoad = (req: { url: string }) => isAllowedNavigation(req.url);

  const onHeart = () => {
    const on = toggleFavorite(url);
    setFav(on);
    showToast(on ? 'Added to favorites' : 'Removed from favorites', { kind: 'success' });
  };

  const onShare = async () => {
    setMenuOpen(false);
    try {
      await Share.share({ message: url });
    } catch {
      /* user dismissed */
    }
  };

  const toggleDesktop = () => {
    setMenuOpen(false);
    const next = !desktop;
    setDesktop(next);
    setSourceUrl(url); // stay on the page the user is looking at
    setCanBack(false);
    setCanForward(false);
    setLoadFailed(false);
    setWebKey((k) => k + 1); // remount => fresh load with the new UA/viewport
    lastY.current = 0;
    setBarsVisible(true);
    showToast(next ? 'Desktop site' : 'Mobile site', { kind: 'info' });
  };

  const enterFullscreen = () => {
    setMenuOpen(false);
    setFullscreen(true);
  };

  const circleBg = dark ? '#1D2133' : '#EFEFF1';
  const ink = theme.ink;
  const muted = theme.inkMuted;
  const host = hostOf(url);
  const progressW = progress.interpolate({ inputRange: [0, 1], outputRange: [0, width] });
  const TOP_H = insets.top + 6 + 4 + 6 + HEADER_H + 6; // grab handle + header + progress
  const BOTTOM_H = CIRCLE + 10 + Math.max(insets.bottom, 12);
  // The page reclaims the space the bars give up. Margins are layout props, so they
  // follow a JS-driven twin of the same 0..1 value (two numbers over ~220ms).
  const webTop = barsLayout.interpolate({ inputRange: [0, 1], outputRange: [TOP_H, insets.top + 22] });
  const webBottom = barsLayout.interpolate({ inputRange: [0, 1], outputRange: [BOTTOM_H, 0] });
  const headerY = barsHidden.interpolate({ inputRange: [0, 1], outputRange: [0, -(TOP_H - insets.top - 22)] });
  const footerY = barsHidden.interpolate({ inputRange: [0, 1], outputRange: [0, BOTTOM_H + 8] });

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} />

      {/* WebView first (full-bleed); bars float above it and slide away on scroll. */}
      <Animated.View style={[styles.web, fullscreen ? null : { marginTop: webTop, marginBottom: webBottom }]}>
        {loadFailed ? (
          <View style={styles.failed}>
            <Text style={[styles.failedTitle, { color: ink }]}>Can’t load this page</Text>
            <Text style={[styles.failedSub, { color: muted }]}>Check your connection and try reloading.</Text>
          </View>
        ) : (
          <WebView
            key={webKey}
            ref={webRef}
            source={{ uri: sourceUrl }}
            userAgent={desktop ? DESKTOP_UA : undefined}
            injectedJavaScriptBeforeContentLoaded={(desktop ? DESKTOP_VIEWPORT_JS : '') + SCROLL_REPORTER_JS}
            onMessage={onWebMessage}
            scalesPageToFit={desktop}
            setBuiltInZoomControls={desktop}
            setDisplayZoomControls={false}
            onNavigationStateChange={onNavChange}
            onShouldStartLoadWithRequest={shouldLoad}
            onLoadProgress={(e) => onProgress(e.nativeEvent.progress)}
            onLoadStart={() => setLoadFailed(false)}
            onError={(e) => {
              // Only a failed top-level page load may replace the view; a
              // blocked analytics request or aborted redirect must not.
              const ev: any = e.nativeEvent;
              if (ev?.url && ev.url === sourceUrl) setLoadFailed(true);
            }}
            onHttpError={() => {}}
            setSupportMultipleWindows={false}
            javaScriptCanOpenWindowsAutomatically={false}
            allowsBackForwardNavigationGestures
            originWhitelist={['https://*', 'http://*']}
            mixedContentMode="never"
            thirdPartyCookiesEnabled={false}
            sharedCookiesEnabled={false}
            allowFileAccess={false}
            allowFileAccessFromFileURLs={false}
            allowUniversalAccessFromFileURLs={false}
            geolocationEnabled={false}
            style={{ backgroundColor: theme.background }}
          />
        )}
      </Animated.View>

      {!fullscreen && (
        <Animated.View
          pointerEvents="box-none"
          style={[styles.topBar, { paddingTop: insets.top, backgroundColor: theme.background, transform: [{ translateY: headerY }] }]}
        >
          <View style={styles.grabWrap}>
            <View style={[styles.grab, { backgroundColor: dark ? 'rgba(255,255,255,0.25)' : 'rgba(6,14,44,0.18)' }]} />
          </View>
          <View style={styles.header}>
            <Pressable onPress={close} accessibilityLabel="Close browser" style={[styles.circle, { backgroundColor: circleBg }]}>
              <CloseIcon size={22} color={ink} />
            </Pressable>
            <Pressable
              style={styles.domain}
              onPress={() => {
                copyToClipboard(url);
                showToast('Link copied', { kind: 'success' });
              }}
            >
              <LockSmallIcon size={15} color={ink} />
              <Text numberOfLines={1} style={[styles.domainText, { color: ink }]}>{host}</Text>
            </Pressable>
            <Pressable onPress={() => setMenuOpen(true)} accessibilityLabel="Browser menu" style={[styles.circle, { backgroundColor: circleBg }]}>
              <MoreIcon size={22} color={ink} />
            </Pressable>
          </View>
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressBar, { width: progressW, opacity: fade, backgroundColor: theme.brand }]} />
          </View>
        </Animated.View>
      )}


      {!fullscreen && (
        <Animated.View
          pointerEvents="box-none"
          style={[styles.bottom, styles.bottomAbs, { paddingBottom: Math.max(insets.bottom, 12), backgroundColor: theme.background, transform: [{ translateY: footerY }] }]}
        >
          <View style={[styles.circle, { backgroundColor: circleBg }]}>
            <View style={[styles.tabBox, { borderColor: ink }]}>
              <Text style={[styles.tabNum, { color: ink }]}>{Math.max(tabs.length, 1)}</Text>
            </View>
          </View>

          <View style={[styles.navPill, { backgroundColor: circleBg }]}>
            <Pressable disabled={!canBack} onPress={() => webRef.current?.goBack()} hitSlop={8} style={styles.navBtn}>
              <ChevronLeftIcon size={22} color={canBack ? ink : muted} />
            </Pressable>
            <Pressable disabled={!canForward} onPress={() => webRef.current?.goForward()} hitSlop={8} style={styles.navBtn}>
              <ChevronRightIcon size={22} color={canForward ? ink : muted} />
            </Pressable>
          </View>

          <View style={{ flex: 1 }} />

          <Pressable onPress={onHeart} accessibilityLabel="Favorite" style={[styles.circle, { backgroundColor: circleBg }]}>
            <HeartIcon size={22} color={ink} filled={fav} />
          </Pressable>
          <Pressable
            onPress={() => { setLoadFailed(false); setTimeout(() => webRef.current?.reload(), 30); }}
            accessibilityLabel="Reload"
            style={[styles.circle, { backgroundColor: circleBg }]}
          >
            <ReloadIcon size={22} color={ink} />
          </Pressable>
        </Animated.View>
      )}

      {fullscreen && (
        <Pressable
          onPress={() => setFullscreen(false)}
          accessibilityLabel="Exit fullscreen"
          style={[styles.exitFs, { top: insets.top + 8, backgroundColor: circleBg }]}
        >
          <CloseIcon size={18} color={ink} />
        </Pressable>
      )}

      {/* ---- 3-dot menu ---- */}
      <AppModal visible={menuOpen} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.dim} onPress={() => setMenuOpen(false)}>
          <View
            style={[
              styles.menu,
              {
                top: insets.top + 8 + 6 + HEADER_H + 2,
                backgroundColor: dark ? theme.surfaceAlt : '#FFFFFF',
              },
            ]}
          >
            <View style={styles.menuItem}>
              <Text style={[styles.menuLabel, { color: ink }]}>Network</Text>
              <Text style={[styles.menuSub, { color: muted }]}>Ethereum</Text>
            </View>
            <Pressable style={({ pressed }) => [styles.menuItem, pressed && { opacity: 0.6 }]} onPress={toggleDesktop}>
              <Text style={[styles.menuLabel, { color: ink }]}>{siteModeLabel(desktop)}</Text>
            </Pressable>
            <Pressable style={({ pressed }) => [styles.menuItem, pressed && { opacity: 0.6 }]} onPress={onShare}>
              <Text style={[styles.menuLabel, { color: ink }]}>Share</Text>
            </Pressable>
            <Pressable style={({ pressed }) => [styles.menuItem, pressed && { opacity: 0.6 }]} onPress={enterFullscreen}>
              <Text style={[styles.menuLabel, { color: ink }]}>Fullscreen mode</Text>
            </Pressable>
          </View>
        </Pressable>
      </AppModal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  grabWrap: { alignItems: 'center', paddingTop: 6, paddingBottom: 6 },
  grab: { width: 40, height: 4, borderRadius: 2 },
  header: { height: HEADER_H, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 },
  circle: { width: CIRCLE, height: CIRCLE, borderRadius: CIRCLE / 2, alignItems: 'center', justifyContent: 'center' },
  domain: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 10 },
  domainText: { fontSize: 15, fontFamily: 'Inter-600', fontWeight: '600', maxWidth: '80%' },
  progressTrack: { height: 2, marginTop: 4 },
  progressBar: { height: 2 },
  web: { flex: 1 },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 5 },
  bottomAbs: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 5 },
  failed: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  failedTitle: { fontSize: 18, fontFamily: 'Inter-700', fontWeight: '700', marginBottom: 6 },
  failedSub: { fontSize: 14, fontFamily: 'Inter-500', fontWeight: '500', textAlign: 'center' },
  bottom: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingTop: 10 },
  tabBox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  tabNum: { fontSize: 12, fontFamily: 'Inter-700', fontWeight: '700' },
  navPill: { height: CIRCLE, borderRadius: CIRCLE / 2, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6 },
  navBtn: { width: 40, height: CIRCLE, alignItems: 'center', justifyContent: 'center' },
  exitFs: { position: 'absolute', right: 12, width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', opacity: 0.85 },
  dim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.12)' },
  menu: {
    position: 'absolute', right: 12, minWidth: 250, borderRadius: 24, paddingVertical: 10,
    elevation: 12, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 18, shadowOffset: { width: 0, height: 8 },
  },
  menuItem: { paddingVertical: 11, paddingHorizontal: 22 },
  menuLabel: { fontSize: 16, fontFamily: 'Inter-600', fontWeight: '600' },
  menuSub: { fontSize: 14, fontFamily: 'Inter-500', fontWeight: '500', marginTop: 1 },
});
