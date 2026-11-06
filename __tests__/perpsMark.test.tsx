/**
 * The Perps tab draws Ijezie's supplied infinity line (2026-11-06) instead of
 * the hand-drawn lemniscate, and at the same ink size as the glyph it replaced
 * so the tab bar's optical weight does not change.
 */
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Image } from 'react-native';

import { InfinityIcon } from '../src/components/icons';

jest.mock('../src/theme/ThemeProvider', () => ({
  useTheme: () => ({ theme: require('../src/theme/tokens').themes.light }),
}));

const mount = async (el: React.ReactElement) => {
  let tree!: renderer.ReactTestRenderer;
  await act(async () => { tree = renderer.create(el); });
  return tree;
};

describe('InfinityIcon (Perps tab)', () => {
  it('draws the supplied mark at the caller size and colour', async () => {
    const tree = await mount(<InfinityIcon size={24} color="#6C63FF" />);
    const img = tree.root.findAllByType(Image);
    expect(img.length).toBe(1);
    expect(img[0].props.style).toMatchObject({ width: 24, height: 24, tintColor: '#6C63FF' });
    await act(async () => { tree.unmount(); });
  });

  it('is the bitmap, not the old drawn lemniscate', async () => {
    const tree = await mount(<InfinityIcon size={22} color="#000" />);
    expect(tree.root.findAll((n) => n.props && 'viewBox' in n.props).length).toBe(0);
    await act(async () => { tree.unmount(); });
  });

  it('still works at the 10 dp badge size on the Home perps card', async () => {
    const tree = await mount(<InfinityIcon size={10} color="#FFFFFF" />);
    expect(tree.root.findAllByType(Image)[0].props.style).toMatchObject({ width: 10, height: 10, tintColor: '#FFFFFF' });
    await act(async () => { tree.unmount(); });
  });
});

describe('the Perps asset', () => {
  const nodeFs = require('fs') as { readFileSync: (p: string) => any };
  const nodePath = require('path') as { join: (...parts: string[]) => string };
  const nodeZlib = require('zlib') as { inflateSync: (b: any) => any };
  const Buffer_ = require('buffer').Buffer as any;
  const buf = nodeFs.readFileSync(nodePath.join('.', 'assets', 'brand', 'infinity.png'));

  const ink = () => {
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    let offset = 8;
    const idat: any[] = [];
    while (offset < buf.length) {
      const len = buf.readUInt32BE(offset);
      const type = buf.toString('ascii', offset + 4, offset + 8);
      if (type === 'IDAT') idat.push(buf.subarray(offset + 8, offset + 8 + len));
      offset += 12 + len;
    }
    const raw = nodeZlib.inflateSync(Buffer_.concat(idat));
    const stride = width * 4;
    const out = Buffer_.alloc(height * stride);
    let pos = 0;
    for (let y = 0; y < height; y++) {
      const filter = raw[pos++];
      const row = raw.subarray(pos, pos + stride); pos += stride;
      for (let x = 0; x < stride; x++) {
        const a = x >= 4 ? out[y * stride + x - 4] : 0;
        const b = y > 0 ? out[(y - 1) * stride + x] : 0;
        const c = y > 0 && x >= 4 ? out[(y - 1) * stride + x - 4] : 0;
        let v = row[x];
        if (filter === 1) v += a;
        else if (filter === 2) v += b;
        else if (filter === 3) v += (a + b) >> 1;
        else if (filter === 4) {
          const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
          v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
        }
        out[y * stride + x] = v & 0xff;
      }
    }
    let minX = width, maxX = -1, minY = height, maxY = -1;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (out[y * stride + x * 4 + 3] > 8) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    return { w: (maxX - minX + 1) / width, h: (maxY - minY + 1) / height, width, height };
  };

  it('is a 384 px RGBA square that can be tinted', () => {
    expect([...buf.slice(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(buf.readUInt32BE(16)).toBe(384);
    expect(buf.readUInt32BE(20)).toBe(384);
    expect(buf[25]).toBe(6); // RGBA
    expect(buf.length).toBeLessThan(120 * 1024);
  });

  it('keeps the width the old lemniscate had (0.84 of the box)', () => {
    const i = ink();
    expect(Math.max(i.w, i.h)).toBeCloseTo(0.84, 1);
    // and it stays a wide mark, not a square blob
    expect(i.w).toBeGreaterThan(i.h * 1.5);
  });
});
