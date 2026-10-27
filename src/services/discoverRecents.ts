/**
 * Discover "Recents" — coins/dApps the user tapped.
 *
 * Module-level on purpose: the Recents strip must survive switching between
 * the Tokens and dApps pages (and tab changes), and stays EMPTY — hidden —
 * until the user taps something. Memory only; never persisted or sent.
 */
import { useSyncExternalStore } from 'react';

export interface RecentItem {
  id: string;
  kind: 'token' | 'dapp';
  label: string;
  /** Short chain/category caption under the name ("Token" in Trust). */
  caption: string;
  color: string;
}

let items: RecentItem[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const MAX = 12;

export function addRecent(item: RecentItem): void {
  items = [item, ...items.filter((r) => !(r.id === item.id && r.kind === item.kind))].slice(0, MAX);
  emit();
}

export function clearRecents(): void {
  if (items.length === 0) return;
  items = [];
  emit();
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

export function useRecents(): RecentItem[] {
  return useSyncExternalStore(subscribe, () => items, () => items);
}
