/**
 * Veltravia Wallet — QR code encoder (pure TypeScript, zero native deps).
 *
 * Implements ISO/IEC 18004 byte-mode QR for versions 1..10 at error
 * correction level M, which comfortably holds a 42-char EVM address (or a
 * BIP-21 / EIP-681 URI). Returns the module matrix; rendering is done by
 * <QrCode /> as SVG so the style (dots, rounded finder eyes, centre logo)
 * matches Trust Wallet's receive screen.
 *
 * Verified by decoding the rendered output with OpenCV's QRCodeDetector.
 */

type Matrix = boolean[][];

// ---- Galois field GF(256), primitive polynomial 0x11D ---------------------
const EXP = new Array<number>(512);
const LOG = new Array<number>(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();

const gfMul = (a: number, b: number) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

function rsGenerator(degree: number): number[] {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array<number>(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], EXP[i]);
    }
    poly = next;
  }
  return poly;
}

function rsEncode(data: number[], ecLen: number): number[] {
  const gen = rsGenerator(ecLen);
  const res = new Array<number>(ecLen).fill(0);
  for (const d of data) {
    const factor = d ^ res[0];
    res.shift();
    res.push(0);
    for (let i = 0; i < ecLen; i++) res[i] ^= gfMul(gen[i + 1], factor);
  }
  return res;
}

// ---- Capacity table, EC level M: [ecCodewordsPerBlock, g1Blocks, g1Data, g2Blocks, g2Data]
const EC_M: Record<number, [number, number, number, number, number]> = {
  1: [10, 1, 16, 0, 0],
  2: [16, 1, 28, 0, 0],
  3: [26, 1, 44, 0, 0],
  4: [18, 2, 32, 0, 0],
  5: [24, 2, 43, 0, 0],
  6: [16, 4, 27, 0, 0],
  7: [18, 4, 31, 0, 0],
  8: [22, 2, 38, 2, 39],
  9: [22, 3, 36, 2, 37],
  10: [26, 4, 43, 1, 44],
};

const ALIGN: Record<number, number[]> = {
  1: [],
  2: [6, 18],
  3: [6, 22],
  4: [6, 26],
  5: [6, 30],
  6: [6, 34],
  7: [6, 22, 38],
  8: [6, 24, 42],
  9: [6, 26, 46],
  10: [6, 28, 50],
};

function dataCapacity(version: number): number {
  const [, b1, d1, b2, d2] = EC_M[version];
  return b1 * d1 + b2 * d2;
}

// ---- Bit buffer -----------------------------------------------------------
function pushBits(buf: number[], value: number, len: number) {
  for (let i = len - 1; i >= 0; i--) buf.push((value >>> i) & 1);
}

function utf8(str: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let c = str.charCodeAt(i);
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c >= 0xd800 && c <= 0xdbff) {
      const c2 = str.charCodeAt(++i);
      c = 0x10000 + ((c & 0x3ff) << 10) + (c2 & 0x3ff);
      out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    } else out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return out;
}

function buildCodewords(bytes: number[], version: number): number[] {
  const cap = dataCapacity(version);
  const bits: number[] = [];
  pushBits(bits, 0b0100, 4); // byte mode
  pushBits(bits, bytes.length, version < 10 ? 8 : 16);
  for (const b of bytes) pushBits(bits, b, 8);
  const maxBits = cap * 8;
  pushBits(bits, 0, Math.min(4, maxBits - bits.length)); // terminator
  while (bits.length % 8) bits.push(0);
  const cw: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let v = 0;
    for (let j = 0; j < 8; j++) v = (v << 1) | bits[i + j];
    cw.push(v);
  }
  for (let pad = 0; cw.length < cap; pad++) cw.push(pad % 2 ? 0x11 : 0xec);

  // Split into blocks, add EC, interleave.
  const [ecLen, b1, d1, b2, d2] = EC_M[version];
  const blocks: number[][] = [];
  const ecs: number[][] = [];
  let off = 0;
  for (let i = 0; i < b1 + b2; i++) {
    const size = i < b1 ? d1 : d2;
    const block = cw.slice(off, off + size);
    off += size;
    blocks.push(block);
    ecs.push(rsEncode(block, ecLen));
  }
  const out: number[] = [];
  const maxData = Math.max(d1, d2);
  for (let i = 0; i < maxData; i++) for (const b of blocks) if (i < b.length) out.push(b[i]);
  for (let i = 0; i < ecLen; i++) for (const e of ecs) out.push(e[i]);
  return out;
}

