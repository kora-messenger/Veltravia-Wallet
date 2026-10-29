/**
 * Where the scan brackets should snap when a code is caught.
 *
 * The camera reports `code.frame` (and `code.corners`) in dp relative to the
 * preview, which fills the screen — so the mapping is nearly 1:1. The corners
 * are used when present, because a tilted code's axis-aligned frame can be
 * much larger than the code itself.
 */

export interface Rect { left: number; top: number; width: number; height: number }
export interface Point { x: number; y: number }
export interface CodeGeometry {
  frame?: { x: number; y: number; width: number; height: number };
  corners?: Point[];
}

/** Smallest the brackets may shrink to, so the four arms never collapse. */
export const MIN_TARGET = 120;
/** Breathing room around the code so the brackets frame it instead of covering it. */
export const PADDING = 10;

export function codeTargetRect(
  code: CodeGeometry | undefined,
  screen: { width: number; height: number },
): Rect | null {
  if (!code) return null;
  let x = 0;
  let y = 0;
  let w = 0;
  let h = 0;

  const corners = (code.corners ?? []).filter((p) => Number.isFinite(p?.x) && Number.isFinite(p?.y));
  if (corners.length >= 3) {
    const xs = corners.map((p) => p.x);
    const ys = corners.map((p) => p.y);
    x = Math.min(...xs);
    y = Math.min(...ys);
    w = Math.max(...xs) - x;
    h = Math.max(...ys) - y;
  } else if (code.frame) {
    ({ x, y, width: w, height: h } = code.frame);
  }
  if (![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0) return null;

  // axis-aligned square around the code, then padded
  const side = Math.max(w, h) + PADDING * 2;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const size = Math.min(
    Math.max(side, MIN_TARGET),
    Math.min(screen.width, screen.height),
  );
  const left = clamp(cx - size / 2, 0, screen.width - size);
  const top = clamp(cy - size / 2, 0, screen.height - size);
  return { left, top, width: size, height: size };
}

/**
 * How long the brackets take to travel to the code, scaled by distance so a
 * short hop feels instant and a long one still reads as movement.
 */
export function morphDuration(from: Rect, to: Rect): number {
  const dist = Math.hypot(to.left - from.left, to.top - from.top);
  const grow = Math.abs(to.width - from.width);
  return Math.round(clamp(140 + dist * 0.35 + grow * 0.25, 140, 320));
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), Math.max(lo, hi));
}
