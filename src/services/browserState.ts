/**
 * Veltravia Wallet — in-app browser state.
 *
 * Every link in the app opens in the in-app browser (Trust parity), through
 * ONE entry point: `openInBrowser(url)`. This module holds the open tabs (the
 * bottom-left counter) and the favorites (the heart). Memory only: no
 * browsing history is persisted or sent anywhere (privacy-first).
 */
import { useSyncExternalStore } from 'react';

export interface BrowserTab {
  id: string;
  url: string;
  title: string;
}

interface State {
  tabs: BrowserTab[];
  favorites: string[]; // hosts
}

let state: State = { tabs: [], favorites: [] };
const listeners = new Set<() => void>();
const set = (next: State) => {
  state = next;
  listeners.forEach((l) => l());
};
let seq = 0;

export function hostOf(url: string): string {
  const m = url.match(/^[a-z][a-z0-9+.-]*:\/\/([^/?#]+)/i);
  return (m ? m[1] : url).replace(/^www\./i, '');
}

/** Normalise user/dApp input into a loadable https URL. */
export function normalizeUrl(input: string): string {
  const t = input.trim();
  if (/^https?:\/\//i.test(t)) return t;
  return 'https://' + t;
}

export function openTab(url: string): BrowserTab {
  const u = normalizeUrl(url);
  const existing = state.tabs.find((t) => hostOf(t.url) === hostOf(u));
  if (existing) return existing;
  const tab: BrowserTab = { id: 't' + ++seq, url: u, title: hostOf(u) };
  set({ ...state, tabs: [tab, ...state.tabs].slice(0, 20) });
  return tab;
}

export function updateTab(id: string, patch: Partial<Pick<BrowserTab, 'url' | 'title'>>) {
  set({ ...state, tabs: state.tabs.map((t) => (t.id === id ? { ...t, ...patch } : t)) });
}

export function closeTab(id: string) {
  set({ ...state, tabs: state.tabs.filter((t) => t.id !== id) });
}

export function isFavorite(url: string): boolean {
  return state.favorites.includes(hostOf(url));
}

/** Toggles the favorite; returns the NEW state (true = now a favorite). */
export function toggleFavorite(url: string): boolean {
  const h = hostOf(url);
  const on = !state.favorites.includes(h);
  set({ ...state, favorites: on ? [h, ...state.favorites] : state.favorites.filter((f) => f !== h) });
  return on;
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

export function useBrowserState(): State {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

/* ---- the single link entry point -------------------------------------------- */

type Navigator = { navigate: (name: string, params?: any) => void };
let navRef: Navigator | null = null;

/** Navigation registers itself once so non-component code can open links. */
export function registerBrowserNavigator(nav: Navigator | null) {
  navRef = nav;
}

/**
 * Open any web link in the in-app browser. Only http(s) is allowed; anything
 * else (javascript:, file:, intent:) is refused.
 */
export function openInBrowser(url: string, opts: { dapp?: boolean } = {}): boolean {
  const raw = url.trim();
  // Any explicit scheme other than http(s) is refused outright — never
  // "fixed" into an https URL (javascript:, file:, intent:, data:, ftp: ...).
  // A bare "host:port" is not a scheme (digits follow the colon).
  const scheme = raw.match(/^([a-z][a-z0-9+.-]*):(?!\d)/i);
  if (scheme && !/^https?$/i.test(scheme[1])) return false;
  const u = normalizeUrl(raw);
  if (!/^https?:\/\/[^\s]+$/i.test(u)) return false;
  const tab = openTab(u);
  navRef?.navigate('Browser', { tabId: tab.id, url: tab.url, dapp: !!opts.dapp });
  return !!navRef;
}


/* ---- pure helpers used by the browser screen (unit-tested) ---------------- */

/** Only http(s) pages (and in-page about:blank/srcdoc frames) may load in the web view. */
export function isAllowedNavigation(url: string): boolean {
  return /^https?:\/\//i.test(url) || /^about:(blank|srcdoc)$/i.test(url);
}

/** Label for the menu row that switches between desktop and mobile layouts. */
export function siteModeLabel(desktop: boolean): string {
  return desktop ? 'Request Mobile Website' : 'Request Desktop Website';
}

/* ---- auto-hiding browser bars (scroll behaviour, unit-tested) ------------- */

export interface ScrollSample {
  /** Current scroll offset of the page (px). */
  y: number;
  /** Total scrollable height of the page (px). */
  height: number;
  /** Visible viewport height (px). */
  viewport: number;
}

/** Distance scrolled in one direction before the bars react (ignores jitter). */
export const BAR_SCROLL_THRESHOLD = 12;
/** Within this many px of the very top or bottom the bars are always shown. */
export const BAR_EDGE_ZONE = 24;

/**
 * Trust-style bars: they slide away while scrolling DOWN, come back while
 * scrolling UP, and are always visible at the top and at the very end of the
 * page (so back/forward/reload stay reachable). Returns the next visibility.
 */
export function nextBarsVisible(prevY: number, s: ScrollSample, currentlyVisible: boolean): boolean {
  const atTop = s.y <= BAR_EDGE_ZONE;
  const atBottom = s.y + s.viewport >= s.height - BAR_EDGE_ZONE;
  if (atTop || atBottom) return true;
  const dy = s.y - prevY;
  if (dy > BAR_SCROLL_THRESHOLD) return false; // scrolling down
  if (dy < -BAR_SCROLL_THRESHOLD) return true; // scrolling up
  return currentlyVisible; // jitter: keep as is
}

/**
 * Injected into every page: reports scroll offset, page height and viewport
 * to the app (throttled to one message per animation frame). No page data is
 * read or sent: only three numbers.
 */
export const SCROLL_REPORTER_JS = `
(function () {
  if (window.__vwScroll) return;
  window.__vwScroll = true;
  var ticking = false;
  function send() {
    ticking = false;
    var d = document.documentElement, b = document.body || d;
    var y = window.pageYOffset || d.scrollTop || b.scrollTop || 0;
    var h = Math.max(d.scrollHeight || 0, b.scrollHeight || 0);
    var v = window.innerHeight || d.clientHeight || 0;
    window.ReactNativeWebView.postMessage(JSON.stringify({ t: 'scroll', y: y, h: h, v: v }));
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(send); }
  }, { passive: true });
  window.addEventListener('load', send);
  window.addEventListener('resize', send);
})();
true;`;

/** Parse a WebView message into a ScrollSample (null if it isn't ours). */
export function parseScrollMessage(raw: string): ScrollSample | null {
  try {
    const m = JSON.parse(raw);
    if (m && m.t === 'scroll' && [m.y, m.h, m.v].every((n: unknown) => typeof n === 'number' && isFinite(n as number))) {
      return { y: m.y, height: m.h, viewport: m.v };
    }
  } catch {
    /* not our message */
  }
  return null;
}
