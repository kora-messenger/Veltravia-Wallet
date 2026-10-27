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
import { showToast } from '../components/Toast';
import {
  useBrowserState, updateTab, hostOf, isFavorite, toggleFavorite, normalizeUrl,
} from '../services/browserState';

const DESKTOP_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

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
  const [fullscreen, setFullscreen] = useState(false);
  const [fav, setFav] = useState(isFavorite(startUrl));
  const [loadFailed, setLoadFailed] = useState(false);

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
      setUrl(n.url);
      if (tabId) updateTab(tabId, { url: n.url, title: n.title || hostOf(n.url) });
    }
  };

  // Only http(s) may load inside the web view.
  const shouldLoad = (req: { url: string }) => /^https?:\/\//i.test(req.url) || req.url === 'about:blank';

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
    setDesktop((d) => !d);
    // userAgent change takes effect on the next load
    setTimeout(() => webRef.current?.reload(), 50);
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

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} />

      {!fullscreen && (
        <View style={{ paddingTop: insets.top }}>
          <View style={styles.grabWrap}>
            <View style={[styles.grab, { backgroundColor: dark ? 'rgba(255,255,255,0.25)' : 'rgba(6,14,44,0.18)' }]} />
          </View>
          <View style={styles.header}>
            <Pressable onPress={close} accessibilityLabel="Close browser" style={[styles.circle, { backgroundColor: circleBg }]}>
              <CloseIcon size={22} color={ink} />
            </Pressable>
            <View style={styles.domain}>
              <LockSmallIcon size={15} color={ink} />
              <Text numberOfLines={1} style={[styles.domainText, { color: ink }]}>{host}</Text>
            </View>
            <Pressable onPress={() => setMenuOpen(true)} accessibilityLabel="Browser menu" style={[styles.circle, { backgroundColor: circleBg }]}>
              <MoreIcon size={22} color={ink} />
            </Pressable>
          </View>
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressBar, { width: progressW, opacity: fade, backgroundColor: theme.brand }]} />
          </View>
        </View>
      )}

      <View style={styles.web}>
        {loadFailed ? (
          <View style={styles.failed}>
            <Text style={[styles.failedTitle, { color: ink }]}>Can’t load this page</Text>
            <Text style={[styles.failedSub, { color: muted }]}>Check your connection and try reloading.</Text>
          </View>
        ) : (
          <WebView
            ref={webRef}
            source={{ uri: startUrl }}
            userAgent={desktop ? DESKTOP_UA : undefined}
            onNavigationStateChange={onNavChange}
            onShouldStartLoadWithRequest={shouldLoad}
            onLoadProgress={(e) => onProgress(e.nativeEvent.progress)}
            onLoadStart={() => setLoadFailed(false)}
            onError={() => setLoadFailed(true)}
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
      </View>

      {!fullscreen && (
        <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 12) }]}>
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
        </View>
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
              <Text style={[styles.menuLabel, { color: ink }]}>
                {desktop ? 'Request Mobile Website' : 'Request Desktop Website'}
              </Text>
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
