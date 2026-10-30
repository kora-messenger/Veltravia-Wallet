import { scanWindow, isInsideWindow, WINDOW_RATIO, WINDOW_MAX } from '../src/core/scan/window';

describe('the scan window geometry', () => {
  it('matches the reference proportions on a 411x891 phone', () => {
    // reference: 317px window on a 471px-wide shot = 0.673, centred
    expect(WINDOW_RATIO).toBeCloseTo(317 / 471, 3);
    const win = scanWindow(411, 891);
    expect(win.size).toBe(277);            // 411 * 0.673 = 276.6
    expect(win.x).toBe(67);                // (411 - 277) / 2
    expect(win.y).toBe(307);               // (891 - 277) / 2
  });

  it('stays centred and square on small and large screens', () => {
    for (const [w, h] of [[320, 640], [360, 780], [412, 915], [768, 1024]] as const) {
      const win = scanWindow(w, h);
      expect(win.size).toBeLessThanOrEqual(Math.min(w - 48, WINDOW_MAX));
      expect(win.x * 2 + win.size).toBeGreaterThanOrEqual(w - 1);
      expect(win.x * 2 + win.size).toBeLessThanOrEqual(w + 1);
      expect(win.y * 2 + win.size).toBeGreaterThanOrEqual(h - 1);
    }
  });

  it('only counts a code whose centre is inside the window', () => {
    const win = scanWindow(411, 891);
    expect(isInsideWindow({ x: 150, y: 400, width: 90, height: 90 }, win)).toBe(true);
    // just below the window
    expect(isInsideWindow({ x: 150, y: 600, width: 90, height: 90 }, win)).toBe(false);
    // left of it
    expect(isInsideWindow({ x: 0, y: 400, width: 40, height: 40 }, win)).toBe(false);
    // no geometry reported: trust the scanner
    expect(isInsideWindow(undefined, win)).toBe(true);
  });
});
