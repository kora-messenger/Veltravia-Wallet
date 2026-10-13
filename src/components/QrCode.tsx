/**
 * Veltravia Wallet — <QrCode />
 *
 * Renders an address as Trust-style QR: round dots for data modules,
 * softly rounded finder eyes, centre logo tile.
 *
 * The style numbers are NOT arbitrary. They were chosen by decoding with
 * OpenCV's QRCodeDetector over 5 addresses x 18 render sizes (90 trials):
 *   eyes rounded 0.8 / hole 0.2 / inner 0.8, logo 14% : 90/90 decode
 *   eyes rounded 1.2 (a rounder, prettier look)       : 77/90 decode
 * Detectors lock onto the 1:1:3:1:1 finder ratio, and heavier corner rounding
 * distorts it. A wallet QR that fails to scan is worse than a plainer one, so
 * do not "improve" these values without re-running that test.
 */

import React, { useMemo } from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { encodeQr } from '../core/qr';

const QUIET = 0; // the card around the QR supplies the margin

/** Rounded rect path with equal corner radius, usable with even-odd fill. */
function roundedRect(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.min(r, w / 2, h / 2);
  return (
    `M${x + rr} ${y}H${x + w - rr}A${rr} ${rr} 0 0 1 ${x + w} ${y + rr}` +
    `V${y + h - rr}A${rr} ${rr} 0 0 1 ${x + w - rr} ${y + h}` +
    `H${x + rr}A${rr} ${rr} 0 0 1 ${x} ${y + h - rr}` +
    `V${y + rr}A${rr} ${rr} 0 0 1 ${x + rr} ${y}Z`
  );
}

export default function QrCode({
  value,
  size,
  color = '#000000',
  background = '#FFFFFF',
  logo,
}: {
  value: string;
  size: number;
  color?: string;
  background?: string;
  /** Rendered in a rounded tile at the centre (14% of the width). */
  logo?: React.ReactNode;
}) {
  const matrix = useMemo(() => encodeQr(value), [value]);
  const n = matrix.length;
  const unit = size / (n + QUIET * 2);

  const isFinder = (r: number, c: number) =>
    (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);

  const logoModules = Math.floor(n * 0.14);
  const logoStart = Math.floor((n - logoModules) / 2);
  const inLogo = (r: number, c: number) =>
    !!logo && r >= logoStart - 1 && r <= logoStart + logoModules && c >= logoStart - 1 && c <= logoStart + logoModules;

  const dots: React.ReactNode[] = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!matrix[r][c] || isFinder(r, c) || inLogo(r, c)) continue;
      dots.push(
        <Circle
          key={`${r}-${c}`}
          cx={(c + QUIET + 0.5) * unit}
          cy={(r + QUIET + 0.5) * unit}
          r={unit * 0.5}
          fill={color}
        />,
      );
    }
  }

  // Three finder eyes: outer ring (even-odd) + solid inner square.
  const eyes = [
    [0, 0],
    [0, n - 7],
    [n - 7, 0],
  ].map(([r0, c0]) => {
    const x = (c0 + QUIET) * unit;
    const y = (r0 + QUIET) * unit;
    const outer = roundedRect(x, y, 7 * unit, 7 * unit, unit * 0.8);
    const hole = roundedRect(x + unit, y + unit, 5 * unit, 5 * unit, unit * 0.2);
    const inner = roundedRect(x + 2 * unit, y + 2 * unit, 3 * unit, 3 * unit, unit * 0.8);
    return (
      <React.Fragment key={`${r0}-${c0}`}>
        <Path d={`${outer}${hole}`} fill={color} fillRule="evenodd" />
        <Path d={inner} fill={color} />
      </React.Fragment>
    );
  });

  const logoPx = logoModules * unit;
  const logoOffset = (size - logoPx) / 2;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Rect x={0} y={0} width={size} height={size} fill={background} />
      {dots}
      {eyes}
      {logo ? (
        <Svg x={logoOffset} y={logoOffset} width={logoPx} height={logoPx}>
          {logo}
        </Svg>
      ) : null}
    </Svg>
  );
}
