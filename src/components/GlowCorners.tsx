/**
 * The four glowing corners shared by the link-device screens: a blue-to-purple
 * gradient L at each corner of a rounded window, drawn three strokes deep so it
 * reads as glow without a blur filter (wide and faint under narrow and bright).
 */
import React from 'react';
import { Path } from 'react-native-svg';

export const GLOW_FROM = '#2EA2F8';
export const GLOW_TO = '#A633FF';

/**
 * Path for one corner of a rounded window, drawn as a single stroke: an arm
 * down the side, the rounded corner itself, then an arm along the top (or
 * bottom, for the lower corners). `x`/`y` is the corner point itself.
 */
export function cornerPath(x: number, y: number, side: number, arm: number, r: number): string {
  switch (side) {
    case 0: // top-left
      return `M ${x} ${y + r + arm} L ${x} ${y + r} Q ${x} ${y} ${x + r} ${y} L ${x + r + arm} ${y}`;
    case 1: // top-right
      return `M ${x - r - arm} ${y} L ${x - r} ${y} Q ${x} ${y} ${x} ${y + r} L ${x} ${y + r + arm}`;
    case 2: // bottom-right
      return `M ${x} ${y - r - arm} L ${x} ${y - r} Q ${x} ${y} ${x - r} ${y} L ${x - r - arm} ${y}`;
    default: // bottom-left
      return `M ${x + r + arm} ${y} L ${x + r} ${y} Q ${x} ${y} ${x} ${y - r} L ${x} ${y - r - arm}`;
  }
}

export default function GlowCorners({
  x, y, size, radius, arm = 46, stroke = 'url(#glowCorner)',
}: { x: number; y: number; size: number; radius: number; arm?: number; stroke?: string }) {
  const sides: [number, number, number][] = [
    [x, y, 0],
    [x + size, y, 1],
    [x + size, y + size, 2],
    [x, y + size, 3],
  ];
  return (
    <>
      {sides.map(([px, py, side]) => {
        const d = cornerPath(px, py, side, arm, radius);
        return (
          <React.Fragment key={side}>
            <Path d={d} stroke={stroke} strokeWidth={14} strokeOpacity={0.16} strokeLinecap="round" fill="none" />
            <Path d={d} stroke={stroke} strokeWidth={7} strokeOpacity={0.4} strokeLinecap="round" fill="none" />
            <Path d={d} stroke={stroke} strokeWidth={3.4} strokeLinecap="round" fill="none" testID={`scanCorner${side}`} />
          </React.Fragment>
        );
      })}
    </>
  );
}
