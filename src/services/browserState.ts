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
export function openInBrowser(url: string): boolean {
  const raw = url.trim();
  // Any explicit scheme other than http(s) is refused outright — never
  // "fixed" into an https URL (javascript:, file:, intent:, data:, ftp: ...).
  // A bare "host:port" is not a scheme (digits follow the colon).
  const scheme = raw.match(/^([a-z][a-z0-9+.-]*):(?!\d)/i);
  if (scheme && !/^https?$/i.test(scheme[1])) return false;
  const u = normalizeUrl(raw);
  if (!/^https?:\/\/[^\s]+$/i.test(u)) return false;
  const tab = openTab(u);
  navRef?.navigate('Browser', { tabId: tab.id, url: tab.url });
  return !!navRef;
}
