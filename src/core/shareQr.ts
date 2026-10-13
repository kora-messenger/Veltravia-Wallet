/**
 * QR image sharing (native VeltraviaShare module, see ShareModule.kt).
 *
 * Returns true when the native share sheet was opened with the PNG attached,
 * false when the module is unavailable (caller falls back to text-only).
 */
import { NativeModules } from 'react-native';
import { coinColor } from './coinColors';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Native = (NativeModules as any).VeltraviaShare;

export function shareQrImage(matrix: boolean[][], text: string, symbol: string): boolean {
  try {
    if (!Native?.shareQrImage) return false;
    Native.shareQrImage(matrix, text, coinColor(symbol));
    return true;
  } catch {
    return false;
  }
}
