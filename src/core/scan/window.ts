/**
 * Where the scan window sits, measured off the reference shot: the frame is
 * 317px on a 471px-wide screen (0.673 of the width), square, and centred.
 * Kept as a pure function so the geometry is testable and can never drift.
 */
export const WINDOW_RATIO = 0.673;
export const WINDOW_MAX = 320;      // a tablet should not get a giant box

export type ScanWindow = { size: number; x: number; y: number };

export function scanWindow(width: number, height: number): ScanWindow {
  const size = Math.min(Math.round(width * WINDOW_RATIO), WINDOW_MAX);
  return {
    size,
    x: Math.round((width - size) / 2),
    y: Math.round((height - size) / 2),
  };
}

/** A code counts once its centre is inside the window. */
export function isInsideWindow(
  frame: { x: number; y: number; width: number; height: number } | undefined,
  win: ScanWindow,
): boolean {
  if (!frame) return true;          // some devices report no geometry
  const cx = frame.x + frame.width / 2;
  const cy = frame.y + frame.height / 2;
  return cx >= win.x && cx <= win.x + win.size && cy >= win.y && cy <= win.y + win.size;
}
