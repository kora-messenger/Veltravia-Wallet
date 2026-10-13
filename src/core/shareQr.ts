/**
 * QR image sharing (native VeltraviaShare module, see ShareModule.kt).
 *
 * Returns true when the native share sheet was opened with the PNG attached,
 * false when the module is unavailable (caller falls back to text-only).
 */
import { NativeModules } from 'react-native';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Native = (NativeModules as any).VeltraviaShare;

export function shareQrImage(matrix: boolean[][], text: string): boolean {
  try {
    if (!Native?.shareQrImage) return false;
    Native.shareQrImage(matrix, text, true);
    return true;
  } catch {
    return false;
  }
}
