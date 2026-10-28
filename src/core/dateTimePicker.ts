/**
 * Native date -> time picker (DateTimePickerModule.kt). Android shows the same
 * Material calendar (Cancel / OK) then clock dialogs Trust uses for the Perps
 * Activity "Custom" range. Resolves epoch millis, or null on cancel / when the
 * native module is unavailable (tests, iOS until ported).
 */
import { NativeModules } from 'react-native';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Native = (NativeModules as any).VeltraviaDateTimePicker;

export async function pickDateTime(opts: { initial: number; min?: number; max?: number }): Promise<number | null> {
  try {
    if (!Native?.pick) return null;
    const v = await Native.pick(opts.initial, opts.min ?? 0, opts.max ?? 0);
    return typeof v === 'number' ? v : null;
  } catch {
    return null;
  }
}

/** "Oct 21, 2026 10:44 AM" (Trust's Start/End field format). */
export function formatRangeStamp(ms: number): string {
  const d = new Date(ms);
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()];
  let h = d.getHours();
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${mon} ${d.getDate()}, ${d.getFullYear()} ${h}:${m} ${ap}`;
}
