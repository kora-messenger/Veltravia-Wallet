/**
 * Veltravia Wallet — QR scanner result delivery, with a purpose.
 *
 * There is ONE scanner (one look, one set of brackets, one header). What differs
 * is the work the result feeds: an address field, a pairing handshake, a secret
 * phrase. So a caller registers a *purpose* alongside its callback, and the
 * scanner uses it for three things:
 *
 *   1. the header title ("Scan QR code", "Scan secret phrase", …)
 *   2. `accept`, which decides whether a code is meant for this screen at all
 *   3. the message shown when it is not, instead of silently handing bad data on
 *
 * That last part matters: scanning a payment QR while restoring a wallet must not
 * put a bitcoin: URI into the phrase box. Without a purpose the scanner behaves as
 * before (any code is delivered) so an unregistered caller can never hang.
 */
type ScanHandler = (value: string) => void;

export type ScanVerdict = { ok: true; value: string } | { ok: false; reason: string };

export interface ScanPurpose {
  /** Header text. Keep it short; Trust uses "Scan QR code". */
  title: string;
  /** Optional one-liner under the frame explaining what to point at. */
  hint?: string;
  /** Decide whether this code belongs here, and normalise it if it does. */
  accept?: (value: string) => ScanVerdict;
}

interface Entry {
  open: ScanHandler;
  close?: () => void;
  purpose?: ScanPurpose;
}

let entry: Entry | null = null;

/** Open the scanner for `target`; `open` receives the scanned value. */
export function registerScanTarget(open: ScanHandler, close?: () => void, purpose?: ScanPurpose) {
  entry = { open, close, purpose };
  return () => {
    if (entry?.open === open) entry = null;
  };
}

/** True when a screen is waiting for a scan result. */
export function hasScanTarget(): boolean {
  return entry !== null;
}

/** The active title, for the scanner header. */
export function activeScanTitle(fallback = 'Scan QR code'): string {
  return entry?.purpose?.title ?? fallback;
}

/** The active hint, if the caller supplied one. */
export function activeScanHint(): string | undefined {
  return entry?.purpose?.hint;
}

/**
 * Offer a code to the waiting screen. Returns:
 *   'delivered'  the caller accepted it and the scanner can pop
 *   'rejected'   the caller refused it; `reason` says why, keep scanning
 *   'none'       nobody was waiting
 */
export function offerScanResult(
  value: string,
): { status: 'delivered' } | { status: 'rejected'; reason: string } | { status: 'none' } {
  if (!entry) return { status: 'none' };
  const accept = entry.purpose?.accept;
  if (accept) {
    const verdict = accept(value);
    if (!verdict.ok) return { status: 'rejected', reason: verdict.reason };
    const e = entry;
    entry = null;
    e.open(verdict.value);
    return { status: 'delivered' };
  }
  const e = entry;
  entry = null;
  e.open(value);
  return { status: 'delivered' };
}

/** Called by ScanQrScreen when dismissed without a scan. */
export function clearScanTarget() {
  if (entry) {
    const e = entry;
    entry = null;
    e.close?.();
  }
}
