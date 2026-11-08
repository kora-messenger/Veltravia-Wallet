/**
 * The Trending header on Discover carries Ijezie's supplied flame (2026-11-08)
 * next to the word, tinted in the brand colour. Pins both the asset contract and
 * that the header actually draws it — a supplied icon nobody wired up would
 * otherwise pass silently.
 */
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { Image } from 'react-native';

jest.mock('../src/theme/ThemeProvider', () => ({
  useTheme: () => ({
    theme: {
      mode: 'light',
      ink: '#0F111A',
      inkMuted: '#8A8EA3',
      brand: '#6C63FF',
      background: '#FFFFFF',
      surface: '#F5F5F7',
      surfaceAlt: '#F3F4FA',
    },
  }),
}));
jest.mock('../src/components/Toast', () => ({ showToast: jest.fn() }));
jest.mock('../src/services/browserState', () => ({ openInBrowser: jest.fn(() => true) }));

import DiscoverScreen from '../src/screens/DiscoverScreen';
import { TrendingIcon } from '../src/components/icons';

const mount = async () => {
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
        <NavigationContainer><DiscoverScreen /></NavigationContainer>
      </SafeAreaProvider>,
    );
  });
  return tree;
};

describe('Trending header', () => {
  it('draws the flame next to the word, in the brand colour', async () => {
    const tree = await mount();
    const marks = tree.root.findAllByType(TrendingIcon);
    expect(marks.length).toBe(1);
    expect(marks[0].props.color).toBe('#6C63FF');
    expect(marks[0].props.size).toBe(22);
    await act(async () => tree.unmount());
  });
});

/** Minimal PNG reader for the asset contract: 8-bit RGBA, every filter type. */
function decodePng(buf: any) {
  const zlib = require('zlib');
  let pos = 8;
  let width = 0;
  let height = 0;
  const idat: any[] = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.slice(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
    } else if (type === 'IDAT') {
      idat.push(data);
    }
    pos += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const out = Buffer.alloc(stride * height);
  const paeth = (a: number, b: number, c: number) => {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const dst = y * stride;
    for (let x = 0; x < stride; x++) {
      const left = x >= 4 ? out[dst + x - 4] : 0;
      const up = y > 0 ? out[dst - stride + x] : 0;
      const upLeft = x >= 4 && y > 0 ? out[dst - stride + x - 4] : 0;
      const v = raw[src + x];
      out[dst + x] =
        filter === 0 ? v
        : filter === 1 ? (v + left) & 0xff
        : filter === 2 ? (v + up) & 0xff
        : filter === 3 ? (v + ((left + up) >> 1)) & 0xff
        : (v + paeth(left, up, upLeft)) & 0xff;
    }
  }
  return { width, height, data: out };
}

describe('the trending asset', () => {
  const nodeFs = require('fs');
  const nodePath = require('path');
  const buf = nodeFs.readFileSync(nodePath.join('.', 'assets', 'brand', 'trending.png'));

  it('is a 384 px RGBA square that can be tinted', () => {
    expect([...buf.slice(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(buf.readUInt32BE(16)).toBe(384);
    expect(buf.readUInt32BE(20)).toBe(384);
    expect(buf[25]).toBe(6); // RGBA
    expect(buf.length).toBeLessThan(120 * 1024);
  });

  it('is white with an alpha shape, so tintColor alone colours it', () => {
    const { width, height, data } = decodePng(buf);
    let opaque = 0;
    let lit = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 200) continue;
      opaque++;
      if (data[i] > 240 && data[i + 1] > 240 && data[i + 2] > 240) lit++;
    }
    expect(width).toBe(384);
    expect(height).toBe(384);
    expect(opaque).toBeGreaterThan(100);
    expect(lit / opaque).toBeGreaterThan(0.95); // white artwork, no baked colour
  });
});
