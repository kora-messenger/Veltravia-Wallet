/**
 * Veltravia Wallet — app-lock state (single source of truth).
 *
 * ONE passcode / biometric screen guards the whole app. React Native's
 * <Modal> renders in its own native window ABOVE the React tree, so a lock
 * overlay inside the tree can never cover an open sheet. To make the lock
 * absolute, Navigation publishes the lock state here and every sheet is an
 * <AppModal> (src/components/AppModal.tsx) that unmounts the instant the
 * app locks — leaving the lock screen as the only thing on screen.
 */
import { useSyncExternalStore } from 'react';

let locked = false;
const listeners = new Set<() => void>();

export function setAppLocked(next: boolean): void {
  if (locked === next) return;
  locked = next;
  listeners.forEach((l) => l());
}

export function isAppLocked(): boolean {
  return locked;
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

export function useAppLocked(): boolean {
  return useSyncExternalStore(subscribe, () => locked, () => locked);
}
