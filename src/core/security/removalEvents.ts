/**
 * Veltravia Wallet — removal events.
 *
 * Kept dependency-free on purpose: the lock registry raises the event and the
 * app root listens for it, without those two importing each other.
 */

type Handler = () => void;

const handlers = new Set<Handler>();

/** Register a listener for "this device was removed from its wallet group". */
export function onDeviceRemoved(handler: Handler): () => void {
  handlers.add(handler);
  return () => handlers.delete(handler);
}

/** Raise the event. Listeners are async-safe: each is invoked and failures ignored. */
export function emitDeviceRemoved(): void {
  for (const handler of handlers) {
    try {
      handler();
    } catch {
      /* a bad listener must not break the sync path */
    }
  }
}

/** Tests only. */
export function __resetDeviceRemovalHandlersForTests(): void {
  handlers.clear();
}