// ---- Matrix construction --------------------------------------------------
function makeMatrix(version: number) {
  const size = version * 4 + 17;
  const m: (boolean | null)[][] = Array.from({ length: size }, () => new Array(size).fill(null));
  const reserved: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false));
  return { size, m, reserved };
}

function place(
  m: (boolean | null)[][],
  reserved: boolean[][],
  r: number,
  c: number,
  v: boolean,
) {
  m[r][c] = v;
  reserved[r][c] = true;
}

function drawFinder(m: (boolean | null)[][], res: boolean[][], r0: number, c0: number) {
  const size = m.length;
  for (let r = -1; r <= 7; r++)
    for (let c = -1; c <= 7; c++) {
      const rr = r0 + r;
      const cc = c0 + c;
      if (rr < 0 || cc < 0 || rr >= size || cc >= size) continue;
      const on =
        (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
        (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
        (r >= 2 && r <= 4 && c >= 2 && c <= 4);
      place(m, res, rr, cc, on);
    }
}

function drawAlignment(m: (boolean | null)[][], res: boolean[][], version: number) {
  const pos = ALIGN[version];
  for (const r of pos)
    for (const c of pos) {
      const nearFinder =
        (r === 6 && c === 6) ||
        (r === 6 && c === pos[pos.length - 1]) ||
        (r === pos[pos.length - 1] && c === 6);
      if (nearFinder) continue;
      for (let dr = -2; dr <= 2; dr++)
        for (let dc = -2; dc <= 2; dc++) {
          const on = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
          place(m, res, r + dr, c + dc, on);
        }
    }
}

function drawTiming(m: (boolean | null)[][], res: boolean[][]) {
  const size = m.length;
  for (let i = 8; i < size - 8; i++) {
    if (!res[6][i]) place(m, res, 6, i, i % 2 === 0);
    if (!res[i][6]) place(m, res, i, 6, i % 2 === 0);
  }
}

// BCH(15,5) format bits, mask pattern + EC level M (00).
function formatBits(mask: number): number {
  const data = (0b00 << 3) | mask; // EC M = 00
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return ((data << 10) | rem) ^ 0x5412;
}

function versionBits(version: number): number {
  let rem = version;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  return (version << 12) | rem;
}

function drawFormat(m: (boolean | null)[][], res: boolean[][], mask: number) {
  const size = m.length;
  const bits = formatBits(mask);
  const bit = (i: number) => ((bits >>> i) & 1) === 1;
  for (let i = 0; i <= 5; i++) place(m, res, i, 8, bit(i));
  place(m, res, 7, 8, bit(6));
  place(m, res, 8, 8, bit(7));
  place(m, res, 8, 7, bit(8));
  for (let i = 9; i < 15; i++) place(m, res, 8, 14 - i, bit(i));
  for (let i = 0; i < 8; i++) place(m, res, 8, size - 1 - i, bit(i));
  for (let i = 8; i < 15; i++) place(m, res, size - 15 + i, 8, bit(i));
  place(m, res, size - 8, 8, true); // dark module
}

function drawVersion(m: (boolean | null)[][], res: boolean[][], version: number) {
  if (version < 7) return;
  const size = m.length;
  const bits = versionBits(version);
  for (let i = 0; i < 18; i++) {
    const on = ((bits >>> i) & 1) === 1;
    const a = size - 11 + (i % 3);
    const b = Math.floor(i / 3);
    place(m, res, b, a, on);
    place(m, res, a, b, on);
  }
}

const MASKS: ((r: number, c: number) => boolean)[] = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

function placeData(
  m: (boolean | null)[][],
  res: boolean[][],
  codewords: number[],
  mask: number,
) {
  const size = m.length;
  const bits: boolean[] = [];
  for (const cw of codewords) for (let i = 7; i >= 0; i--) bits.push(((cw >>> i) & 1) === 1);
  let idx = 0;
  let upward = true;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    for (let step = 0; step < size; step++) {
      const row = upward ? size - 1 - step : step;
      for (let dc = 0; dc < 2; dc++) {
        const c = col - dc;
        if (res[row][c]) continue;
        let v = idx < bits.length ? bits[idx] : false;
        idx++;
        if (MASKS[mask](row, c)) v = !v;
        m[row][c] = v;
      }
    }
    upward = !upward;
  }
}

function penalty(m: boolean[][]): number {
  const size = m.length;
  let score = 0;
  // N1: runs of 5+
  for (let pass = 0; pass < 2; pass++) {
    for (let a = 0; a < size; a++) {
      let run = 1;
      for (let b = 1; b < size; b++) {
        const cur = pass ? m[b][a] : m[a][b];
        const prev = pass ? m[b - 1][a] : m[a][b - 1];
        if (cur === prev) run++;
        else {
          if (run >= 5) score += run - 2;
          run = 1;
        }
      }
      if (run >= 5) score += run - 2;
    }
  }
  // N2: 2x2 blocks
  for (let r = 0; r < size - 1; r++)
    for (let c = 0; c < size - 1; c++)
      if (m[r][c] === m[r][c + 1] && m[r][c] === m[r + 1][c] && m[r][c] === m[r + 1][c + 1]) score += 3;
  // N3: finder-like patterns
  const pat1 = [true, false, true, true, true, false, true, false, false, false, false];
  const pat2 = [false, false, false, false, true, false, true, true, true, false, true];
  for (let r = 0; r < size; r++)
    for (let c = 0; c <= size - 11; c++) {
      let h1 = true, h2 = true, v1 = true, v2 = true;
      for (let k = 0; k < 11; k++) {
        if (m[r][c + k] !== pat1[k]) h1 = false;
        if (m[r][c + k] !== pat2[k]) h2 = false;
        if (m[c + k][r] !== pat1[k]) v1 = false;
        if (m[c + k][r] !== pat2[k]) v2 = false;
      }
      score += (h1 ? 40 : 0) + (h2 ? 40 : 0) + (v1 ? 40 : 0) + (v2 ? 40 : 0);
    }
  // N4: dark balance
  let dark = 0;
  for (const row of m) for (const v of row) if (v) dark++;
  const pct = (dark * 100) / (size * size);
  score += Math.floor(Math.abs(pct - 50) / 5) * 10;
  return score;
}

/** Encode text into a QR module matrix (true = dark). */
/**
 * @param minVersion lowest QR version to use. Trust renders a 42-char address on a
 * 33x33 grid (version 4); the smallest fit (version 3, 29x29) gives chunkier,
 * less refined dots. Higher versions only add capacity, so decoding is unaffected.
 */
export function encodeQr(text: string, minVersion = 1): Matrix {
  const bytes = utf8(text);
  let version = Math.max(1, minVersion);
  while (version <= 10) {
    const overhead = version < 10 ? 2 : 3; // mode+length bytes (approx, rounded up)
    if (bytes.length + overhead <= dataCapacity(version)) break;
    version++;
  }
  if (version > 10) throw new Error('QR payload too long');

  const codewords = buildCodewords(bytes, version);
  let best: Matrix | null = null;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const { size, m, reserved } = makeMatrix(version);
    drawFinder(m, reserved, 0, 0);
    drawFinder(m, reserved, 0, size - 7);
    drawFinder(m, reserved, size - 7, 0);
    drawAlignment(m, reserved, version);
    drawTiming(m, reserved);
    drawFormat(m, reserved, mask);
    drawVersion(m, reserved, version);
    placeData(m, reserved, codewords, mask);
    const out: Matrix = m.map((row) => row.map((v) => v === true));
    const s = penalty(out);
    if (s < bestScore) {
      bestScore = s;
      best = out;
    }
  }
  return best as Matrix;
}
