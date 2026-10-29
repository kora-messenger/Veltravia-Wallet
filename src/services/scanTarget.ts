/**
 * Veltravia Wallet — QR scanner result delivery.
 *
 * Screens that open the scanner register what the result is for
 * (`target`), and ScanQrScreen hands the scanned string back through the
 * registered callback before popping. Module-level (not nav params) so the
 * native stack never serializes a function.
 */
type ScanHandler = (value: string) => void;

interface Entry {
  open: ScanHandler;
  close?: () => void; // scanner dismissed without a result
}

let entry: Entry | null = null;

/** Open the scanner for `target`; `open` receives the scanned value. */
export function registerScanTarget(open: ScanHandler, close?: () => void) {
  entry = { open, close };
  return () => {
    if (entry?.open === open) entry = null;
  };
}

/** True when a screen is waiting for a scan result. */
export function hasScanTarget(): boolean {
  return entry !== null;
}

/** Called by ScanQrScreen when a QR is found. */
export function deliverScanResult(value: string): boolean {
  if (!entry) return false;
  const e = entry;
  entry = null;
  e.open(value);
  return true;
}

/** Called by ScanQrScreen when dismissed without a scan. */
export function clearScanTarget() {
  if (entry) {
    entry.close?.();
    entry = null;
  }
}
