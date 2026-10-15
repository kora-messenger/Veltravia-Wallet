/**
 * QR image sharing (native VeltraviaShare module, see ShareModule.kt).
 *
 * Returns true when the native share sheet was opened with the PNG attached,
 * false when the module is unavailable (caller falls back to text-only).
 */
import { NativeModules } from 'react-native';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Native = (NativeModules as any).VeltraviaShare;

export function shareQrImage(matrix: boolean[][], text: string, symbol: string): boolean {
  try {
    if (!Native?.shareQrImage) return false;
    Native.shareQrImage(matrix, text, symbol);
    return true;
  } catch {
    return false;
  }
}

export interface ShareTarget {
  packageName: string;
  className: string;
  label: string;
  icon: string; // base64 PNG
}

/** Installed apps that can receive the QR image. Empty when unsupported. */
export function getShareTargets(): Promise<ShareTarget[]> {
  if (!Native?.getShareTargets) return Promise.resolve([]);
  // Native signature is (promise) — calling it with callbacks crashes the bridge.
  return Promise.resolve(Native.getShareTargets() as Promise<ShareTarget[]>)
    .then((targets) => targets ?? [])
    .catch(() => []);
}

/** Share the QR image + text directly to one target. False when unsupported. */
export function shareQrTo(t: ShareTarget, matrix: boolean[][], text: string, symbol: string): boolean {
  try {
    if (!Native?.shareQrTo) return false;
    Native.shareQrTo(t.packageName, t.className, matrix, text, symbol);
    return true;
  } catch {
    return false;
  }
}
