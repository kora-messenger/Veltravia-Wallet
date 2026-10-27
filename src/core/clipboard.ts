/**
 * Clipboard bridge (native VeltraviaClipboard module, see ClipboardModule.kt).
 * Copy everywhere; read ONLY via pasteFromClipboard(), which the Discover
 * search "Paste" pill calls on an explicit tap (never in the background).
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

/** Explicit user-tap paste (Discover search). Resolves '' if unavailable. */
export async function pasteFromClipboard(): Promise<string> {
  try {
    const t = await Native?.getString?.();
    return typeof t === 'string' ? t : '';
  } catch {
    return '';
  }
}
