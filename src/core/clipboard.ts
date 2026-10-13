/**
 * Clipboard bridge (native VeltraviaClipboard module, see ClipboardModule.kt).
 * Copy-only: the app never reads the clipboard.
 */
import { NativeModules, Vibration } from 'react-native';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Native = (NativeModules as any).VeltraviaClipboard;

export function copyToClipboard(text: string, opts: { sensitive?: boolean; haptic?: boolean } = {}): boolean {
  try {
    Native?.setString?.(text, !!opts.sensitive);
    if (opts.haptic !== false) Vibration.vibrate(10);
    return !!Native;
  } catch {
    return false;
  }
}
